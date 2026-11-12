import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createAdminManualOrderHandler,
  createGuestOrderHandler,
  createOrderTrackingHandler,
  createTrackingCredential,
  redactPublicStatusHistory,
  type CatalogProduct,
  type OrderTrackingStore,
  type OrderStore
} from '../supabase/functions/_shared/order-handlers.ts';
import { getDefaultApiKey } from '../supabase/functions/_shared/supabase-api-keys.ts';

const catalog: CatalogProduct[] = [{
  id: 'product-a',
  name: 'Fresh Chicken',
  is_available: true,
  weights: [{ weight: '1kg', price: 100, inStock: true }],
  cut_options: ['Curry Cut', 'Biryani Cut']
}];

function createStore(overrides: Partial<OrderStore> = {}) {
  const insertedCustomerOrders: Record<string, unknown>[] = [];
  const insertedManualOrders: Array<{
    order: Record<string, unknown>;
    adminUserId: string;
    auditMetadata: Record<string, unknown>;
  }> = [];
  const store: OrderStore = {
    async getSettings() {
      return {
        is_open: true,
        delivery_fee: 30,
        free_delivery_threshold: 500,
        min_order_amount: 0,
        delivery_time_estimate_mins: 45
      };
    },
    async getProducts(ids) {
      return catalog.filter(product => ids.includes(product.id));
    },
    async insertCustomerOrder(order) {
      insertedCustomerOrders.push(order);
      return order;
    },
    async insertManualOrder(order, adminUserId, auditMetadata) {
      insertedManualOrders.push({ order, adminUserId, auditMetadata });
      return order;
    },
    async authorizeAdmin() {
      return null;
    },
    now: () => new Date('2026-11-11T12:00:00.000Z'),
    makeId: () => 'ord-test-1',
    makeOrderNumber: () => 'CCC-20261111-101',
    ...overrides
  };
  return { store, insertedCustomerOrders, insertedManualOrders };
}

function post(payload: Record<string, unknown>, authorization?: string): Request {
  return new Request('https://edge.example.test/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {})
    },
    body: JSON.stringify(payload)
  });
}

async function runTests() {
  console.log('▶ Supabase Edge Function key maps use only a valid default key');
  {
    assert.equal(getDefaultApiKey('{"default":"test-publishable-key"}'), 'test-publishable-key');
    assert.equal(getDefaultApiKey('{"default":"test-secret-key"}'), 'test-secret-key');
    assert.throws(() => getDefaultApiKey(undefined), /configuration is incomplete/);
    assert.throws(() => getDefaultApiKey('{invalid json'), /configuration is invalid/);
    assert.throws(() => getDefaultApiKey('{"other":"test-key"}'), /configuration is invalid/);
  }

  console.log('▶ Guest checkout uses database prices and recalculates totals');
  {
    const { store, insertedCustomerOrders } = createStore();
    const handler = createGuestOrderHandler(store);
    const response = await handler(post({
      customer: { name: 'Test Customer', phone: '0000000000', address: 'Test address' },
      items: [{
        productId: 'product-a',
        weight: '1kg',
        cutPreference: 'Curry Cut',
        quantity: 2,
        unitPrice: 1
      }],
      paymentMethod: 'COD',
      subtotal: 2,
      deliveryFee: 0,
      totalAmount: 2
    }));
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(insertedCustomerOrders.length, 1);
    const savedOrder = insertedCustomerOrders[0];
    assert.match(String(savedOrder.tracking_token_hash), /^[a-f0-9]{64}$/);
    assert.match(body.trackingToken, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(savedOrder.tracking_token_hash, body.trackingToken);
    assert.equal('tracking_token_hash' in body.order, false);
    assert.equal(body.order.items[0].unit_price, 100);
    assert.equal(body.order.subtotal, 200);
    assert.equal(body.order.delivery_fee, 30);
    assert.equal(body.order.total_amount, 230);
  }

  console.log('▶ Guest checkout rejects unknown products and invalid quantities');
  {
    const { store, insertedCustomerOrders } = createStore();
    const handler = createGuestOrderHandler(store);
    const basePayload = {
      customer: { name: 'Test Customer', phone: '0000000000', address: 'Test address' },
      paymentMethod: 'COD'
    };
    const unknownProductResponse = await handler(post({
      ...basePayload,
      items: [{ productId: 'missing-product', weight: '1kg', quantity: 1 }]
    }));
    assert.equal(unknownProductResponse.status, 400);
    assert.match((await unknownProductResponse.json()).error, /unavailable/);

    const invalidQuantityResponse = await handler(post({
      ...basePayload,
      items: [{ productId: 'product-a', weight: '1kg', quantity: 1.5 }]
    }));
    assert.equal(invalidQuantityResponse.status, 400);
    assert.match((await invalidQuantityResponse.json()).error, /positive integer/);
    assert.equal(insertedCustomerOrders.length, 0);
  }

  console.log('▶ Manual orders reject requests without authorized admin membership');
  {
    const { store, insertedManualOrders } = createStore();
    const handler = createAdminManualOrderHandler(store);
    const response = await handler(post({
      customer: { name: 'Walk-in Customer' },
      orderType: 'Walk-in',
      items: [{ productId: 'product-a', weight: '1kg', quantity: 1, unitPrice: 80 }]
    }, 'Bearer invalid'));
    assert.equal(response.status, 401);
    assert.equal(insertedManualOrders.length, 0);
  }

  console.log('▶ Authorized manual rates are recalculated and recorded in audit metadata');
  {
    const { store, insertedManualOrders } = createStore({
      async authorizeAdmin() {
        return { id: 'admin-user-1' };
      }
    });
    const handler = createAdminManualOrderHandler(store);
    const response = await handler(post({
      customer: { name: 'Walk-in Customer' },
      orderType: 'Walk-in',
      items: [{
        productId: 'product-a',
        weight: '1kg',
        cutPreference: 'Curry Cut',
        quantity: 2,
        unitPrice: 75,
        subtotal: 1
      }],
      paymentMethod: 'Cash',
      paymentStatus: 'Paid',
      orderStatus: 'Accepted',
      deliveryFee: 0,
      discount: 0,
      totalAmount: 1
    }, 'Bearer valid'));
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(insertedManualOrders.length, 1);
    const saved = insertedManualOrders[0];
    assert.equal(saved.adminUserId, 'admin-user-1');
    assert.equal(saved.order.subtotal, 150);
    assert.equal(saved.order.total_amount, 150);
    assert.equal(saved.auditMetadata.items instanceof Array, true);
    const auditedItem = (saved.auditMetadata.items as Array<Record<string, unknown>>)[0];
    assert.equal(auditedItem.catalogUnitPrice, 100);
    assert.equal(auditedItem.chargedUnitPrice, 75);
    assert.equal(auditedItem.overridden, true);
    assert.equal(body.order.is_manual, true);
    assert.equal(body.order.order_source, 'manual');
    assert.match(body.trackingToken, /^[A-Za-z0-9_-]{43}$/);
    assert.match(String(saved.order.tracking_token_hash), /^[a-f0-9]{64}$/);
    const tokenDigest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(body.trackingToken)
    );
    assert.equal(
      saved.order.tracking_token_hash,
      Array.from(new Uint8Array(tokenDigest), byte => byte.toString(16).padStart(2, '0')).join('')
    );
    assert.equal('tracking_token_hash' in body.order, false);
  }

  console.log('▶ Bootstrap and migrations persist a validated manual tracking-token hash');
  for (const file of [
    '../supabase-setup.sql',
    '../supabase/migrations/20261111170400_secure_order_creation.sql',
    '../supabase/migrations/20261112090000_order_tracking_tokens.sql'
  ]) {
    const sql = readFileSync(new URL(file, import.meta.url), 'utf8');
    const rpc = sql.match(/CREATE OR REPLACE FUNCTION public\.create_manual_order_with_audit[\s\S]*?\n\$\$;/)?.[0];
    assert.ok(rpc, `${file} defines the manual-order RPC`);
    assert.match(rpc, /tracking_token_hash,\s*created_at/);
    assert.match(rpc, /p_order->>'tracking_token_hash',\s*\(p_order->>'created_at'\)/);
    assert.match(rpc, /coalesce\(p_order->>'tracking_token_hash', ''\) !~ '\^\[a-f0-9\]\{64\}\$'/);
  }

  console.log('▶ Public tracking history strips private notes and unknown fields');
  {
    const publicHistory = redactPublicStatusHistory([{
      status: 'Preparing',
      timestamp: '2026-11-11T12:00:00.000Z',
      note: 'Internal kitchen note',
      admin_user_id: 'private-id'
    }]);
    assert.deepEqual(publicHistory, [{
      status: 'Preparing',
      timestamp: '2026-11-11T12:00:00.000Z'
    }]);
  }

  console.log('▶ Tracking credentials have high entropy and are persisted only as hashes');
  const credentials = await Promise.all(Array.from({ length: 20 }, () => createTrackingCredential()));
  assert.ok(credentials.every(({ token, hash }) =>
    /^[A-Za-z0-9_-]{43}$/.test(token) &&
    /^[a-f0-9]{64}$/.test(hash) &&
    hash !== token
  ));
  assert.equal(new Set(credentials.map(({ token }) => token)).size, credentials.length);

  console.log('▶ Tracking token lookup returns only privacy-safe fields');
  {
    const credential = await createTrackingCredential();
    let queriedHash = '';
    const trackingStore: OrderTrackingStore = {
      async getOrderByTrackingHash(hash) {
        queriedHash = hash;
        return {
          id: 'private-id',
          order_number: 'CCC-20261111-101',
          order_status: 'Preparing',
          status_history: [{
            status: 'Preparing',
            timestamp: '2026-11-11T12:00:00.000Z',
            note: 'Private admin note'
          }],
          estimated_delivery_time: '45 mins',
          created_at: '2026-11-11T11:00:00.000Z'
        };
      },
      async getLegacyOrderByNumber() {
        return null;
      },
      async verifyLegacyPhone() {
        return false;
      }
    };
    const handler = createOrderTrackingHandler(trackingStore);
    const response = await handler(post({
      trackingToken: credential.token,
      orderNumber: 'CCC-20261111-101'
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(queriedHash, credential.hash);
    assert.deepEqual(Object.keys(body.order).sort(), [
      'created_at',
      'estimated_delivery_time',
      'order_number',
      'order_status',
      'status_history'
    ]);
    assert.deepEqual(body.order.status_history, [{
      status: 'Preparing',
      timestamp: '2026-11-11T12:00:00.000Z'
    }]);
  }

  console.log('▶ Guessed or mismatched tracking tokens are rejected');
  {
    let lookupCount = 0;
    const trackingStore: OrderTrackingStore = {
      async getOrderByTrackingHash() {
        lookupCount++;
        return null;
      },
      async getLegacyOrderByNumber() {
        return null;
      },
      async verifyLegacyPhone() {
        return false;
      }
    };
    const handler = createOrderTrackingHandler(trackingStore);
    const invalidTokenResponse = await handler(post({ trackingToken: 'A'.repeat(43) }));
    assert.equal(invalidTokenResponse.status, 404);
    assert.equal(lookupCount, 1);

    const credential = await createTrackingCredential();
    const mismatchStore: OrderTrackingStore = {
      ...trackingStore,
      async getOrderByTrackingHash() {
        return {
          id: 'id-1',
          order_number: 'CCC-20261111-101',
          order_status: 'New',
          status_history: [],
          estimated_delivery_time: null,
          created_at: '2026-11-11T11:00:00.000Z'
        };
      }
    };
    const mismatchResponse = await createOrderTrackingHandler(mismatchStore)(post({
      trackingToken: credential.token,
      orderNumber: 'CCC-20261111-999'
    }));
    assert.equal(mismatchResponse.status, 404);
  }

  console.log('▶ Legacy order numbers require matching phone and bounded attempts');
  {
    let attempts = 0;
    const legacyOrder = {
      id: 'legacy-id',
      customer: { phone: '+91 98480 12345' },
      tracking: {
        id: 'legacy-id',
        order_number: 'CCC-20261020-123',
        order_status: 'Delivered',
        status_history: [{
          status: 'Delivered',
          timestamp: '2026-10-20T12:00:00.000Z',
          note: 'Private delivery instruction'
        }],
        estimated_delivery_time: '45 mins',
        created_at: '2026-10-20T11:00:00.000Z'
      }
    };
    const trackingStore: OrderTrackingStore = {
      async getOrderByTrackingHash() {
        return null;
      },
      async getLegacyOrderByNumber(orderNumber) {
        return orderNumber === legacyOrder.tracking.order_number ? legacyOrder : null;
      },
      async verifyLegacyPhone(_orderId, phone) {
        if (attempts >= 8) return false;
        if (phone.replace(/\D/g, '') !== '9848012345') {
          attempts++;
          return false;
        }
        return true;
      }
    };
    const handler = createOrderTrackingHandler(trackingStore);
    const validResponse = await handler(post({
      orderNumber: 'CCC-20261020-123',
      customerPhone: '9848012345'
    }));
    const validBody = await validResponse.json();
    assert.equal(validResponse.status, 200);
    assert.equal(validBody.order.order_number, 'CCC-20261020-123');
    assert.equal('customer' in validBody.order, false);
    assert.equal('items' in validBody.order, false);
    assert.equal('total_amount' in validBody.order, false);
    assert.equal('payment_method' in validBody.order, false);
    assert.equal(JSON.stringify(validBody).includes('Private delivery instruction'), false);

    const invalidPhoneResponse = await handler(post({
      orderNumber: 'CCC-20261020-123',
      customerPhone: '9848012346'
    }));
    assert.equal(invalidPhoneResponse.status, 404);

    for (let attempt = 0; attempt < 7; attempt++) {
      await handler(post({
        orderNumber: 'CCC-20261020-123',
        customerPhone: '9848012346'
      }));
    }
    const rateLimitedResponse = await handler(post({
      orderNumber: 'CCC-20261020-123',
      customerPhone: '9848012345'
    }));
    assert.equal(rateLimitedResponse.status, 404);
    assert.equal(attempts, 8);
  }

  console.log('✅ Secure order function tests passed.');
}

runTests().catch(error => {
  console.error('❌ Secure order function tests failed:', error);
  process.exitCode = 1;
});
