import { Router, Request, Response } from 'express';
import { getDatabaseRepository } from '../db/repository.js';
import { requireAdminAuth, generateAdminToken, revokeAdminToken, AuthenticatedRequest } from '../middleware/auth.js';
import { getImageStorageService } from '../services/imageStorage.js';
import { OrderStatus, PaymentStatus, WeightUnit } from '../../src/types/index.js';

const router = Router();

// =========================================================================
// 1. Admin Authentication
// =========================================================================

// POST /api/admin/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username and password required' });
      return;
    }

    const repo = await getDatabaseRepository();
    const admin = await repo.validateAdmin(username, password);

    if (!admin) {
      res.status(401).json({
        success: false,
        error: 'Invalid admin credentials. Please check your username and password.'
      });
      return;
    }

    const token = generateAdminToken(admin.id, admin.username);

    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Error during admin login:', error);
    res.status(500).json({ success: false, error: 'Internal server error during login' });
  }
});

// POST /api/admin/logout
router.post('/logout', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    revokeAdminToken(authHeader.substring(7));
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/admin/me
router.get('/me', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  const repo = await getDatabaseRepository();
  const admin = await repo.getAdminById(req.adminUser!.adminId);
  res.json({ success: true, admin });
});

// =========================================================================
// 2. Admin Orders Management
// =========================================================================

// GET /api/admin/orders
router.get('/orders', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const { status, paymentStatus, search } = req.query;

    const orders = await repo.getOrders({
      status: status as OrderStatus | 'All',
      paymentStatus: paymentStatus as PaymentStatus | 'All',
      searchQuery: search as string
    });

    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// POST /api/admin/orders (Create Manual / Walk-in / Phone Order)
router.post('/orders', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const {
      customer,
      items,
      orderType = 'Walk-in',
      paymentMethod = 'Cash',
      paymentStatus = 'Paid',
      orderStatus = 'Accepted',
      deliveryFee = 0,
      discount = 0
    } = req.body;

    if (!customer?.name?.trim()) {
      res.status(400).json({ success: false, error: 'Customer name is required' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'At least one product item is required' });
      return;
    }

    // Build order items and verify against database
    const orderItems: any[] = [];
    let calculatedSubtotal = 0;

    for (const item of items) {
      const product = await repo.getProductById(item.productId);
      if (!product) {
        res.status(400).json({ success: false, error: `Product not found: ${item.productId}` });
        return;
      }

      const weightOpt = product.weights.find(w => w.weight === item.weight) || product.weights[0];
      const unitPrice = typeof item.unitPrice === 'number' && item.unitPrice >= 0
        ? item.unitPrice
        : (weightOpt ? weightOpt.price : 0);

      const qty = Math.max(1, parseInt(item.quantity) || 1);
      const sub = unitPrice * qty;
      calculatedSubtotal += sub;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        weight: item.weight || weightOpt.weight,
        cutPreference: item.cutPreference || 'Standard Cut',
        unitPrice,
        quantity: qty,
        subtotal: sub
      });
    }

    const numDeliveryFee = Math.max(0, Number(deliveryFee) || 0);
    const numDiscount = Math.max(0, Number(discount) || 0);
    const totalAmount = Math.max(0, calculatedSubtotal + numDeliveryFee - numDiscount);

    const created = await repo.createOrder(
      {
        customer: {
          name: customer.name.trim(),
          phone: customer.phone ? customer.phone.trim() : 'Walk-in',
          address: customer.address ? customer.address.trim() : (orderType === 'Walk-in' ? 'Counter Walk-in' : 'Store Pickup'),
          landmark: customer.landmark?.trim() || '',
          notes: customer.notes?.trim() || (orderType ? `Mode: ${orderType}` : '')
        },
        items: orderItems,
        paymentMethod: paymentMethod as any,
        paymentStatus: paymentStatus as any,
        orderStatus: orderStatus as any,
        orderType: orderType as any,
        idempotencyKey: `admin-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      } as any,
      {
        subtotal: calculatedSubtotal,
        deliveryFee: numDeliveryFee,
        discount: numDiscount,
        totalAmount,
        items: orderItems
      }
    );

    res.status(201).json({ success: true, order: created });
  } catch (error: any) {
    console.error('Error creating manual admin order:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create manual order' });
  }
});

// PATCH /api/admin/orders/:id/status
router.patch('/orders/:id/status', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, note } = req.body;
    const validStatuses: OrderStatus[] = [
      'New',
      'Accepted',
      'Preparing',
      'Ready for Dispatch',
      'Out for Delivery',
      'Delivered',
      'Rejected',
      'Cancelled'
    ];

    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, error: `Invalid order status: ${status}` });
      return;
    }

    const repo = await getDatabaseRepository();
    const updated = await repo.updateOrderStatus(req.params.id, status, note);

    if (!updated) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order: updated
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// PATCH /api/admin/orders/:id/payment
router.patch('/orders/:id/payment', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { paymentStatus } = req.body;
    const validStatuses: PaymentStatus[] = ['Pending', 'Paid', 'Failed', 'Refunded'];

    if (!validStatuses.includes(paymentStatus)) {
      res.status(400).json({ success: false, error: `Invalid payment status: ${paymentStatus}` });
      return;
    }

    const repo = await getDatabaseRepository();
    const updated = await repo.updatePaymentStatus(req.params.id, paymentStatus);

    if (!updated) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    res.json({
      success: true,
      message: `Payment status marked as ${paymentStatus}`,
      order: updated
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ success: false, error: 'Failed to update payment status' });
  }
});

// =========================================================================
// 3. Admin Products Management
// =========================================================================

// GET /api/admin/products - Returns all products including inactive ones for administration
router.get('/products', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const repo = await getDatabaseRepository();
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const products = await repo.getProducts(category, search);
    res.json({ success: true, products });
  } catch (error) {
    console.error('Error fetching admin products:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch admin products' });
  }
});

// POST /api/admin/products
router.post('/products', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const product = req.body;

    if (!product.name || !product.weights || !Array.isArray(product.weights) || product.weights.length === 0) {
      res.status(400).json({ success: false, error: 'Product name and at least one weight option are required' });
      return;
    }

    const categories = await repo.getCategories();
    const categoryId = product.categoryId || categories[0]?.id || 'cat-fresh-cuts';

    const id = product.id || `prod-${Date.now()}`;
    const slug = product.slug || product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const saved = await repo.saveProduct({
      ...product,
      id,
      slug,
      categoryId,
      isAvailable: product.isAvailable !== false
    });

    res.status(201).json({ success: true, message: 'Product created successfully', product: saved });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, error: 'Failed to create product' });
  }
});

// PUT /api/admin/products/:id
router.put('/products/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const product = req.body;

    if (!product.name || !product.weights || !Array.isArray(product.weights) || product.weights.length === 0) {
      res.status(400).json({ success: false, error: 'Product name and weight options are required' });
      return;
    }

    const categories = await repo.getCategories();
    const categoryId = product.categoryId || categories[0]?.id || 'cat-fresh-cuts';

    const saved = await repo.saveProduct({
      ...product,
      id: req.params.id,
      categoryId,
      isAvailable: product.isAvailable !== false
    });

    res.json({ success: true, message: 'Product updated successfully', product: saved });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const deleted = await repo.deleteProduct(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

// PATCH /api/admin/products/:id/stock - Toggle product availability
router.patch('/products/:id/stock', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isAvailable } = req.body;
    const repo = await getDatabaseRepository();
    const ok = await repo.updateProductStock(req.params.id, Boolean(isAvailable));
    if (!ok) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.json({ success: true, isAvailable });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ success: false, error: 'Failed to update stock' });
  }
});

// PATCH /api/admin/products/:id/weight-stock - Update variant stock & price
router.patch('/products/:id/weight-stock', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { weight, inStock, price } = req.body;
    const repo = await getDatabaseRepository();
    const ok = await repo.updateWeightStock(req.params.id, weight as WeightUnit, Boolean(inStock), price);
    if (!ok) {
      res.status(404).json({ success: false, error: 'Product or weight option not found' });
      return;
    }
    res.json({ success: true, message: 'Weight variant stock updated' });
  } catch (error) {
    console.error('Error updating weight stock:', error);
    res.status(500).json({ success: false, error: 'Failed to update weight variant stock' });
  }
});

// =========================================================================
// 4. Admin Categories Management
// =========================================================================

// POST /api/admin/categories
router.post('/categories', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const cat = req.body;
    const id = cat.id || `cat-${Date.now()}`;
    const slug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const saved = await repo.saveCategory({ ...cat, id, slug });
    res.status(201).json({ success: true, category: saved });
  } catch (error) {
    console.error('Error saving category:', error);
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
});

// PUT /api/admin/categories/:id
router.put('/categories/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const saved = await repo.saveCategory({ ...req.body, id: req.params.id });
    res.json({ success: true, category: saved });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ success: false, error: 'Failed to update category' });
  }
});

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const ok = await repo.deleteCategory(req.params.id);
    if (!ok) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    res.json({ success: true, message: 'Category removed' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
});

// =========================================================================
// 5. Image Upload Service
// =========================================================================

// POST /api/admin/upload-image
router.post('/upload-image', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { imageBase64, mimeType, filename } = req.body;
    if (!imageBase64 || !mimeType) {
      res.status(400).json({ success: false, error: 'imageBase64 and mimeType are required' });
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const storage = getImageStorageService();
    const result = await storage.uploadImage(buffer, mimeType, filename || 'product.jpg');

    res.json({
      success: true,
      message: 'Product image uploaded successfully',
      result
    });
  } catch (error: any) {
    console.error('Image upload failed:', error);
    res.status(400).json({ success: false, error: error.message || 'Image upload failed' });
  }
});

// =========================================================================
// 6. Reports & Settings
// =========================================================================

// GET /api/admin/reports
router.get('/reports', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const { startDate, endDate, productIds } = req.query;

    let parsedProductIds: string[] | undefined = undefined;
    if (typeof productIds === 'string' && productIds.trim()) {
      parsedProductIds = productIds.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(productIds)) {
      parsedProductIds = productIds.map(String);
    }

    const reports = await repo.getSalesReport({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      productIds: parsedProductIds
    });
    res.json({ success: true, reports });
  } catch (error) {
    console.error('Error generating reports:', error);
    res.status(500).json({ success: false, error: 'Failed to generate sales report' });
  }
});

// PUT /api/admin/settings
router.put('/settings', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const updated = await repo.updateShopSettings(req.body);
    res.json({ success: true, message: 'Shop settings updated', settings: updated });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update shop settings' });
  }
});

export default router;
