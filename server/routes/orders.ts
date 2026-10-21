import { Router, Request, Response } from 'express';
import { getDatabaseRepository } from '../db/repository.js';
import { CreateOrderRequest, OrderItem } from '../../src/types/index.js';

const router = Router();

// POST /api/orders - Guest checkout order creation
router.post('/', async (req: Request, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const settings = await repo.getShopSettings();

    // 1. Check shop open status
    if (!settings.isOpen) {
      res.status(400).json({
        success: false,
        error: 'Chandu Chicken Center is currently closed for online orders. Please check our operational hours.'
      });
      return;
    }

    const body: CreateOrderRequest = req.body;

    // 2. Validate Customer Details (Guest Checkout)
    if (!body.customer) {
      res.status(400).json({ success: false, error: 'Customer details are required' });
      return;
    }

    const { name, phone, address, landmark, notes } = body.customer;

    if (!name || name.trim().length < 2) {
      res.status(400).json({ success: false, error: 'Please enter a valid customer name (at least 2 characters)' });
      return;
    }

    // Validate Indian phone number (10 digits, optionally prefixed with +91 or 0)
    const cleanedPhone = phone ? phone.replace(/[\s\-()]/g, '') : '';
    const phoneRegex = /^(\+91|0)?[6-9]\d{9}$/;
    if (!cleanedPhone || !phoneRegex.test(cleanedPhone)) {
      res.status(400).json({
        success: false,
        error: 'Please enter a valid 10-digit Indian mobile number for delivery updates'
      });
      return;
    }

    if (!address || address.trim().length < 8) {
      res.status(400).json({
        success: false,
        error: 'Please enter a complete delivery address (house/flat no, street, locality)'
      });
      return;
    }

    // 3. Payment Method Enforcement
    if (body.paymentMethod !== 'COD') {
      res.status(400).json({
        success: false,
        error: 'Online UPI payments are currently pending banking gateway integration. Please select Cash on Delivery (COD).'
      });
      return;
    }

    // 4. Validate Items & Calculate Prices on Server
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ success: false, error: 'Your cart is empty. Please add fresh cuts to order.' });
      return;
    }

    const orderItems: OrderItem[] = [];
    let calculatedSubtotal = 0;

    for (const item of body.items) {
      if (!item.productId || !item.weight || !item.quantity || item.quantity <= 0) {
        res.status(400).json({ success: false, error: 'Invalid cart item structure' });
        return;
      }

      const product = await repo.getProductById(item.productId);
      if (!product) {
        res.status(400).json({ success: false, error: `Product not found: ${item.productId}` });
        return;
      }

      if (!product.isAvailable) {
        res.status(400).json({
          success: false,
          error: `Sorry, "${product.name}" is currently sold out today.`
        });
        return;
      }

      const weightOption = product.weights.find(w => w.weight === item.weight);
      if (!weightOption) {
        res.status(400).json({
          success: false,
          error: `Selected weight option (${item.weight}) is not valid for ${product.name}`
        });
        return;
      }

      if (!weightOption.inStock) {
        res.status(400).json({
          success: false,
          error: `The ${item.weight} pack for "${product.name}" is out of stock today.`
        });
        return;
      }

      const unitPrice = weightOption.price;
      const subtotal = unitPrice * item.quantity;
      calculatedSubtotal += subtotal;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        weight: item.weight,
        cutPreference: item.cutPreference || 'Standard Cut',
        unitPrice,
        quantity: item.quantity,
        subtotal
      });
    }

    // 5. Validate Minimum Order Amount
    const minOrder = typeof settings.minOrderAmount === 'number' ? settings.minOrderAmount : 0;
    if (minOrder > 0 && calculatedSubtotal < minOrder) {
      res.status(400).json({
        success: false,
        error: `Minimum order value for home delivery is ₹${minOrder}. Current subtotal: ₹${calculatedSubtotal}`
      });
      return;
    }

    // 6. Calculate Delivery Fee
    const deliveryFee = calculatedSubtotal >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee;
    const discount = 0;
    const totalAmount = calculatedSubtotal + deliveryFee - discount;

    // 7. Create Order in Database
    const order = await repo.createOrder(
      {
        customer: {
          name: name.trim(),
          phone: cleanedPhone,
          address: address.trim(),
          landmark: landmark ? landmark.trim() : '',
          notes: notes ? notes.trim() : ''
        },
        items: body.items,
        paymentMethod: 'COD',
        idempotencyKey: body.idempotencyKey
      },
      {
        subtotal: calculatedSubtotal,
        deliveryFee,
        discount,
        totalAmount,
        items: orderItems
      }
    );

    res.status(201).json({
      success: true,
      message: 'Order placed successfully! Fresh chicken is being prepared for you.',
      order
    });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({
      success: false,
      error: 'An internal server error occurred while processing your order. Please try again.'
    });
  }
});

// GET /api/orders/customer/by-phone/:phone - Customer past order history
router.get('/customer/by-phone/:phone', async (req: Request, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const phone = req.params.phone.trim();
    const orders = await repo.getOrdersByCustomerPhone(phone);
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching customer orders by phone:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customer orders' });
  }
});

// GET /api/orders/:orderNumberOrId - Public live tracking
router.get('/:orderNumberOrId', async (req: Request, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const query = req.params.orderNumberOrId.trim();

    let order = await repo.getOrderByNumber(query);
    if (!order) {
      order = await repo.getOrderById(query);
    }

    if (!order) {
      res.status(404).json({
        success: false,
        error: `Order with reference "${query}" not found. Please double-check your order number.`
      });
      return;
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error looking up order:', error);
    res.status(500).json({ success: false, error: 'Failed to lookup order tracking status' });
  }
});

export default router;
