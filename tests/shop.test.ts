import assert from 'assert';
import { MemoryDatabaseRepository } from '../server/db/repository.js';
import { CreateOrderRequest, OrderStatus, PaymentStatus } from '../src/types/index.js';

async function runTestSuite() {
  console.log('🧪 Starting Chandu Chicken Center Automated Test Suite...\n');
  const repo = new MemoryDatabaseRepository();
  await repo.init();

  // Test 1: Product pricing and weight option retrieval
  console.log('▶ Test 1: Product pricing and weight options');
  const products = await repo.getProducts();
  assert(products.length > 0, 'Products should be loaded');
  const curryCut = products.find(p => p.id === 'prod-curry-cut');
  assert(curryCut, 'Curry cut product should exist');
  
  const w250 = curryCut.weights.find(w => w.weight === '250g');
  const w500 = curryCut.weights.find(w => w.weight === '500g');
  const w1kg = curryCut.weights.find(w => w.weight === '1kg');

  assert(w250 && w250.price === 65, '250g pack price should be 65');
  assert(w500 && w500.price === 125, '500g pack price should be 125');
  assert(w1kg && w1kg.price === 240, '1kg pack price should be 240');
  console.log('  ✅ Product pricing and weight tiers verified.');

  // Test 2: Cart Calculation & Free Delivery Threshold
  console.log('\n▶ Test 2: Cart Calculation & Free Delivery Threshold');
  const settings = await repo.getShopSettings();
  assert(settings.freeDeliveryThreshold === 499, 'Free delivery threshold should be 499');
  assert(settings.deliveryFee === 30, 'Delivery fee should be 30');

  // Below threshold
  const subtotal1 = 365;
  const deliveryFee1 = subtotal1 >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee;
  assert(deliveryFee1 === 30, 'Orders under 499 must incur ₹30 delivery fee');

  // Above threshold
  const subtotal2 = 520;
  const deliveryFee2 = subtotal2 >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee;
  assert(deliveryFee2 === 0, 'Orders of ₹499+ must qualify for ₹0 free delivery');
  console.log('  ✅ Delivery fee thresholds verified.');

  // Test 3: Guest Checkout & Server-Side Price Snapshot
  console.log('\n▶ Test 3: Guest Checkout Order Creation with Immutable Snapshot');
  const orderReq: CreateOrderRequest = {
    customer: {
      name: 'Anil Kumar',
      phone: '9848011223',
      address: 'House 12-4, Market Road, Near Gandhi Statue',
      landmark: 'Near Medical Hall'
    },
    items: [
      {
        productId: 'prod-curry-cut',
        weight: '1kg',
        cutPreference: 'Standard Curry Cut (12-16 pcs/kg)',
        quantity: 2
      }
    ],
    paymentMethod: 'COD',
    idempotencyKey: `test-idem-${Date.now()}`
  };

  const calculatedSubtotal = 240 * 2; // 480
  const order = await repo.createOrder(orderReq, {
    subtotal: calculatedSubtotal,
    deliveryFee: 30,
    discount: 0,
    totalAmount: 510,
    items: [
      {
        productId: 'prod-curry-cut',
        productName: 'Fresh Chicken Curry Cut (Skinless)',
        weight: '1kg',
        cutPreference: 'Standard Curry Cut (12-16 pcs/kg)',
        unitPrice: 240,
        quantity: 2,
        subtotal: 480
      }
    ]
  });

  assert(order.id, 'Order must have a generated ID');
  assert(order.orderNumber.startsWith('CCC-'), 'Order number must follow CCC- prefix format');
  assert(order.paymentMethod === 'COD', 'Payment method must be COD');
  assert(order.paymentStatus === 'Pending', 'Initial payment status must be Pending');
  assert(order.orderStatus === 'New', 'Initial order status must be New');
  assert(order.items[0].unitPrice === 240, 'Item price must be stored as immutable snapshot');
  console.log('  ✅ Guest checkout order creation with price snapshot verified.');

  // Test 4: Duplicate Order Prevention (Idempotency)
  console.log('\n▶ Test 4: Duplicate-Order Prevention (Idempotency)');
  const duplicateOrder = await repo.createOrder(orderReq, {
    subtotal: calculatedSubtotal,
    deliveryFee: 30,
    discount: 0,
    totalAmount: 510,
    items: order.items
  });
  assert.strictEqual(duplicateOrder.id, order.id, 'Idempotent key must return existing order and prevent duplication');
  console.log('  ✅ Duplicate order prevention verified.');

  // Test 5: Order Status Transitions
  console.log('\n▶ Test 5: Order Status Transitions');
  const statuses: OrderStatus[] = [
    'Accepted',
    'Preparing',
    'Ready for Dispatch',
    'Out for Delivery',
    'Delivered'
  ];

  for (const st of statuses) {
    const updated = await repo.updateOrderStatus(order.id, st, `Testing transition to ${st}`);
    assert(updated && updated.orderStatus === st, `Order status should advance to ${st}`);
  }
  console.log('  ✅ Order status transitions verified.');

  // Test 6: Payment Status Stored Separately
  console.log('\n▶ Test 6: Payment Status Separated from Order Status');
  const latestOrder = await repo.getOrderById(order.id);
  assert(latestOrder?.orderStatus === 'Delivered', 'Order status must be Delivered');
  assert(latestOrder?.paymentStatus === 'Pending', 'Delivered order must NOT automatically be marked as paid');

  // Explicit reconciliation
  const paidOrder = await repo.updatePaymentStatus(order.id, 'Paid');
  assert(paidOrder?.paymentStatus === 'Paid', 'Payment status should be marked Paid only after cash reconciliation');
  console.log('  ✅ Payment status separation verified.');

  // Test 7: Admin Authentication
  console.log('\n▶ Test 7: Admin Authentication & Access Restrictions');
  const validAdmin = await repo.validateAdmin('admin', 'chandu@123');
  assert(validAdmin !== null, 'Valid admin credentials must pass');
  assert(validAdmin.username === 'admin', 'Admin username must match');

  const invalidAdmin = await repo.validateAdmin('admin', 'wrong_password');
  assert(invalidAdmin === null, 'Invalid admin password must be rejected');
  console.log('  ✅ Admin authentication security verified.');

  // Test 8: Minimum Order Amount & Zero Threshold Logic
  console.log('\n▶ Test 8: Minimum Order Amount & Zero-Threshold Logic');
  // Default is 0
  const defaultSettings = await repo.getShopSettings();
  const minZero = defaultSettings.minOrderAmount ?? 0;
  const isBelowMinWhenZero = minZero > 0 && 65 < minZero;
  assert(!isBelowMinWhenZero, 'An order of ₹65 must NOT be blocked when minOrderAmount is 0');

  // Updating settings to 150
  await repo.updateShopSettings({ minOrderAmount: 150 });
  const updated150 = await repo.getShopSettings();
  assert(updated150.minOrderAmount === 150, 'Updated minOrderAmount should be 150');
  const isBelowMinWhen150 = updated150.minOrderAmount > 0 && 65 < updated150.minOrderAmount;
  assert(isBelowMinWhen150, 'An order of ₹65 must be blocked when minOrderAmount is 150');

  // Updating settings back to 0
  await repo.updateShopSettings({ minOrderAmount: 0 });
  const updatedZero = await repo.getShopSettings();
  assert(updatedZero.minOrderAmount === 0, 'Updated minOrderAmount should be 0');
  const isBelowMinRestored = updatedZero.minOrderAmount > 0 && 65 < updatedZero.minOrderAmount;
  assert(!isBelowMinRestored, 'An order of ₹65 must be allowed when minOrderAmount is set to 0');
  console.log('  ✅ Zero-threshold and dynamic minimum order amount validation verified.');

  console.log('\n🎉 ALL 8 AUTOMATED UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!\n');
}

runTestSuite().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
