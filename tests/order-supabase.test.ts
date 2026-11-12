import assert from 'node:assert/strict';
import { getOrderTrackingPath, loadCustomerOrders, saveCustomerOrders } from '../src/services/orderTrackingStorage.js';
import { clearCheckoutIdempotencyKey, getCheckoutIdempotencyKey } from '../src/services/checkoutIdempotency.js';

async function runTests() {
  const supabaseEnvKeys = [
    'VITE_SUPABASE_URL',
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
  ];
  const previousEnv = new Map(supabaseEnvKeys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorageWrites: string[] = [];
  const localStorageData = new Map<string, string>();

  for (const key of supabaseEnvKeys) {
    delete process.env[key];
  }
  process.env.VITE_SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => localStorageData.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStorageWrites.push(key);
        localStorageData.set(key, value);
      },
      removeItem: (key: string) => localStorageData.delete(key),
      clear: () => localStorageData.clear(),
      key: () => null,
      length: 0
    } satisfies Storage
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { dispatchEvent: () => true }
  });

  try {
    const { api } = await import('../src/services/api.js');
    const { isSupabaseConfigured } = await import('../src/services/supabase.js');
    assert.equal(isSupabaseConfigured, true);

    console.log('▶ Guest checkout reuses its idempotency key for an identical retry');
    const firstCheckoutKey = getCheckoutIdempotencyKey('same-checkout-payload');
    assert.equal(getCheckoutIdempotencyKey('same-checkout-payload'), firstCheckoutKey);
    assert.notEqual(getCheckoutIdempotencyKey('changed-checkout-payload'), firstCheckoutKey);
    clearCheckoutIdempotencyKey();
    assert.notEqual(getCheckoutIdempotencyKey('same-checkout-payload'), firstCheckoutKey);

    console.log('▶ Customer tracking links reopen without embedding tokens in order records');
    const savedCustomerOrder = {
      id: 'local-order',
      orderNumber: 'CCC-20261112-123',
      customer: {
        name: 'Local Test',
        phone: '9848012345',
        address: '12 Market Road, Test Locality'
      },
      items: [],
      subtotal: 240,
      deliveryFee: 30,
      discount: 0,
      totalAmount: 270,
      paymentMethod: 'COD' as const,
      paymentStatus: 'Pending' as const,
      orderStatus: 'New' as const,
      statusHistory: [],
      createdAt: '2026-11-12T03:00:00.000Z',
      updatedAt: '2026-11-12T03:00:00.000Z',
      trackingToken: 'A'.repeat(43)
    };
    saveCustomerOrders([savedCustomerOrder]);
    assert.equal(
      JSON.stringify(JSON.parse(localStorageData.get('ccc_customer_orders') || '[]')).includes(savedCustomerOrder.trackingToken),
      false
    );
    assert.deepEqual(
      JSON.parse(localStorageData.get('ccc_order_tracking_tokens') || '{}'),
      { [savedCustomerOrder.orderNumber]: savedCustomerOrder.trackingToken }
    );
    const reopenedOrder = loadCustomerOrders()[0];
    assert.equal(reopenedOrder.trackingToken, savedCustomerOrder.trackingToken);
    assert.equal(
      getOrderTrackingPath(reopenedOrder.orderNumber, reopenedOrder.trackingToken),
      `/order-status/${encodeURIComponent(reopenedOrder.orderNumber)}#token=${encodeURIComponent(savedCustomerOrder.trackingToken)}`
    );
    localStorageData.set('ccc_customer_orders', JSON.stringify([savedCustomerOrder]));
    localStorageData.delete('ccc_order_tracking_tokens');
    const migratedOrder = loadCustomerOrders()[0];
    assert.equal(migratedOrder.trackingToken, savedCustomerOrder.trackingToken);
    assert.equal(
      JSON.stringify(JSON.parse(localStorageData.get('ccc_customer_orders') || '[]')).includes(savedCustomerOrder.trackingToken),
      false
    );
    localStorageWrites.length = 0;

    const payload = {
      customer: {
        name: 'Local Test',
        phone: '9848012345',
        address: '12 Market Road, Test Locality',
        landmark: 'Near Test Park',
        notes: 'Local automated test',
        latitude: 17.4,
        longitude: 78.4,
        coordinatesConfirmed: true,
        googleMapsUrl: 'https://www.google.com/maps?q=17.4,78.4'
      },
      items: [{
        productId: 'prod-curry-cut',
        weight: '1kg' as const,
        cutPreference: 'Standard Cut',
        quantity: 1
      }],
      paymentMethod: 'COD' as const,
      idempotencyKey: 'local-supabase-order-test'
    };

    let functionAttempts = 0;
    let fallbackAttempts = 0;
    let directOrderInsertAttempts = 0;
    let functionPayload: Record<string, unknown> | undefined;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/functions/v1/create-guest-order')) {
        functionAttempts++;
        functionPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Response.json({ error: 'The shop is currently closed.' }, { status: 409 });
      }
      if (url.includes('/rest/v1/orders') && init?.method === 'POST') {
        directOrderInsertAttempts++;
        return Response.json({ message: 'Unexpected direct insert' }, { status: 400 });
      }
      if (url === '/api/orders') {
        fallbackAttempts++;
        return Response.json({ success: true, order: {} }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${url}`);
    };

    console.log('▶ Supabase Edge Function validation errors stop before fallback or success');
    await assert.rejects(api.createOrder(payload), /shop is currently closed/i);
    assert.equal(functionAttempts, 1);
    assert.equal(functionPayload?.paymentMethod, 'COD');
    assert.equal(directOrderInsertAttempts, 0, 'Configured checkout must not insert orders from the browser.');
    assert.equal(fallbackAttempts, 0, 'Function failures must not call the unavailable Vercel API route.');
    assert.equal(localStorageWrites.includes('ccc_customer_orders'), false);

    const returnedOrder = {
      id: 'ord-server-confirmed',
      order_number: 'CCC-20261111-101',
      customer: payload.customer,
      items: [{
        product_id: 'prod-curry-cut',
        product_name: 'Fresh Chicken',
        weight: '1kg',
        cut_preference: 'Curry Cut',
        unit_price: 240,
        quantity: 1,
        subtotal: 240
      }],
      subtotal: 240,
      delivery_fee: 30,
      discount: 0,
      total_amount: 270,
      payment_method: 'COD',
      payment_status: 'Pending',
      order_status: 'New',
      status_history: [{ status: 'New', timestamp: '2026-11-11T12:00:00.000Z' }],
      idempotency_key: payload.idempotencyKey,
      order_source: 'website',
      is_manual: false,
      created_at: '2026-11-11T12:00:00.000Z',
      updated_at: '2026-11-11T12:00:00.000Z'
    };
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/functions/v1/create-guest-order')) {
        functionAttempts++;
        functionPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Response.json({
          success: true,
          order: returnedOrder,
          trackingToken: 'A'.repeat(43)
        }, { status: 201 });
      }
      if (url.includes('/rest/v1/orders') && init?.method === 'POST') {
        directOrderInsertAttempts++;
      }
      if (url === '/api/orders') fallbackAttempts++;
      throw new Error(`Unexpected request: ${url}`);
    };

    console.log('▶ Confirmed Edge Function response preserves order tracking fields');
    const savedOrder = await api.createOrder(payload);
    assert.equal(savedOrder.id, returnedOrder.id);
    assert.equal(savedOrder.orderNumber, returnedOrder.order_number);
    assert.equal(savedOrder.customer.latitude, payload.customer.latitude);
    assert.equal(savedOrder.customer.longitude, payload.customer.longitude);
    assert.equal(savedOrder.paymentMethod, 'COD');
    assert.equal(savedOrder.orderSource, 'website');
    assert.equal(savedOrder.isManual, false);
    assert.equal(savedOrder.trackingToken, 'A'.repeat(43));
    assert.equal(functionAttempts, 2);
    assert.equal(directOrderInsertAttempts, 0);
    assert.equal(fallbackAttempts, 0);

    let trackingPayload: Record<string, unknown> | undefined;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/functions/v1/track-order')) {
        trackingPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Response.json({ success: true, order: {
          order_number: 'CCC-20261111-101',
          order_status: 'Preparing',
          status_history: [{
            status: 'Preparing',
            timestamp: '2026-11-11T12:00:00.000Z',
            note: 'Private kitchen instruction'
          }],
          created_at: '2026-11-11T12:00:00.000Z',
          estimated_delivery_time: '45 mins'
        } });
      }
      throw new Error(`Unexpected request: ${url}`);
    };
    console.log('▶ Public tracking strips private status-history notes');
    const trackedOrder = await api.getOrder('CCC-20261111-101', 'A'.repeat(43));
    assert.equal(trackingPayload?.orderNumber, 'CCC-20261111-101');
    assert.equal(trackingPayload?.trackingToken, 'A'.repeat(43));
    assert.deepEqual(trackedOrder.statusHistory, [{
      status: 'Preparing',
      timestamp: '2026-11-11T12:00:00.000Z'
    }]);
    assert.deepEqual(trackedOrder.customer, { name: '', phone: '', address: '', landmark: '' });
    assert.deepEqual(trackedOrder.items, []);

    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/functions/v1/track-order')) {
        const legacyPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        assert.equal(legacyPayload.orderNumber, 'CCC-20261020-123');
        assert.equal(legacyPayload.customerPhone, '9848012345');
        return Response.json({
          success: true,
          order: {
            order_number: 'CCC-20261020-123',
            order_status: 'Delivered',
            status_history: [],
            created_at: '2026-10-20T11:00:00.000Z',
            estimated_delivery_time: '45 mins'
          }
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    };
    console.log('▶ Legacy tracking sends both order number and phone verification');
    const legacyOrder = await api.getOrder('CCC-20261020-123', undefined, '9848012345');
    assert.equal(legacyOrder.orderNumber, 'CCC-20261020-123');
    assert.deepEqual(legacyOrder.customer, { name: '', phone: '', address: '', landmark: '' });

    localStorageData.delete('ccc_customer_orders');
    localStorageData.delete('ccc_order_tracking_tokens');
    globalThis.fetch = async input => {
      throw new Error(`Configured customer history must not call a backend route: ${String(input)}`);
    };
    console.log('▶ Configured customer order history remains local and does not use phone-only lookup');
    assert.deepEqual(await api.getCustomerOrdersByPhone('9848012345'), []);

    let orderApiFallbackCalls = 0;
    globalThis.fetch = async input => {
      const url = String(input);
      if (url.includes('/rest/v1/rpc/get_order_by_reference')) {
        return Response.json([]);
      }
      if (url.startsWith('/api/orders')) orderApiFallbackCalls++;
      throw new Error(`Unexpected request: ${url}`);
    };
    console.log('▶ Configured tracking does not fall back to a legacy API route');
    await assert.rejects(api.getOrder('CCC-20261111-999'), /secure tracking link|phone number/i);
    assert.equal(orderApiFallbackCalls, 0);

    globalThis.fetch = async input => {
      const url = String(input);
      if (url.includes('/rest/v1/orders')) {
        return Response.json({ message: 'Not authorized' }, { status: 401 });
      }
      if (url.startsWith('/api/admin/orders')) orderApiFallbackCalls++;
      throw new Error(`Unexpected request: ${url}`);
    };
    console.log('▶ Configured admin order reads do not fall back to a legacy API route');
    await assert.rejects(api.getAdminOrders(), /Supabase/i);
    assert.equal(orderApiFallbackCalls, 0);

    console.log('▶ Variant stock changes only report success after the primary product row is saved');
    let primaryProductWrites = 0;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (url.includes('/rest/v1/products') && method === 'GET') {
        return Response.json({
          id: 'prod-curry-cut',
          weights: [
            { weight: '250g', price: 65, inStock: true },
            { weight: '500g', price: 125, inStock: true }
          ]
        });
      }
      if (url.includes('/rest/v1/products') && method === 'PATCH') {
        primaryProductWrites++;
        return Response.json({ id: 'prod-curry-cut' });
      }
      if (url.includes('/rest/v1/product_weights')) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected variant-stock request: ${method} ${url}`);
    };
    await api.updateWeightStock('prod-curry-cut', '250g', false);
    assert.equal(primaryProductWrites, 1);

    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (url.includes('/rest/v1/products') && method === 'GET') {
        return Response.json({
          id: 'prod-curry-cut',
          weights: [{ weight: '250g', price: 65, inStock: true }]
        });
      }
      if (url.includes('/rest/v1/products') && method === 'PATCH') {
        return Response.json({ message: 'new row violates row-level security policy', code: '42501' }, { status: 403 });
      }
      throw new Error(`Unexpected failed variant-stock request: ${method} ${url}`);
    };
    await assert.rejects(
      api.updateWeightStock('prod-curry-cut', '250g', false),
      /Unable to save stock or price changes:.*row-level security/i
    );

    console.log('▶ UPI session helper never fabricates a merchant payment URI or success response');
    await assert.rejects(
      api.getUpiSession('test-order', 25000),
      /UPI payments are not active yet.*Cash on Delivery/i
    );

    console.log('▶ Configured production catalogue reads never fall back to demo/local products after an RLS error');
    let legacyCatalogueFallbackCalls = 0;
    globalThis.fetch = async input => {
      const url = String(input);
      if (url.includes('/rest/v1/products')) {
        return Response.json({ message: 'permission denied by row-level security', code: '42501' }, { status: 403 });
      }
      if (url.includes('/api/products')) {
        legacyCatalogueFallbackCalls++;
        return Response.json({ success: true, products: [] });
      }
      throw new Error(`Unexpected production catalogue request: ${url}`);
    };
    await assert.rejects(api.getProducts(), /Unable to load products from Supabase:.*permission denied/i);
    assert.equal(legacyCatalogueFallbackCalls, 0);

    console.log('▶ An empty Supabase catalogue remains empty instead of displaying seeded demo products');
    globalThis.fetch = async input => {
      const url = String(input);
      if (url.includes('/rest/v1/products')) return Response.json([]);
      if (url.includes('/rest/v1/categories')) return Response.json([]);
      if (url.includes('/api/products') || url.includes('/api/categories')) {
        legacyCatalogueFallbackCalls++;
        return Response.json({ success: true, products: [], categories: [] });
      }
      throw new Error(`Unexpected empty catalogue request: ${url}`);
    };
    assert.deepEqual(await api.getProducts(), []);
    assert.deepEqual(await api.getAdminProducts(), []);
    assert.deepEqual(await api.getCategories(), []);
    assert.equal(legacyCatalogueFallbackCalls, 0);

    console.log('▶ Configured shop settings reads fail visibly instead of using stale cached settings');
    localStorageData.set('ccc_cached_settings', JSON.stringify({ minOrderAmount: 150 }));
    let legacySettingsFallbackCalls = 0;
    globalThis.fetch = async input => {
      const url = String(input);
      if (url.includes('/rest/v1/shop_settings')) {
        return Response.json({ message: 'permission denied by row-level security', code: '42501' }, { status: 403 });
      }
      if (url.includes('/api/settings')) legacySettingsFallbackCalls++;
      throw new Error(`Unexpected production settings request: ${url}`);
    };
    await assert.rejects(api.getShopSettings(), /Unable to load shop settings from Supabase:.*permission denied/i);
    assert.equal(legacySettingsFallbackCalls, 0);

    console.log('✅ Supabase Edge Function order persistence tests passed.');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

runTests().catch(error => {
  console.error('❌ Supabase Edge Function order tests failed:', error);
  process.exitCode = 1;
});
