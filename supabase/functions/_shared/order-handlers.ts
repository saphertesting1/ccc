export type OrderWeight = '250g' | '500g' | '1kg';

export interface CatalogVariant {
  weight: string;
  price: number | string;
  inStock?: boolean;
  in_stock?: boolean;
}

export interface CatalogProduct {
  id: string;
  name: string;
  is_available: boolean;
  weights: CatalogVariant[] | string;
  cut_options?: string[] | string;
}

export interface ShopSettingsRecord {
  is_open: boolean;
  delivery_fee: number | string;
  free_delivery_threshold: number | string;
  min_order_amount: number | string;
  delivery_time_estimate_mins?: number | string;
}

export interface OrderStore {
  getSettings(): Promise<ShopSettingsRecord>;
  getProducts(ids: string[]): Promise<CatalogProduct[]>;
  insertCustomerOrder(order: Record<string, unknown>): Promise<Record<string, unknown>>;
  insertManualOrder(
    order: Record<string, unknown>,
    adminUserId: string,
    auditMetadata: Record<string, unknown>
  ): Promise<Record<string, unknown>>;
  authorizeAdmin(request: Request): Promise<{ id: string } | null>;
  now?(): Date;
  makeId?(): string;
  makeOrderNumber?(date: Date): string;
}

export interface TrackingOrder {
  id: string;
  order_number: string;
  order_status: string;
  status_history: unknown;
  estimated_delivery_time: string | null;
  created_at: string;
}

export interface OrderTrackingStore {
  getOrderByTrackingHash(hash: string): Promise<TrackingOrder | null>;
  getLegacyOrderByNumber(orderNumber: string): Promise<{
    id: string;
    tracking: TrackingOrder;
  } | null>;
  verifyLegacyPhone(orderId: string, phone: string): Promise<boolean>;
}

interface SubmittedItem {
  productId: string;
  weight: OrderWeight;
  cutPreference?: string;
  quantity: number;
  unitPrice?: number;
  unit_price?: number;
}

interface CustomerPayload {
  name: string;
  phone: string;
  address: string;
  landmark?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  coordinatesConfirmed?: boolean;
  googleMapsUrl?: string;
}

const ORDER_STATUSES = [
  'New',
  'Accepted',
  'Preparing',
  'Ready for Dispatch',
  'Out for Delivery',
  'Delivered',
  'Rejected',
  'Cancelled'
] as const;
const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'Refunded'] as const;
const PAYMENT_METHODS = ['COD', 'UPI', 'Cash'] as const;
const ORDER_TYPES = ['Walk-in', 'Phone Order', 'Home Delivery'] as const;
const MAX_AMOUNT_CENTS = 9_999_999_999;

export class OrderRequestError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = 'OrderRequestError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new OrderRequestError(`${label} is required.`);
  }
  return value.trim();
}

function cents(value: unknown, label: string): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new OrderRequestError(`${label} must be a non-negative amount.`);
  }
  const result = Math.round(amount * 100);
  if (!Number.isSafeInteger(result) || result > MAX_AMOUNT_CENTS) {
    throw new OrderRequestError(`${label} is outside the supported range.`);
  }
  return result;
}

function amount(centsValue: number): number {
  return centsValue / 100;
}

function parseVariants(value: CatalogProduct['weights']): CatalogVariant[] {
  let variants: unknown[] = [];
  if (Array.isArray(value)) {
    variants = value;
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      variants = Array.isArray(parsed) ? parsed : [];
    } catch {
      variants = [];
    }
  }
  return variants.filter((variant): variant is CatalogVariant =>
    isRecord(variant) &&
    typeof variant.weight === 'string' &&
    (typeof variant.price === 'number' || typeof variant.price === 'string') &&
    (variant.inStock === undefined || typeof variant.inStock === 'boolean') &&
    (variant.in_stock === undefined || typeof variant.in_stock === 'boolean')
  );
}

function parseCutOptions(value: CatalogProduct['cut_options']): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

function validateCustomer(value: unknown): CustomerPayload {
  if (!isRecord(value)) throw new OrderRequestError('Customer details are required.');

  const customer: CustomerPayload = {
    name: requiredText(value.name, 'Customer name'),
    phone: requiredText(value.phone, 'Customer phone'),
    address: requiredText(value.address, 'Delivery address')
  };
  for (const key of ['landmark', 'notes', 'googleMapsUrl'] as const) {
    const field = value[key];
    if (field !== undefined && typeof field !== 'string') {
      throw new OrderRequestError(`Customer ${key} must be text.`);
    }
    if (typeof field === 'string') customer[key] = field.trim();
  }

  const latitude = value.latitude;
  const longitude = value.longitude;
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new OrderRequestError('Both GPS coordinates must be provided together.');
  }
  if (latitude !== undefined || longitude !== undefined) {
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new OrderRequestError('GPS coordinates are invalid.');
    }
    customer.latitude = latitude;
    customer.longitude = longitude;
    customer.coordinatesConfirmed = value.coordinatesConfirmed === true;
    if (typeof value.googleMapsUrl === 'string') customer.googleMapsUrl = value.googleMapsUrl;
  }
  return customer;
}

function validateItems(value: unknown): SubmittedItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new OrderRequestError('At least one order item is required.');
  }

  return value.map((raw, index) => {
    if (!isRecord(raw)) throw new OrderRequestError(`Order item ${index + 1} is invalid.`);
    const productId = requiredText(raw.productId ?? raw.product_id, `Order item ${index + 1} product`);
    const weight = raw.weight;
    if (weight !== '250g' && weight !== '500g' && weight !== '1kg') {
      throw new OrderRequestError(`Order item ${index + 1} weight is invalid.`);
    }
    if (typeof raw.quantity !== 'number' || !Number.isSafeInteger(raw.quantity) || raw.quantity < 1) {
      throw new OrderRequestError(`Order item ${index + 1} quantity must be a positive integer.`);
    }
    const cutPreference = raw.cutPreference ?? raw.cut_preference;
    if (cutPreference !== undefined && typeof cutPreference !== 'string') {
      throw new OrderRequestError(`Order item ${index + 1} cut preference is invalid.`);
    }
    return {
      productId,
      weight,
      quantity: Number(raw.quantity),
      ...(typeof cutPreference === 'string' ? { cutPreference: cutPreference.trim() } : {}),
      ...(raw.unitPrice !== undefined ? { unitPrice: Number(raw.unitPrice) } : {}),
      ...(raw.unit_price !== undefined ? { unit_price: Number(raw.unit_price) } : {})
    };
  });
}

function requireCatalogVariant(product: CatalogProduct | undefined, item: SubmittedItem, index: number) {
  if (!product || !product.is_available) {
    throw new OrderRequestError(`Order item ${index + 1} is unavailable.`);
  }
  const variant = parseVariants(product.weights).find(option => option.weight === item.weight);
  if (!variant) throw new OrderRequestError(`Order item ${index + 1} weight is not offered.`);
  if (variant.inStock === false || variant.in_stock === false) {
    throw new OrderRequestError(`Order item ${index + 1} is out of stock.`);
  }
  const cutOptions = parseCutOptions(product.cut_options);
  if (item.cutPreference && cutOptions.length > 0 && !cutOptions.includes(item.cutPreference)) {
    throw new OrderRequestError(`Order item ${index + 1} cut selection is not offered.`);
  }
  const unitPriceCents = cents(variant.price, `Catalog price for item ${index + 1}`);
  return { product, variant, unitPriceCents };
}

function normalizeCustomerItems(
  submittedItems: SubmittedItem[],
  products: CatalogProduct[],
  allowOverrides: boolean
) {
  const productById = new Map(products.map(product => [product.id, product]));
  const auditItems: Record<string, unknown>[] = [];
  let subtotalCents = 0;
  const items = submittedItems.map((item, index) => {
    const catalog = requireCatalogVariant(productById.get(item.productId), item, index);
    const priceCents = allowOverrides
      ? cents(item.unitPrice ?? item.unit_price ?? amount(catalog.unitPriceCents), `Rate for item ${index + 1}`)
      : catalog.unitPriceCents;
    const lineSubtotalCents = priceCents * item.quantity;
    if (!Number.isSafeInteger(lineSubtotalCents) || lineSubtotalCents > MAX_AMOUNT_CENTS) {
      throw new OrderRequestError(`Order item ${index + 1} total is outside the supported range.`);
    }
    subtotalCents += lineSubtotalCents;
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents > MAX_AMOUNT_CENTS) {
      throw new OrderRequestError('Order subtotal is outside the supported range.');
    }

    auditItems.push({
      productId: catalog.product.id,
      weight: item.weight,
      quantity: item.quantity,
      catalogUnitPrice: amount(catalog.unitPriceCents),
      chargedUnitPrice: amount(priceCents),
      overridden: priceCents !== catalog.unitPriceCents
    });

    const cutOptions = parseCutOptions(catalog.product.cut_options);
    const cutPreference = item.cutPreference || cutOptions[0] || 'Standard Curry Cut';
    return {
      product_id: catalog.product.id,
      product_name: catalog.product.name,
      weight: item.weight,
      cut_preference: cutPreference,
      unit_price: amount(priceCents),
      quantity: item.quantity,
      subtotal: amount(lineSubtotalCents)
    };
  });
  return { items, subtotalCents, auditItems };
}

function orderIdentifiers(store: OrderStore, now: Date) {
  return {
    id: store.makeId?.() || `ord-${now.getTime()}-${crypto.randomUUID()}`,
    order_number: store.makeOrderNumber?.(now) || defaultOrderNumber(now)
  };
}

function defaultOrderNumber(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  const dateString = `${part('year')}${part('month')}${part('day')}`;
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return `CCC-${dateString}-${100 + (random[0] % 900)}`;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function createTrackingCredential(): Promise<{ token: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = base64Url(bytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return { token, hash };
}

async function hashTrackingToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function deliveryFeeCents(subtotalCents: number, settings: ShopSettingsRecord): number {
  if (settings.is_open !== true) throw new OrderRequestError('The shop is currently closed.', 409);
  if (subtotalCents < cents(settings.min_order_amount, 'Minimum order amount')) {
    throw new OrderRequestError('Order total is below the shop minimum.', 400);
  }
  return subtotalCents >= cents(settings.free_delivery_threshold, 'Free delivery threshold')
    ? 0
    : cents(settings.delivery_fee, 'Delivery fee');
}

function toDbCustomer(customer: CustomerPayload) {
  return {
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    landmark: customer.landmark || '',
    notes: customer.notes || '',
    ...(customer.latitude !== undefined ? {
      latitude: customer.latitude,
      longitude: customer.longitude,
      coordinatesConfirmed: customer.coordinatesConfirmed === true,
      ...(customer.googleMapsUrl ? { googleMapsUrl: customer.googleMapsUrl } : {})
    } : {})
  };
}

function toOrderRow(
  store: OrderStore,
  orderData: {
    customer: CustomerPayload;
    items: Record<string, unknown>[];
    subtotalCents: number;
    deliveryFeeCents: number;
    discountCents: number;
    totalCents: number;
    paymentMethod: string;
    paymentStatus: string;
    orderStatus: string;
    idempotencyKey: string | null;
    orderSource: 'website' | 'manual';
    isManual: boolean;
    trackingTokenHash: string;
    now: Date;
    estimatedDeliveryTime?: string;
  }
) {
  const identifiers = orderIdentifiers(store, orderData.now);
  const timestamp = orderData.now.toISOString();
  return {
    id: identifiers.id,
    order_number: identifiers.order_number,
    idempotency_key: orderData.idempotencyKey,
    customer: toDbCustomer(orderData.customer),
    items: orderData.items,
    subtotal: amount(orderData.subtotalCents),
    delivery_fee: amount(orderData.deliveryFeeCents),
    discount: amount(orderData.discountCents),
    total_amount: amount(orderData.totalCents),
    payment_method: orderData.paymentMethod,
    payment_status: orderData.paymentStatus,
    order_status: orderData.orderStatus,
    status_history: [{
      status: orderData.orderStatus,
      timestamp,
      note: orderData.isManual ? 'Manual order created by authorized admin' : 'Customer placed order via website'
    }],
    estimated_delivery_time: orderData.estimatedDeliveryTime || null,
    order_source: orderData.orderSource,
    is_manual: orderData.isManual,
    tracking_token_hash: orderData.trackingTokenHash,
    created_at: timestamp,
    updated_at: timestamp
  };
}

function response(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store'
    }
  });
}

async function requestPayload(request: Request): Promise<Record<string, unknown>> {
  try {
    const payload: unknown = await request.json();
    if (!isRecord(payload)) throw new Error('invalid');
    return payload;
  } catch {
    throw new OrderRequestError('Request body must be a JSON object.');
  }
}

function methodError(request: Request): Response | null {
  if (request.method === 'OPTIONS') return response({}, 200);
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);
  return null;
}

function handleError(error: unknown): Response {
  if (error instanceof OrderRequestError) {
    return response({ error: error.message }, error.status);
  }
  console.error('[order-function] Request failed.');
  return response({ error: 'Unable to save the order. Please try again.' }, 500);
}

export function createGuestOrderHandler(store: OrderStore) {
  return async (request: Request): Promise<Response> => {
    const rejected = methodError(request);
    if (rejected) return rejected;
    try {
      const payload = await requestPayload(request);
      if (payload.paymentMethod !== 'COD') {
        throw new OrderRequestError('Only cash-on-delivery orders are currently supported.');
      }
      const customer = validateCustomer(payload.customer);
      const submittedItems = validateItems(payload.items);
      const products = await store.getProducts([...new Set(submittedItems.map(item => item.productId))]);
      const { items, subtotalCents } = normalizeCustomerItems(submittedItems, products, false);
      const settings = await store.getSettings();
      const deliveryCents = deliveryFeeCents(subtotalCents, settings);
      const now = store.now?.() || new Date();
      const trackingCredential = await createTrackingCredential();
      const idempotencyKey = payload.idempotencyKey;
      if (
        idempotencyKey !== undefined &&
        (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 100)
      ) {
        throw new OrderRequestError('Order idempotency key is invalid.');
      }
      const order = toOrderRow(store, {
        customer,
        items,
        subtotalCents,
        deliveryFeeCents: deliveryCents,
        discountCents: 0,
        totalCents: subtotalCents + deliveryCents,
        paymentMethod: 'COD',
        paymentStatus: 'Pending',
        orderStatus: 'New',
        idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey.trim() : null,
        orderSource: 'website',
        isManual: false,
        trackingTokenHash: trackingCredential.hash,
        now,
        estimatedDeliveryTime: settings.delivery_time_estimate_mins == null
          ? undefined
          : `${Number(settings.delivery_time_estimate_mins)} mins`
      });
      const insertedOrder = await store.insertCustomerOrder(order);
      const { tracking_token_hash: _trackingTokenHash, ...publicOrder } = insertedOrder;
      return response({ success: true, order: publicOrder, trackingToken: trackingCredential.token }, 201);
    } catch (error) {
      return handleError(error);
    }
  };
}

export function createAdminManualOrderHandler(store: OrderStore) {
  return async (request: Request): Promise<Response> => {
    const rejected = methodError(request);
    if (rejected) return rejected;
    try {
      const admin = await store.authorizeAdmin(request);
      if (!admin) throw new OrderRequestError('Administrator authorization is required.', 401);

      const payload = await requestPayload(request);
      const orderType = ORDER_TYPES.find(candidate => candidate === payload.orderType);
      if (!orderType) throw new OrderRequestError('Manual order type is invalid.');
      if (!isRecord(payload.customer) || typeof payload.customer.name !== 'string' || !payload.customer.name.trim()) {
        throw new OrderRequestError('Customer name is required.');
      }
      if (
        orderType === 'Home Delivery' &&
        (typeof payload.customer.address !== 'string' || !payload.customer.address.trim())
      ) {
        throw new OrderRequestError('Delivery address is required for home delivery.');
      }
      const customer = isRecord(payload.customer)
        ? {
            name: typeof payload.customer.name === 'string' && payload.customer.name.trim()
              ? payload.customer.name.trim()
              : 'Walk-in Customer',
            phone: typeof payload.customer.phone === 'string' && payload.customer.phone.trim()
              ? payload.customer.phone.trim()
              : 'Counter Walk-in',
            address: typeof payload.customer.address === 'string' && payload.customer.address.trim()
              ? payload.customer.address.trim()
              : orderType === 'Home Delivery' ? 'Home Delivery' : 'In-store Counter / Walk-in',
            landmark: typeof payload.customer.landmark === 'string' ? payload.customer.landmark.trim() : '',
            notes: typeof payload.customer.notes === 'string' ? payload.customer.notes.trim() : ''
          }
        : {
            name: 'Walk-in Customer',
            phone: 'Counter Walk-in',
            address: orderType === 'Home Delivery' ? 'Home Delivery' : 'In-store Counter / Walk-in',
            landmark: '',
            notes: ''
          };
      const submittedItems = validateItems(payload.items);
      for (const item of submittedItems) {
        if (item.unitPrice === undefined && item.unit_price === undefined) {
          throw new OrderRequestError('Each manual order item requires an authorized rate.');
        }
      }
      const products = await store.getProducts([...new Set(submittedItems.map(item => item.productId))]);
      const { items, subtotalCents, auditItems } = normalizeCustomerItems(submittedItems, products, true);
      const deliveryCents = cents(payload.deliveryFee ?? 0, 'Delivery fee');
      const discountCents = cents(payload.discount ?? 0, 'Discount');
      const totalCents = Math.max(0, subtotalCents + deliveryCents - discountCents);
      if (totalCents > MAX_AMOUNT_CENTS) throw new OrderRequestError('Order total is outside the supported range.');

      const requestedPaymentMethod = payload.paymentMethod ?? 'Cash';
      const paymentMethod = PAYMENT_METHODS.find(candidate => candidate === requestedPaymentMethod);
      if (!paymentMethod) {
        throw new OrderRequestError('Manual order payment method is invalid.');
      }
      const requestedPaymentStatus = payload.paymentStatus ?? 'Paid';
      const paymentStatus = PAYMENT_STATUSES.find(candidate => candidate === requestedPaymentStatus);
      if (!paymentStatus) {
        throw new OrderRequestError('Manual order payment status is invalid.');
      }
      const requestedOrderStatus = payload.orderStatus ?? 'Accepted';
      const orderStatus = ORDER_STATUSES.find(candidate => candidate === requestedOrderStatus);
      if (!orderStatus) {
        throw new OrderRequestError('Manual order status is invalid.');
      }

      const now = store.now?.() || new Date();
      const trackingCredential = await createTrackingCredential();
      const order = toOrderRow(store, {
        customer,
        items,
        subtotalCents,
        deliveryFeeCents: deliveryCents,
        discountCents,
        totalCents,
        paymentMethod,
        paymentStatus,
        orderStatus,
        idempotencyKey: `admin-${crypto.randomUUID()}`,
        orderSource: 'manual',
        isManual: true,
        trackingTokenHash: trackingCredential.hash,
        now
      });
      const auditMetadata = {
        orderType,
        items: auditItems,
        subtotal: amount(subtotalCents),
        deliveryFee: amount(deliveryCents),
        discount: amount(discountCents),
        total: amount(totalCents)
      };
      const savedOrder = await store.insertManualOrder(order, admin.id, auditMetadata);
      const { tracking_token_hash: _trackingTokenHash, ...publicOrder } = savedOrder;
      return response({
        success: true,
        order: publicOrder,
        trackingToken: trackingCredential.token
      }, 201);
    } catch (error) {
      return handleError(error);
    }
  };
}

export function redactPublicStatusHistory(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map(entry => ({
    status: entry.status,
    timestamp: entry.timestamp
  }));
}

function publicTrackingOrder(order: TrackingOrder): Record<string, unknown> {
  return {
    order_number: order.order_number,
    order_status: order.order_status,
    status_history: redactPublicStatusHistory(order.status_history),
    estimated_delivery_time: order.estimated_delivery_time,
    created_at: order.created_at
  };
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function createOrderTrackingHandler(store: OrderTrackingStore) {
  return async (request: Request): Promise<Response> => {
    const rejected = methodError(request);
    if (rejected) return rejected;
    try {
      const payload = await requestPayload(request);
      const trackingToken = payload.trackingToken;
      if (typeof trackingToken === 'string') {
        if (!/^[A-Za-z0-9_-]{43}$/.test(trackingToken)) {
          return response({ error: 'Order not found. Check the tracking link and try again.' }, 404);
        }
        const order = await store.getOrderByTrackingHash(await hashTrackingToken(trackingToken));
        if (!order || (typeof payload.orderNumber === 'string' && order.order_number !== payload.orderNumber)) {
          return response({ error: 'Order not found. Check the tracking link and try again.' }, 404);
        }
        return response({ success: true, order: publicTrackingOrder(order) }, 200);
      }

      const orderNumber = payload.orderNumber;
      const customerPhone = payload.customerPhone;
      if (
        typeof orderNumber !== 'string' ||
        !orderNumber.trim() ||
        orderNumber.length > 64 ||
        typeof customerPhone !== 'string' ||
        customerPhone.length > 32 ||
        normalizePhone(customerPhone).length < 7 ||
        normalizePhone(customerPhone).length > 15
      ) {
        return response({ error: 'For an older order, enter its order number and the phone number used at checkout.' }, 400);
      }

      const legacyOrder = await store.getLegacyOrderByNumber(orderNumber.trim());
      if (!legacyOrder || !await store.verifyLegacyPhone(legacyOrder.id, customerPhone)) {
        return response({ error: 'Order not found, or verification failed. Check the details and try again.' }, 404);
      }
      return response({ success: true, order: publicTrackingOrder(legacyOrder.tracking) }, 200);
    } catch (error) {
      if (error instanceof OrderRequestError) {
        return response({ error: error.message }, error.status);
      }
      console.error('[order-tracking] Lookup failed.');
      return response({ error: 'Unable to verify this order right now. Please try again.' }, 500);
    }
  };
}
