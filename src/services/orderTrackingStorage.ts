import type { Order } from '../types/index.js';

const CUSTOMER_ORDERS_KEY = 'ccc_customer_orders';
const TRACKING_TOKENS_KEY = 'ccc_order_tracking_tokens';

type TrackingTokens = Record<string, string>;

function readTrackingTokens(): TrackingTokens {
  const raw = localStorage.getItem(TRACKING_TOKENS_KEY);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Saved order tracking data is invalid.');
  }
  const tokens: TrackingTokens = Object.create(null);
  for (const [orderNumber, token] of Object.entries(parsed)) {
    if (
      /^[A-Za-z0-9-]{1,64}$/.test(orderNumber) &&
      typeof token === 'string' &&
      /^[A-Za-z0-9_-]{43}$/.test(token)
    ) {
      tokens[orderNumber] = token;
    }
  }
  return tokens;
}

function persistTrackingTokens(tokens: TrackingTokens): void {
  localStorage.setItem(TRACKING_TOKENS_KEY, JSON.stringify(tokens));
}

export function getOrderTrackingPath(orderNumber: string, token?: string): string {
  const path = `/order-status/${encodeURIComponent(orderNumber)}`;
  return token ? `${path}#token=${encodeURIComponent(token)}` : path;
}

export function saveCustomerOrders(orders: Order[]): void {
  const savedTokens = readTrackingTokens();
  const tokens: TrackingTokens = Object.create(null);
  const storedOrders = orders.map(order => {
    const token = order.trackingToken || savedTokens[order.orderNumber];
    if (token) tokens[order.orderNumber] = token;
    const { trackingToken: _trackingToken, ...orderWithoutToken } = order;
    return orderWithoutToken;
  });
  persistTrackingTokens(tokens);
  localStorage.setItem(CUSTOMER_ORDERS_KEY, JSON.stringify(storedOrders));
}

export function loadCustomerOrders(): Order[] {
  const raw = localStorage.getItem(CUSTOMER_ORDERS_KEY);
  if (!raw) return [];
  const storedOrders: Order[] = JSON.parse(raw);
  const tokens = readTrackingTokens();
  let migratedEmbeddedTokens = false;
  const orders = storedOrders.map(order => {
    if (order.trackingToken && !tokens[order.orderNumber]) {
      tokens[order.orderNumber] = order.trackingToken;
      migratedEmbeddedTokens = true;
    }
    const { trackingToken: _trackingToken, ...orderWithoutToken } = order;
    const trackingToken = tokens[order.orderNumber];
    return trackingToken ? { ...orderWithoutToken, trackingToken } : orderWithoutToken;
  });
  if (migratedEmbeddedTokens) {
    persistTrackingTokens(tokens);
    localStorage.setItem(CUSTOMER_ORDERS_KEY, JSON.stringify(
      storedOrders.map(({ trackingToken: _trackingToken, ...order }) => order)
    ));
  }
  return orders;
}
