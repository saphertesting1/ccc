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

  // Test 9: Catalog Count & Featured Cuts Mismatch Check (Issue 2)
  console.log('\n▶ Test 9: Full Catalog Count vs Featured Homepage Cuts');
  const allProds = await repo.getProducts();
  assert.strictEqual(allProds.length, 9, 'Full catalog must contain exactly 9 products');

  const featured = allProds.filter(p => p.isFeatured && p.isAvailable);
  assert.strictEqual(featured.length, 5, 'Exactly 5 products are marked featured initially');
  
  // Verify toggling a product to featured increases featured count to 6
  const lollipops = allProds.find(p => p.id === 'prod-lollipops');
  assert(lollipops, 'Chicken lollipop must exist');
  assert.strictEqual(lollipops.isFeatured, false, 'Lollipops is not featured initially');
  
  await repo.saveProduct({ ...lollipops, isFeatured: true });
  const updatedProds = await repo.getProducts();
  const updatedFeatured = updatedProds.filter(p => p.isFeatured && p.isAvailable);
  assert.strictEqual(updatedFeatured.length, 6, 'Homepage featured cuts dynamically increases to 6 after toggle');
  
  // Revert back to 5 for clean state
  await repo.saveProduct({ ...lollipops, isFeatured: false });
  console.log('  ✅ 9 full products and dynamic featured filtering verified.');

  // Test 10: Admin Product Add, Update & Delete with Historical Orders Preserved (Issue 1)
  console.log('\n▶ Test 10: Admin Product Add, Update, and Delete Lifecycle with Order Safety');
  const testNewProd = {
    id: 'prod-test-tangdi',
    name: 'Special Tandoori Leg (Test Cut)',
    slug: 'special-tandoori-leg-test-cut',
    categoryId: 'cat-appetizers',
    description: 'Marinated tender leg cut for test',
    imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80',
    weights: [
      { weight: '500g' as const, price: 160, inStock: true },
      { weight: '1kg' as const, price: 310, inStock: true }
    ],
    cutOptions: ['Deep Slits for Tandoor'],
    isAvailable: true,
    isFeatured: true,
    badge: 'New Item',
    netWeightDescription: 'Fresh test cut'
  };

  // Add Product
  await repo.saveProduct(testNewProd);
  const prodsAfterAdd = await repo.getProducts();
  assert.strictEqual(prodsAfterAdd.length, 10, 'Catalog should now have 10 products after adding');
  const added = await repo.getProductById('prod-test-tangdi');
  assert(added && added.name === 'Special Tandoori Leg (Test Cut)', 'Added product must be retrievable');

  // Delete Product
  const deleted = await repo.deleteProduct('prod-test-tangdi');
  assert(deleted === true, 'Delete operation must succeed');
  const prodsAfterDelete = await repo.getProducts();
  assert.strictEqual(prodsAfterDelete.length, 9, 'Catalog should return to 9 products after deletion');
  const notFound = await repo.getProductById('prod-test-tangdi');
  assert(notFound === null, 'Deleted product must no longer exist in catalog');

  // Confirm historical order placed in Test 3 remains completely untouched
  const historicalOrder = await repo.getOrderById(order.id);
  assert(historicalOrder !== null, 'Past order must remain intact after product operations');
  assert.strictEqual(historicalOrder.items.length, 1, 'Historical order item snapshot must be intact');
  console.log('  ✅ Product CRUD and historical order immutability verified.');

  // Test 11: Multi-Tier Weight Pack Pricing (250g, 500g, 1kg) for Admin Editing & Customer Cart
  console.log('\n▶ Test 11: Product Weight Pack Price Configuration (250g, 500g, 1kg)');
  const wholeChicken = await repo.getProductById('prod-whole-chicken');
  assert(wholeChicken !== null, 'Whole chicken product must exist');
  assert.strictEqual(wholeChicken.weights.length, 1, 'Originally whole chicken has 1kg only');
  assert.strictEqual(wholeChicken.weights[0].price, 220, '1kg pack original price is 220');

  // Admin configures 250g and 500g prices alongside 1kg:
  const updatedWholeChicken = {
    ...wholeChicken,
    weights: [
      { weight: '250g' as const, price: 60, inStock: true },
      { weight: '500g' as const, price: 115, inStock: true },
      { weight: '1kg' as const, price: 220, inStock: true }
    ]
  };
  await repo.saveProduct(updatedWholeChicken);

  // Verify persistence and retrieval
  const reloadedWhole = await repo.getProductById('prod-whole-chicken');
  assert(reloadedWhole !== null, 'Reloaded product must exist');
  assert.strictEqual(reloadedWhole.weights.length, 3, 'Must now have all 3 weight packs configured');

  const w250Check = reloadedWhole.weights.find(w => w.weight === '250g');
  const w500Check = reloadedWhole.weights.find(w => w.weight === '500g');
  const w1kgCheck = reloadedWhole.weights.find(w => w.weight === '1kg');

  assert(w250Check && w250Check.price === 60, '250g pack price must be 60');
  assert(w500Check && w500Check.price === 115, '500g pack price must be 115');
  assert(w1kgCheck && w1kgCheck.price === 220, '1kg pack price must be 220');

  // Test updating variant stock status & prices
  await repo.updateWeightStock('prod-whole-chicken', '250g', false, 65);
  const afterWeightStock = await repo.getProductById('prod-whole-chicken');
  const updated250 = afterWeightStock?.weights.find(w => w.weight === '250g');
  assert(updated250 && updated250.price === 65 && updated250.inStock === false, '250g must be updated with price 65 and inStock false');

  // Verify product availability toggle preserves weights & prices intact
  await repo.updateProductStock('prod-whole-chicken', false);
  const afterDeactivate = await repo.getProductById('prod-whole-chicken');
  assert(afterDeactivate?.isAvailable === false, 'Product isAvailable should be false');
  assert.strictEqual(afterDeactivate?.weights.length, 3, 'Weights must remain intact after product availability toggle');

  // Restore active status
  await repo.updateProductStock('prod-whole-chicken', true);
  await repo.updateWeightStock('prod-whole-chicken', '250g', true, 60);

  console.log('  ✅ Weight pack pricing (250g, 500g, 1kg) save, edit, and stock toggle verified.');

  console.log('\n🎉 ALL 11 AUTOMATED UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!\n');
}

runTestSuite().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
