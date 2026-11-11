import assert from 'node:assert/strict';

async function runTests() {
  const supabaseEnvKeys = [
    'VITE_SUPABASE_URL',
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  const previousEnv = new Map(supabaseEnvKeys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorageWrites: string[] = [];

  for (const key of supabaseEnvKeys) {
    delete process.env[key];
  }
  process.env.VITE_SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: (key: string) => localStorageWrites.push(key),
      removeItem: () => undefined,
      clear: () => undefined,
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

    let orderInsertAttempts = 0;
    let fallbackAttempts = 0;
    const insertedPayloads: Record<string, unknown>[][] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/rest/v1/shop_settings')) {
        return Response.json([]);
      }
      if (url.startsWith('/api/settings')) {
        return new Response('', { status: 404 });
      }
      if (url.includes('/rest/v1/orders') && init?.method === 'POST') {
        orderInsertAttempts++;
        insertedPayloads.push(JSON.parse(String(init.body)) as Record<string, unknown>[]);
        return Response.json(
          { code: 'PGRST204', message: "Could not find the 'order_source' column in the schema cache" },
          { status: 400 }
        );
      }
      if (url === '/api/orders') {
        fallbackAttempts++;
        return Response.json({ success: true, order: {} }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${url}`);
    };

    console.log('▶ Supabase order rejection stops before fallback or success');
    await assert.rejects(
      api.createOrder(payload),
      /Supabase error PGRST204/
    );
    assert.equal(orderInsertAttempts, 1);
    assert.equal(fallbackAttempts, 0, 'Supabase failures must not call the unavailable Vercel API route.');
    assert.equal(localStorageWrites.includes('ccc_customer_orders'), false);

    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/rest/v1/shop_settings')) {
        return Response.json([]);
      }
      if (url.startsWith('/api/settings')) {
        return new Response('', { status: 404 });
      }
      if (url.includes('/rest/v1/orders') && init?.method === 'POST') {
        orderInsertAttempts++;
        insertedPayloads.push(JSON.parse(String(init.body)) as Record<string, unknown>[]);
        return new Response(null, { status: 201 });
      }
      if (url === '/api/orders') {
        fallbackAttempts++;
        return Response.json({ success: true, order: {} }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${url}`);
    };

    console.log('▶ Confirmed Supabase insert returns order tracking identifiers and checkout fields');
    const savedOrder = await api.createOrder(payload);
    const insertedPayload = insertedPayloads[insertedPayloads.length - 1][0];
    assert.ok(insertedPayload);
    assert.match(savedOrder.id, /^ord-/);
    assert.match(savedOrder.orderNumber, /^CCC-\d{8}-\d{3}$/);
    assert.equal(savedOrder.customer.latitude, payload.customer.latitude);
    assert.equal(savedOrder.customer.longitude, payload.customer.longitude);
    assert.equal(savedOrder.customer.address, payload.customer.address);
    assert.equal(savedOrder.paymentMethod, 'COD');
    assert.equal(insertedPayload.order_source, 'website');
    assert.equal(insertedPayload.is_manual, false);
    assert.equal(insertedPayload.id, savedOrder.id);
    assert.equal(insertedPayload.order_number, savedOrder.orderNumber);
    assert.equal(fallbackAttempts, 0);

    console.log('✅ Supabase order persistence tests passed.');
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
  console.error('❌ Supabase order persistence tests failed:', error);
  process.exitCode = 1;
});
