import assert from 'node:assert/strict';
import type { Order } from '../src/types/index.js';

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

  for (const key of supabaseEnvKeys) {
    delete process.env[key];
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => undefined,
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
    const { getOrdersForKolkataDate } = await import('../src/admin/AdminDashboardPage.js');
    assert.equal(isSupabaseConfigured, false, 'Tests must not connect to Supabase.');

    const customerOrder = {
      customer: {
        name: 'Test Customer',
        phone: '9848012345',
        address: '12 Market Road, Test Locality'
      },
      items: [{
        productId: 'prod-curry-cut',
        weight: '1kg' as const,
        cutPreference: 'Standard Cut',
        quantity: 1
      }],
      paymentMethod: 'COD' as const
    };
    const persistedOrder = {
      id: 'ord-fallback-test',
      orderNumber: 'CCC-20261110-901',
      customer: customerOrder.customer,
      items: [],
      subtotal: 240,
      deliveryFee: 30,
      discount: 0,
      totalAmount: 270,
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      orderStatus: 'New',
      statusHistory: [],
      createdAt: '2026-11-10T18:00:00.000Z',
      updatedAt: '2026-11-10T18:00:00.000Z'
    };

    console.log('▶ Order persistence: successful fallback API response');
    globalThis.fetch = async input => {
      const url = String(input);
      if (url.startsWith('/api/settings')) {
        return new Response('', { status: 404 });
      }
      if (url === '/api/orders') {
        return Response.json({ success: true, order: persistedOrder }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${url}`);
    };
    const savedOrder = await api.createOrder(customerOrder);
    assert.equal(savedOrder.id, persistedOrder.id);
    assert.equal(savedOrder.orderNumber, persistedOrder.orderNumber);

    console.log('▶ Order persistence: failed fallback rejects instead of returning a local order');
    globalThis.fetch = async input => {
      const url = String(input);
      if (url.startsWith('/api/settings')) {
        return new Response('', { status: 404 });
      }
      if (url === '/api/orders') {
        return Response.json({ success: false, error: 'Database unavailable' }, { status: 503 });
      }
      throw new Error(`Unexpected request: ${url}`);
    };
    await assert.rejects(api.createOrder(customerOrder), /Database unavailable/);

    let publicReferenceLookups = 0;
    globalThis.fetch = async input => {
      if (String(input).includes('/api/orders/')) publicReferenceLookups++;
      throw new Error('Public order-number lookup must remain local only.');
    };
    console.log('▶ Public reference alone does not call a legacy order lookup route');
    await assert.rejects(api.getOrder('CCC-20261110-901'), /secure tracking link|not saved in this browser/i);
    assert.equal(publicReferenceLookups, 0);

    console.log('▶ Dashboard order snapshot: shared IST date filtering');
    const todayKolkata = '2026-11-10';
    const orders = [
      { ...persistedOrder, id: 'before-midnight-utc', createdAt: '2026-11-09T18:35:00.000Z' },
      { ...persistedOrder, id: 'after-today-utc', createdAt: '2026-11-10T18:31:00.000Z' }
    ] as Order[];
    const todaysOrders = getOrdersForKolkataDate(orders, todayKolkata);
    assert.deepEqual(todaysOrders.map(order => order.id), ['before-midnight-utc']);
    assert.equal(todaysOrders.length, 1, 'KPI count must be derived from the same filtered order list.');

    console.log('✅ Targeted order persistence and dashboard date tests passed.');
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
  console.error('❌ Targeted order/dashboard tests failed:', error);
  process.exitCode = 1;
});
