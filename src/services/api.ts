import {
  Product,
  Category,
  ShopSettings,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  CreateOrderRequest,
  OrderFilterParams,
  AdminUser,
  WeightUnit,
  WeightOption
} from '../types/index.js';
import { supabase, isSupabaseConfigured } from './supabase.js';
import { initialCategories, initialProducts, initialShopSettings } from '../data/seedData.js';

const API_BASE = '/api';

function getAdminAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('ccc_admin_token') || sessionStorage.getItem('ccc_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getPublicTrackingHistory(value: unknown): Order['statusHistory'] {
  if (!Array.isArray(value)) return [];
  const statuses: OrderStatus[] = [
    'New', 'Accepted', 'Preparing', 'Ready for Dispatch',
    'Out for Delivery', 'Delivered', 'Rejected', 'Cancelled'
  ];
  return value.flatMap(entry => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    if (
      typeof item.status !== 'string' ||
      !statuses.includes(item.status as OrderStatus) ||
      typeof item.timestamp !== 'string'
    ) return [];
    return [{ status: item.status as OrderStatus, timestamp: item.timestamp }];
  });
}

async function getOrderFunctionErrorMessage(error: { message: string; context?: unknown }): Promise<string> {
  if (error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }
    } catch {
      // Function gateways may return non-JSON error bodies.
    }
  }
  return error.message;
}

// Global cross-tab and cross-component synchronization broadcaster
export function notifyShopDataChanged(): void {
  try {
    const timestamp = Date.now().toString();
    window.dispatchEvent(new CustomEvent('ccc_shop_data_updated', { detail: { timestamp } }));
    localStorage.setItem('ccc_shop_data_updated', timestamp);
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('ccc_shop_sync');
      bc.postMessage({ type: 'DATA_UPDATED', timestamp });
      bc.close();
    }
  } catch (e) {
    console.debug('Error broadcasting shop sync:', e);
  }
}

// Safe fetch wrapper that handles non-JSON / HTML responses gracefully
async function safeFetchJson<T>(url: string, init?: RequestInit, fallbackData?: T): Promise<T> {
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      if (contentType.includes('text/html') || res.status === 404) {
        if (fallbackData !== undefined) {
          return fallbackData;
        }
        throw new Error(`Endpoint ${url} returned 404 Not Found.`);
      }
      let errText = `Request failed with status ${res.status}`;
      try {
        const errJson = await res.json();
        errText = errJson.error || errJson.message || errText;
      } catch {
        const text = await res.text();
        if (text && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
          errText = text;
        }
      }
      throw new Error(errText);
    }

    if (contentType.includes('text/html')) {
      if (fallbackData !== undefined) return fallbackData;
      throw new Error(`Unexpected HTML response from server at ${url}`);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (fallbackData !== undefined) {
      return fallbackData;
    }
    throw err;
  }
}

// Helper to map DB record to ShopSettings (handles snake_case, camelCase, numeric strings, and zero thresholds)
function mapDbToSettings(data: any, fallback: ShopSettings): ShopSettings {
  if (!data) return fallback;

  const parseNumField = (val: any, defaultVal: number): number => {
    if (val === undefined || val === null || val === '') return defaultVal;
    const n = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(n) ? defaultVal : n;
  };

  const minOrder = parseNumField(
    data.min_order_amount ?? data.minOrderAmount,
    fallback.minOrderAmount ?? 0
  );
  const deliveryFee = parseNumField(
    data.delivery_fee ?? data.deliveryFee,
    fallback.deliveryFee ?? 30
  );
  const freeDeliveryThreshold = parseNumField(
    data.free_delivery_threshold ?? data.freeDeliveryThreshold,
    fallback.freeDeliveryThreshold ?? 499
  );
  const deliveryTimeEstimateMins = Math.max(
    1,
    Math.round(
      parseNumField(
        data.delivery_time_estimate_mins ?? data.deliveryTimeEstimateMins,
        fallback.deliveryTimeEstimateMins ?? 45
      )
    )
  );

  return {
    shopName: data.shop_name ?? data.shopName ?? fallback.shopName,
    tagline: data.tagline ?? fallback.tagline,
    shopPhone: data.shop_phone ?? data.shopPhone ?? fallback.shopPhone,
    shopWhatsApp: data.shop_whatsapp ?? data.shopWhatsApp ?? fallback.shopWhatsApp,
    address: data.address ?? fallback.address,
    landmark: data.landmark ?? fallback.landmark,
    city: data.city ?? fallback.city,
    isOpen: data.is_open !== undefined ? Boolean(data.is_open) : (data.isOpen !== undefined ? Boolean(data.isOpen) : (fallback.isOpen ?? true)),
    openTime: data.open_time ?? data.openTime ?? fallback.openTime,
    closeTime: data.close_time ?? data.closeTime ?? fallback.closeTime,
    deliveryFee,
    freeDeliveryThreshold,
    minOrderAmount: minOrder,
    deliveryTimeEstimateMins,
    announcementBanner: data.announcement_banner ?? data.announcementBanner ?? fallback.announcementBanner
  };
}

// Helper to map DB record to Product (handles snake_case and weights JSON)
function mapDbToProduct(r: any, categories: Category[]): Product {
  const catId = r.category_id || r.categoryId;
  const cat = categories.find(c => c.id === catId);

  let weights = r.weights;
  if (typeof weights === 'string') {
    try { weights = JSON.parse(weights); } catch {}
  }
  if (!Array.isArray(weights) || weights.length === 0) {
    weights = [
      { weight: '250g', price: 65, inStock: true },
      { weight: '500g', price: 125, inStock: true },
      { weight: '1kg', price: 240, inStock: true }
    ];
  } else {
    weights = weights
      .filter((w: any) => w && w.weight && ['250g', '500g', '1kg'].includes(w.weight))
      .map((w: any) => ({
        weight: w.weight,
        price: typeof w.price === 'number' ? Math.max(0, w.price) : (Math.max(0, parseFloat(String(w.price))) || 0),
        inStock: w.inStock !== false && w.in_stock !== false
      }));
  }

  let cutOptions = r.cut_options || r.cutOptions;
  if (typeof cutOptions === 'string') {
    try { cutOptions = JSON.parse(cutOptions); } catch {}
  }
  if (!Array.isArray(cutOptions)) {
    cutOptions = ['Curry Cut', 'Biryani Cut', 'Small Pieces'];
  }

  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    categoryId: catId,
    categoryName: cat ? cat.name : (r.category_name || r.categoryName || 'Fresh Chicken Cuts'),
    description: r.description || '',
    imageUrl: r.image_url || r.imageUrl || '',
    weights,
    cutOptions,
    isAvailable: r.is_available !== undefined ? Boolean(r.is_available) : (r.isAvailable !== undefined ? Boolean(r.isAvailable) : true),
    isFeatured: r.is_featured !== undefined ? Boolean(r.is_featured) : (r.isFeatured !== undefined ? Boolean(r.isFeatured) : false),
    badge: r.badge || '',
    netWeightDescription: r.net_weight_description || r.netWeightDescription || ''
  };
}

// Helper to get formatted YYYY-MM-DD in Asia/Kolkata timezone (handles midnight and calendar dates correctly)
export function getKolkataDateString(isoOrDate: string | Date = new Date()): string {
  try {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch {
    return typeof isoOrDate === 'string' ? isoOrDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  }
}

// Helper to convert chicken pack weight string to numeric kilograms
export function parseWeightToKg(weightStr: string | undefined): number {
  if (!weightStr) return 0;
  const clean = String(weightStr).toLowerCase().trim();
  if (clean === '250g') return 0.25;
  if (clean === '500g') return 0.50;
  if (clean === '1kg') return 1.00;
  if (clean.endsWith('kg')) {
    const val = parseFloat(clean.replace('kg', ''));
    return isNaN(val) ? 0 : val;
  }
  if (clean.endsWith('g')) {
    const val = parseFloat(clean.replace('g', ''));
    return isNaN(val) ? 0 : val / 1000;
  }
  return 0;
}

// Comprehensive database to Order mapper handling snake_case, camelCase, JSON items, and missing amounts
export function mapDbToOrder(r: any): Order {
  // Parse items safely
  let items = r.items;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch {}
  }
  if (!Array.isArray(items)) {
    items = [];
  }

  // Ensure items have full fields (subtotal, productName, weight, unitPrice, quantity)
  const mappedItems: OrderItem[] = items.map((it: any) => {
    const quantity = Math.max(1, Number(it.quantity) || 1);
    const unitPrice = Math.max(0, Number(it.unitPrice ?? it.unit_price) || 0);
    const subtotal = Number(it.subtotal) > 0 ? Number(it.subtotal) : unitPrice * quantity;
    return {
      productId: String(it.productId || it.product_id || ''),
      productName: String(it.productName || it.product_name || 'Fresh Chicken Item'),
      weight: (it.weight || '1kg') as WeightUnit,
      cutPreference: String(it.cutPreference || it.cut_preference || 'Standard Curry Cut'),
      unitPrice,
      quantity,
      subtotal
    };
  });

  // Financial fields
  const subtotal = Number(r.subtotal) > 0 
    ? Number(r.subtotal) 
    : mappedItems.reduce((sum, item) => sum + item.subtotal, 0);

  const deliveryFee = Number(r.delivery_fee ?? r.deliveryFee ?? 0) || 0;
  const discount = Number(r.discount ?? 0) || 0;

  // Retrieve actual stored total amount, or fall back to calculation from items
  let totalAmount = Number(r.total_amount ?? r.totalAmount ?? r.total ?? r.grand_total);
  if (isNaN(totalAmount) || totalAmount <= 0) {
    totalAmount = Math.max(0, subtotal + deliveryFee - discount);
  }

  // Parse customer info
  let customer = r.customer;
  if (typeof customer === 'string') {
    try { customer = JSON.parse(customer); } catch {}
  }
  if (!customer || typeof customer !== 'object') {
    customer = {
      name: r.customer_name || 'Customer',
      phone: r.customer_phone || '',
      address: r.delivery_address || 'Home Delivery',
      landmark: r.landmark || '',
      notes: r.customer_notes || ''
    };
  }

  // Parse status history
  let statusHistory = r.status_history || r.statusHistory;
  if (typeof statusHistory === 'string') {
    try { statusHistory = JSON.parse(statusHistory); } catch {}
  }
  if (!Array.isArray(statusHistory)) {
    statusHistory = [];
  }

  return {
    id: String(r.id),
    orderNumber: String(r.order_number || r.orderNumber || r.id),
    customer: {
      name: String(customer.name || 'Customer'),
      phone: String(customer.phone || ''),
      address: String(customer.address || ''),
      landmark: customer.landmark ? String(customer.landmark) : '',
      notes: customer.notes ? String(customer.notes) : '',
      latitude: typeof customer.latitude === 'number' ? customer.latitude : (customer.latitude ? parseFloat(customer.latitude) : undefined),
      longitude: typeof customer.longitude === 'number' ? customer.longitude : (customer.longitude ? parseFloat(customer.longitude) : undefined),
      coordinatesConfirmed: Boolean(customer.coordinatesConfirmed),
      googleMapsUrl: customer.googleMapsUrl || (customer.latitude && customer.longitude ? `https://www.google.com/maps?q=${customer.latitude},${customer.longitude}` : undefined)
    },
    items: mappedItems,
    subtotal,
    deliveryFee,
    discount,
    totalAmount,
    paymentMethod: r.payment_method || r.paymentMethod || 'COD',
    paymentStatus: r.payment_status || r.paymentStatus || 'Pending',
    orderStatus: r.order_status || r.orderStatus || 'New',
    statusHistory,
    createdAt: r.created_at || r.createdAt || new Date().toISOString(),
    updatedAt: r.updated_at || r.updatedAt || new Date().toISOString(),
    estimatedDeliveryTime: r.estimated_delivery_time || r.estimatedDeliveryTime,
    idempotencyKey: r.idempotency_key || r.idempotencyKey,
    orderSource: r.order_source || (r.idempotency_key?.startsWith('admin-') || (typeof customer === 'object' && customer?.notes?.includes('[Manual Order')) ? 'manual' : 'website'),
    isManual: Boolean(r.is_manual || r.idempotency_key?.startsWith('admin-') || (typeof customer === 'object' && customer?.notes?.includes('[Manual Order')))
  };
}

export const api = {
  // Public Products
  async getProducts(categoryId?: string, search?: string): Promise<Product[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('products').select('*').eq('is_available', true);
      if (categoryId && categoryId !== 'all') {
        query = query.eq('category_id', categoryId);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(`Unable to load products from Supabase: ${error.message}`);
      }

      // An empty live catalogue is a valid result. Never replace it with demo
      // products or data from the legacy backend in a configured production app.
      const categories = await this.getCategories();
      let list = (data || []).map(r => mapDbToProduct(r, categories));
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        list = list.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(q))
        );
      }
      return list;
    }

    const params = new URLSearchParams();
    if (categoryId && categoryId !== 'all') params.append('category', categoryId);
    if (search) params.append('search', search);
    params.append('_t', Date.now().toString());

    let filtered = [...initialProducts].filter(p => p.isAvailable);
    if (categoryId && categoryId !== 'all') {
      filtered = filtered.filter(p => p.categoryId === categoryId);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    const data = await safeFetchJson<{ success: boolean; products: Product[] }>(
      `${API_BASE}/products?${params.toString()}`,
      { cache: 'no-store' },
      { success: true, products: filtered }
    );
    return data.products || filtered;
  },

  // Admin Products (includes all active & deactivated items)
  async getAdminProducts(search?: string, categoryId?: string): Promise<Product[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('products').select('*').order('created_at', { ascending: false });
      if (categoryId && categoryId !== 'all') {
        query = query.eq('category_id', categoryId);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(`Unable to load admin products from Supabase: ${error.message}`);
      }

      const categories = await this.getCategories();
      let list = (data || []).map(r => mapDbToProduct(r, categories));
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        list = list.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }
      return list;
    }

    const params = new URLSearchParams();
    if (categoryId && categoryId !== 'all') params.append('category', categoryId);
    if (search) params.append('search', search);
    params.append('_t', Date.now().toString());

    let filtered = [...initialProducts];
    if (categoryId && categoryId !== 'all') {
      filtered = filtered.filter(p => p.categoryId === categoryId);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    const data = await safeFetchJson<{ success: boolean; products: Product[] }>(
      `${API_BASE}/admin/products?${params.toString()}`,
      {
        headers: getAdminAuthHeader(),
        cache: 'no-store'
      },
      { success: true, products: filtered }
    );
    return data.products || filtered;
  },

  async getProductById(id: string): Promise<Product> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      if (error) {
        throw new Error(`Unable to load product from Supabase: ${error.message}`);
      }
      if (!data) {
        throw new Error('This product is no longer available.');
      }
      const categories = await this.getCategories();
      return mapDbToProduct(data, categories);
    }

    const fallbackProduct = initialProducts.find(p => p.id === id);
    const data = await safeFetchJson<{ success: boolean; product: Product }>(
      `${API_BASE}/products/${encodeURIComponent(id)}?_t=${Date.now()}`,
      { cache: 'no-store' },
      { success: true, product: fallbackProduct as Product }
    );
    if (!data.product && !fallbackProduct) throw new Error('Product not found.');
    return data.product || fallbackProduct as Product;
  },

  // Public Categories
  async getCategories(): Promise<Category[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) {
        throw new Error(`Unable to load categories from Supabase: ${error.message}`);
      }
      return (data || []).map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        imageUrl: r.image_url || r.imageUrl,
        displayOrder: r.display_order ?? r.displayOrder ?? 0
      }));
    }

    const data = await safeFetchJson<{ success: boolean; categories: Category[] }>(
      `${API_BASE}/categories?_t=${Date.now()}`,
      { cache: 'no-store' },
      { success: true, categories: initialCategories }
    );
    return data.categories || initialCategories;
  },

  // Public Shop Settings
  async getShopSettings(): Promise<ShopSettings> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        throw new Error(`Unable to load shop settings from Supabase: ${error.message}`);
      }
      if (!data) {
        throw new Error('Shop settings are not configured in the production database.');
      }

      const mapped = mapDbToSettings(data, initialShopSettings);
      try {
        localStorage.setItem('ccc_cached_settings', JSON.stringify(mapped));
      } catch {}
      return mapped;
    }

    const data = await safeFetchJson<{ success: boolean; settings: ShopSettings }>(
      `${API_BASE}/settings?_t=${Date.now()}`,
      { cache: 'no-store' },
      { success: true, settings: initialShopSettings }
    );
    const mapped = mapDbToSettings(data.settings, initialShopSettings);
    try {
      localStorage.setItem('ccc_cached_settings', JSON.stringify(mapped));
    } catch {}
    return mapped;
  },

  // Orders
  async createOrder(payload: CreateOrderRequest): Promise<Order> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.functions.invoke('create-guest-order', { body: payload });
      if (error) {
        const message = await getOrderFunctionErrorMessage(error);
        console.error('[Supabase Functions] Guest order creation failed:', message);
        throw new Error(message || 'Unable to save the order securely. Please try again.');
      }
      if (!data?.success || !data.order) {
        throw new Error(data?.error || 'Unable to save the order. Please try again.');
      }
      notifyShopDataChanged();
      return { ...mapDbToOrder(data.order), trackingToken: data.trackingToken };
    }

    const settings = await this.getShopSettings();

    // Calculate subtotal, delivery fee, and total
    let subtotal = 0;
    const items: OrderItem[] = payload.items.map(item => {
      const prod = initialProducts.find(p => p.id === item.productId);
      const variant = prod?.weights.find(w => w.weight === item.weight);
      const unitPrice = variant?.price || 150;
      const itemSubtotal = unitPrice * item.quantity;
      subtotal += itemSubtotal;
      return {
        productId: item.productId,
        productName: prod?.name || 'Fresh Chicken Cut',
        weight: item.weight,
        cutPreference: item.cutPreference,
        unitPrice,
        quantity: item.quantity,
        subtotal: itemSubtotal
      };
    });

    const isFreeDelivery = subtotal >= (settings.freeDeliveryThreshold ?? 499);
    const deliveryFee = isFreeDelivery ? 0 : (settings.deliveryFee ?? 30);
    const totalAmount = subtotal + deliveryFee;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const orderNumber = `CCC-${dateStr}-${randomSuffix}`;
    const nowIso = new Date().toISOString();

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customer: payload.customer,
      items,
      subtotal,
      deliveryFee,
      discount: 0,
      totalAmount,
      paymentMethod: payload.paymentMethod || 'COD',
      paymentStatus: 'Pending',
      orderStatus: 'New',
      statusHistory: [
        {
          status: 'New',
          timestamp: nowIso,
          note: 'Customer placed order via website'
        }
      ],
      orderSource: 'website',
      isManual: false,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // Use the local API only when Supabase is not configured (for standalone development).
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Order API returned an unexpected response (HTTP ${res.status}).`);
      }

      const data = await res.json();
      if (!res.ok || !data.success || !data.order) {
        throw new Error(data.error || `Order API failed with status ${res.status}.`);
      }

      notifyShopDataChanged();
      return data.order;
    } catch (error) {
      console.error('[Orders] Failed to save order through the fallback API:', error);
      throw error instanceof Error
        ? error
        : new Error('Failed to save order. Please try again.');
    }
  },

  async getOrder(orderNumberOrId: string, trackingToken?: string, legacyPhone?: string): Promise<Order> {
    const decoded = decodeURIComponent(orderNumberOrId).trim();
    if (!decoded) {
      throw new Error('Please enter a valid order number.');
    }

    // 1. Check local storage for customer order placed on this device
    let localOrder: Order | null = null;
    try {
      const raw = localStorage.getItem('ccc_customer_orders');
      if (raw) {
        const list: Order[] = JSON.parse(raw);
        localOrder = list.find(o => o.orderNumber === decoded || o.id === decoded) || null;
      }
    } catch {}

    if (isSupabaseConfigured && supabase && trackingToken) {
      const { data, error } = await supabase.functions.invoke('track-order', {
        body: { orderNumber: decoded, trackingToken }
      });
      if (error) {
        const message = await getOrderFunctionErrorMessage(error);
        throw new Error(message || 'Unable to verify this tracking link.');
      }
      if (!data?.success || !data.order?.order_number) {
        throw new Error(data?.error || 'Unable to verify this tracking link.');
      }
      const order: Order = {
        id: localOrder?.id || data.order.order_number,
        orderNumber: data.order.order_number,
        customer: { name: '', phone: '', address: '', landmark: '' },
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        discount: 0,
        totalAmount: 0,
        paymentMethod: 'COD',
        paymentStatus: 'Pending',
        orderStatus: data.order.order_status,
        statusHistory: getPublicTrackingHistory(data.order.status_history),
        createdAt: data.order.created_at,
        updatedAt: data.order.created_at,
        estimatedDeliveryTime: data.order.estimated_delivery_time,
        trackingToken
      };
      if (localOrder?.trackingToken === trackingToken) {
        return {
          ...localOrder,
          orderStatus: order.orderStatus,
          statusHistory: order.statusHistory,
          estimatedDeliveryTime: order.estimatedDeliveryTime
        };
      }
      return order;
    }

    if (isSupabaseConfigured && supabase && legacyPhone) {
      const { data, error } = await supabase.functions.invoke('track-order', {
        body: { orderNumber: decoded, customerPhone: legacyPhone }
      });
      if (error) {
        const message = await getOrderFunctionErrorMessage(error);
        throw new Error(message || 'Unable to verify the older order reference.');
      }
      if (!data?.success || !data.order?.order_number) {
        throw new Error(data?.error || 'Unable to verify the older order reference.');
      }
      const order: Order = {
        id: data.order.order_number,
        orderNumber: data.order.order_number,
        customer: { name: '', phone: '', address: '', landmark: '' },
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        discount: 0,
        totalAmount: 0,
        paymentMethod: 'COD',
        paymentStatus: 'Pending',
        orderStatus: data.order.order_status,
        statusHistory: getPublicTrackingHistory(data.order.status_history),
        createdAt: data.order.created_at,
        updatedAt: data.order.created_at,
        estimatedDeliveryTime: data.order.estimated_delivery_time
      };
      if (
        localOrder &&
        localOrder.customer.phone.replace(/\D/g, '') === legacyPhone.replace(/\D/g, '')
      ) {
        return {
          ...localOrder,
          orderStatus: order.orderStatus,
          statusHistory: order.statusHistory,
          estimatedDeliveryTime: order.estimatedDeliveryTime
        };
      }
      return order;
    }

    // Admin reference lookup remains available through the RLS-protected RPC.
    if (isSupabaseConfigured && supabase) {
      const { data: rpcRows, error: rpcError } = await supabase
        .rpc('get_order_by_reference', { p_reference: decoded });
      const rpcOrder = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!rpcError && rpcOrder && (rpcOrder.order_number || rpcOrder.orderNumber)) {
        return mapDbToOrder(rpcOrder);
      }
    }

    if (localOrder && trackingToken && localOrder.trackingToken === trackingToken) {
      return {
        ...localOrder,
        statusHistory: getPublicTrackingHistory(localOrder.statusHistory)
      };
    }

    if (
      localOrder &&
      !localOrder.trackingToken &&
      legacyPhone &&
      localOrder.customer.phone.replace(/\D/g, '') === legacyPhone.replace(/\D/g, '')
    ) {
      return {
        ...localOrder,
        statusHistory: getPublicTrackingHistory(localOrder.statusHistory)
      };
    }

    throw new Error('Use the secure tracking link, or verify an older order number with the phone number used at checkout.');
  },

  // Payment Session
  async getUpiSession(orderId: string, amountInPaise: number) {
    try {
      const res = await fetch(`${API_BASE}/payment/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amountInPaise })
      });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }
    return {
      success: true,
      qrPayload: `upi://pay?pa=chanduchicken@upi&pn=ChanduChickenCenter&am=${(amountInPaise / 100).toFixed(2)}&cu=INR&tn=Order_${orderId}`,
      sessionId: `sess_${Date.now()}`
    };
  },

  // Admin Authentication - Strict verification, NO hardcoded bypasses
  async adminLogin(usernameOrEmail: string, passwordPlain: string): Promise<{ token: string; admin: AdminUser }> {
    const input = usernameOrEmail.trim();

    // 1. Supabase Authentication
    if (isSupabaseConfigured && supabase) {
      // If user passed email directly (e.g. admin@gmail.com), use it.
      // If user typed username, try email formats
      const candidateEmails = input.includes('@')
        ? [input]
        : [`${input}@chanduchicken.com`, `${input}@gmail.com`, input];

      let lastError = 'Invalid credentials';
      for (const email of candidateEmails) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: passwordPlain
          });

          if (!error && data?.user) {
            // Verify authorization against public.admin_users using authenticated user UUID
            const { data: adminRecord, error: adminQueryError } = await supabase
              .from('admin_users')
              .select('id, email, role')
              .eq('id', data.user.id)
              .maybeSingle();

            if (adminQueryError) {
              console.error('[Supabase] Error verifying admin authorization in admin_users:', adminQueryError);
              await supabase.auth.signOut();
              throw new Error(`Authorization check failed: ${adminQueryError.message}`);
            }

            if (!adminRecord) {
              // User is authenticated in Supabase Auth, but NOT in public.admin_users
              await supabase.auth.signOut();
              throw new Error(
                'Access denied: Your account credentials are valid, but your account is not authorized as an administrator. Please add your user UUID to the public.admin_users table.'
              );
            }

            const verifiedRole: 'admin' | 'super_admin' =
              adminRecord.role === 'admin' || adminRecord.role === 'super_admin'
                ? adminRecord.role
                : 'super_admin';

            const token = data.session?.access_token || `sb_${data.user.id}`;
            const adminObj: AdminUser = {
              id: data.user.id,
              username: data.user.email ? data.user.email.split('@')[0] : (adminRecord.email ? adminRecord.email.split('@')[0] : input),
              role: verifiedRole,
              fullName: data.user.user_metadata?.full_name || 'Shop Manager'
            };
            return { token, admin: adminObj };
          }
          if (error) {
            lastError = error.message;
          }
        } catch (e: any) {
          if (e.message && (e.message.startsWith('Access denied:') || e.message.startsWith('Authorization check failed:'))) {
            throw e;
          }
          lastError = e.message || lastError;
        }
      }

      // NO BYPASS: reject invalid credentials
      throw new Error(`Authentication failed: ${lastError}`);
    }

    // 2. Local Backend Authentication
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: input, password: passwordPlain })
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || contentType.includes('text/html')) {
      throw new Error('Invalid credentials or authentication endpoint unavailable.');
    }

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Invalid admin credentials');
    return { token: data.token, admin: data.admin };
  },

  async adminLogout(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    try {
      await fetch(`${API_BASE}/admin/logout`, {
        method: 'POST',
        headers: getAdminAuthHeader()
      });
    } catch {
      // ignore
    }
  },

  async getAdminMe(): Promise<AdminUser | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data?.user) {
          // Verify authorization against public.admin_users using authenticated user UUID
          const { data: adminRecord, error: adminErr } = await supabase
            .from('admin_users')
            .select('id, email, role')
            .eq('id', data.user.id)
            .maybeSingle();

          if (!adminErr && adminRecord) {
            const verifiedRole: 'admin' | 'super_admin' =
              adminRecord.role === 'admin' || adminRecord.role === 'super_admin'
                ? adminRecord.role
                : 'super_admin';

            return {
              id: data.user.id,
              username: data.user.email ? data.user.email.split('@')[0] : (adminRecord.email ? adminRecord.email.split('@')[0] : 'admin'),
              role: verifiedRole,
              fullName: data.user.user_metadata?.full_name || 'Shop Manager'
            };
          }

          // User is authenticated in Supabase Auth, but NOT in public.admin_users
          console.warn('[Supabase] Active session belongs to a user not authorized in public.admin_users');
          await supabase.auth.signOut();
          return null;
        }
        return null;
      } catch {
        return null;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/admin/me`, {
        headers: getAdminAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        return data.success ? data.admin : null;
      }
    } catch {
      // ignore
    }
    return null;
  },

  // Admin Password Management
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Please enter a valid administrator email address.');
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const redirectTo = `${window.location.origin}/admin/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo
        });

        if (error) {
          console.warn('[Supabase] resetPasswordForEmail response:', error.message);
          if (error.message?.toLowerCase().includes('rate limit')) {
            throw new Error('Too many password reset requests. Please wait a few minutes before trying again.');
          }
        }

        return {
          success: true,
          message: 'If an administrator account exists for this email, a password recovery link has been sent. Please check your inbox and spam folder.'
        };
      } catch (e: any) {
        if (e.message?.includes('Too many password reset requests')) throw e;
        return {
          success: true,
          message: 'If an administrator account exists for this email, a password recovery link has been sent. Please check your inbox and spam folder.'
        };
      }
    }

    // Local backend fallback
    try {
      const res = await fetch(`${API_BASE}/admin/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, message: data.message || 'If an administrator account exists for this email, a password recovery link has been sent.' };
      }
    } catch {
      // ignore
    }

    return {
      success: true,
      message: 'If an administrator account exists for this email, a password recovery link has been sent. Please check your inbox and spam folder.'
    };
  },

  async resetPasswordWithRecovery(newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    if (isSupabaseConfigured && supabase) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error('Password reset session has expired or is invalid. Please request a new recovery link from the admin login page.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw new Error(updateError.message || 'Failed to update password');
      }

      // Safely sign out the recovery session so admin can perform a fresh, authenticated login
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }

      return {
        success: true,
        message: 'Your administrator password has been updated successfully. You can now log in with your new password.'
      };
    }

    // Local backend fallback
    const res = await fetch(`${API_BASE}/admin/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to update password');
    }

    return {
      success: true,
      message: 'Your administrator password has been updated successfully. You can now log in with your new password.'
    };
  },

  async changeAdminPassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!currentPassword) {
      throw new Error('Please enter your current password.');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }
    if (currentPassword === newPassword) {
      throw new Error('New password must be different from your current password.');
    }

    if (isSupabaseConfigured && supabase) {
      // 1. Get current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) {
        throw new Error('Unable to verify active administrator session. Please sign in again.');
      }

      // 2. Re-authenticate with current password to verify identity securely
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });
      if (verifyError) {
        throw new Error('Current password is incorrect. Please verify your current password.');
      }

      // 3. Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (updateError) {
        throw new Error(updateError.message || 'Failed to update password');
      }

      return {
        success: true,
        message: 'Administrator password changed successfully.'
      };
    }

    // Local backend fallback
    const res = await fetch(`${API_BASE}/admin/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to change password');
    }

    return {
      success: true,
      message: 'Administrator password changed successfully.'
    };
  },

  // Admin Orders
  async getAdminOrders(filters?: OrderFilterParams): Promise<Order[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (filters?.status && filters.status !== 'All') {
          query = query.eq('order_status', filters.status);
        }
        if (filters?.paymentStatus && filters.paymentStatus !== 'All') {
          query = query.eq('payment_status', filters.paymentStatus);
        }
        const { data, error } = await query;
        if (!error && data) {
          let orders = data.map(mapDbToOrder);

          // Apply date filter if provided (using Indian timezone)
          if (filters?.startDate) {
            orders = orders.filter(o => getKolkataDateString(o.createdAt) >= filters.startDate!);
          }
          if (filters?.endDate) {
            orders = orders.filter(o => getKolkataDateString(o.createdAt) <= filters.endDate!);
          }

          // Apply search query across Order #, customer name, phone number, address, and product names
          if (filters?.searchQuery && filters.searchQuery.trim()) {
            const rawTerm = filters.searchQuery.trim();
            const term = rawTerm.toLowerCase();
            const digits = rawTerm.replace(/\D/g, '');

            orders = orders.filter(o => {
              if (o.orderNumber.toLowerCase().includes(term) || o.id.toLowerCase().includes(term)) {
                return true;
              }
              if (o.customer.name.toLowerCase().includes(term)) {
                return true;
              }
              if (o.customer.phone.toLowerCase().includes(term)) {
                return true;
              }
              if (digits.length >= 3) {
                const orderPhoneDigits = o.customer.phone.replace(/\D/g, '');
                if (orderPhoneDigits.includes(digits) || digits.includes(orderPhoneDigits)) {
                  return true;
                }
              }
              if (o.customer.address.toLowerCase().includes(term) || (o.customer.landmark && o.customer.landmark.toLowerCase().includes(term))) {
                return true;
              }
              if (o.items.some(item => item.productName.toLowerCase().includes(term))) {
                return true;
              }
              return false;
            });
          }

          return orders;
        }
      } catch (e) {
        console.warn('[Supabase] Failed to fetch orders:', e);
        throw new Error('Unable to load orders from Supabase. Please try again.');
      }
      throw new Error('Unable to load orders from Supabase. Please try again.');
    }

    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'All') params.append('status', filters.status);
    if (filters?.paymentStatus && filters.paymentStatus !== 'All') params.append('paymentStatus', filters.paymentStatus);
    if (filters?.searchQuery) params.append('search', filters.searchQuery);

    const data = await safeFetchJson<{ success: boolean; orders: Order[] }>(
      `${API_BASE}/admin/orders?${params.toString()}`,
      { headers: getAdminAuthHeader() }
    );
    if (!data.success || !Array.isArray(data.orders)) {
      throw new Error('The orders API returned an invalid response.');
    }
    return data.orders.map(mapDbToOrder);
  },

  async createAdminManualOrder(orderData: any): Promise<Order> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.functions.invoke('create-admin-manual-order', {
        body: orderData
      });
      if (error) {
        const message = await getOrderFunctionErrorMessage(error);
        console.error('[Supabase Functions] Manual order creation failed:', message);
        throw new Error(message || 'Failed to save manual order. Please verify your administrator session and try again.');
      }
      if (!data?.success || !data.order) {
        throw new Error(data?.error || 'Failed to save manual order.');
      }
      notifyShopDataChanged();
      return { ...mapDbToOrder(data.order), trackingToken: data.trackingToken };
    }

    const nowIso = new Date().toISOString();
    const dateStr = getKolkataDateString(nowIso).replace(/-/g, '');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const orderNumber = `CCC-${dateStr}-${randomSuffix}`;

    // Normalize items
    const rawItems = Array.isArray(orderData.items) ? orderData.items : [];
    let calculatedSubtotal = 0;
    const items: OrderItem[] = rawItems.map((item: any) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice ?? item.unit_price) || 0);
      const lineSubtotal = Number(item.subtotal) > 0 ? Number(item.subtotal) : unitPrice * quantity;
      calculatedSubtotal += lineSubtotal;
      return {
        productId: String(item.productId || item.product_id || ''),
        productName: String(item.productName || item.product_name || 'Fresh Chicken Item'),
        weight: (item.weight || '1kg') as WeightUnit,
        cutPreference: String(item.cutPreference || item.cut_preference || 'Standard Curry Cut'),
        unitPrice,
        quantity,
        subtotal: lineSubtotal
      };
    });

    const subtotal = Number(orderData.subtotal) > 0 ? Number(orderData.subtotal) : calculatedSubtotal;
    const deliveryFee = Math.max(0, Number(orderData.deliveryFee) || 0);
    const discount = Math.max(0, Number(orderData.discount) || 0);
    const totalAmount = Number(orderData.totalAmount) > 0 
      ? Number(orderData.totalAmount) 
      : Math.max(0, subtotal + deliveryFee - discount);

    const orderType = orderData.orderType || 'Walk-in';
    const customerNotes = orderData.customer?.notes 
      ? `${orderData.customer.notes} [Manual Order - ${orderType}]`
      : `[Manual Order - ${orderType}]`;

    const manualOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customer: {
        name: orderData.customer?.name?.trim() || 'Walk-in Customer',
        phone: orderData.customer?.phone?.trim() || 'Counter Walk-in',
        address: orderData.customer?.address?.trim() || (orderType === 'Home Delivery' ? 'Home Delivery' : 'In-store Counter / Walk-in'),
        landmark: orderData.customer?.landmark?.trim() || '',
        notes: customerNotes
      },
      items,
      subtotal,
      deliveryFee,
      discount,
      totalAmount,
      paymentMethod: orderData.paymentMethod || 'Cash',
      paymentStatus: orderData.paymentStatus || 'Paid',
      orderStatus: orderData.orderStatus || 'Accepted',
      statusHistory: [
        {
          status: orderData.orderStatus || 'Accepted',
          timestamp: nowIso,
          note: `Manual order created by Admin (${orderType})`
        }
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
      idempotencyKey: `admin-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      orderSource: 'manual',
      isManual: true
    };

    try {
      const res = await fetch(`${API_BASE}/admin/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader()
        },
        body: JSON.stringify({
          ...orderData,
          items,
          subtotal,
          deliveryFee,
          discount,
          totalAmount
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          notifyShopDataChanged();
          return mapDbToOrder(data.order);
        }
      }
    } catch {
      // fallback
    }

    notifyShopDataChanged();
    return manualOrder;
  },

  async updateOrderStatus(orderId: string, status: string, note?: string): Promise<Order> {
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: current, error: currentError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        if (currentError || !current) throw new Error('Unable to load this order from Supabase.');
        const history = Array.isArray(current.status_history || current.statusHistory)
          ? [...(current.status_history || current.statusHistory)]
          : [];
        history.push({ status, timestamp: nowIso, note: note || `Status updated to ${status}` });

        const { data, error } = await supabase
          .from('orders')
          .update({ order_status: status, status_history: history, updated_at: nowIso })
          .eq('id', orderId)
          .select()
          .single();

        if (error || !data) throw new Error('Unable to update order status in Supabase.');
        notifyShopDataChanged();
        return mapDbToOrder(data);
      } catch (err: any) {
        console.error('Error updating order status in Supabase:', err);
        throw err;
      }
    }

    const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify({ status, note })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update order status');
    notifyShopDataChanged();
    return mapDbToOrder(data.order);
  },

  async updatePaymentStatus(orderId: string, paymentStatus: string): Promise<Order> {
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .update({ payment_status: paymentStatus, updated_at: nowIso })
          .eq('id', orderId)
          .select()
          .single();

        if (error || !data) throw new Error('Unable to update payment status in Supabase.');
        notifyShopDataChanged();
        return mapDbToOrder(data);
      } catch (err: any) {
        console.error('Error updating payment status in Supabase:', err);
        throw err;
      }
    }

    const res = await fetch(`${API_BASE}/admin/orders/${orderId}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify({ paymentStatus })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update payment status');
    notifyShopDataChanged();
    return mapDbToOrder(data.order);
  },

  // Admin Products - Real database creation, editing & deletion
  async saveProduct(product: Partial<Product>): Promise<Product> {
    const isEdit = Boolean(product.id);
    const id = product.id || `prod-${Date.now()}`;
    const slug = product.slug || (product.name ? product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : id);

    const sanitizedWeights: WeightOption[] = (Array.isArray(product.weights) && product.weights.length > 0)
      ? product.weights
          .filter((w: any) => w && w.weight && ['250g', '500g', '1kg'].includes(w.weight))
          .map((w: any) => ({
            weight: w.weight as WeightUnit,
            price: typeof w.price === 'number' ? Math.max(0, w.price) : (Math.max(0, parseFloat(String(w.price))) || 0),
            inStock: w.inStock !== false && w.in_stock !== false
          }))
      : [
          { weight: '250g', price: 65, inStock: true },
          { weight: '500g', price: 125, inStock: true },
          { weight: '1kg', price: 240, inStock: true }
        ];

    const fullProduct: Product = {
      id,
      name: product.name || '',
      slug,
      categoryId: product.categoryId || 'cat-fresh-cuts',
      categoryName: product.categoryName || 'Fresh Chicken Cuts',
      description: product.description || '',
      imageUrl: product.imageUrl || 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80',
      weights: sanitizedWeights,
      cutOptions: product.cutOptions || ['Curry Cut', 'Biryani Cut', 'Small Pieces'],
      isAvailable: product.isAvailable !== false,
      isFeatured: Boolean(product.isFeatured),
      badge: product.badge || '',
      netWeightDescription: product.netWeightDescription || 'Net weight after cleaning'
    };

    if (isSupabaseConfigured && supabase) {
      // 1. Prepare row matching Supabase schema (snake_case)
      const dbRow: any = {
        id: fullProduct.id,
        category_id: fullProduct.categoryId,
        name: fullProduct.name,
        slug: fullProduct.slug,
        description: fullProduct.description,
        image_url: fullProduct.imageUrl,
        cut_options: fullProduct.cutOptions,
        weights: fullProduct.weights,
        is_available: fullProduct.isAvailable,
        is_featured: fullProduct.isFeatured,
        badge: fullProduct.badge || null,
        net_weight_description: fullProduct.netWeightDescription || null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from('products').upsert([dbRow]).select().single();
      if (error) {
        console.error('[Supabase] Failed to save product:', error);
        if (error.message?.includes('schema cache') || error.code === 'PGRST205' || error.message?.includes('public.products')) {
          throw new Error('Supabase table "public.products" was not found in the schema cache. Please execute the complete supabase-setup.sql script in your Supabase SQL Editor to initialize the database tables and reload the schema cache.');
        }
        throw new Error(`Database error saving product: ${error.message}`);
      }

      // Also upsert to product_weights if table exists
      try {
        await supabase.from('product_weights').delete().eq('product_id', fullProduct.id);
        const weightsPayload = fullProduct.weights.map(w => ({
          product_id: fullProduct.id,
          weight: w.weight,
          price: w.price,
          in_stock: w.inStock
        }));
        await supabase.from('product_weights').insert(weightsPayload);
      } catch {
        // Table might not exist or weights already stored in JSONB
      }

      notifyShopDataChanged();
      return fullProduct;
    }

    // Local backend
    const url = isEdit ? `${API_BASE}/admin/products/${product.id}` : `${API_BASE}/admin/products`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify(fullProduct)
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to save product');
    notifyShopDataChanged();
    return data.product || fullProduct;
  },

  async deleteProduct(productId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      // Clean up normalized weight variants first if table exists
      try {
        await supabase.from('product_weights').delete().eq('product_id', productId);
      } catch {
        // ignore
      }

      // Execute delete with .select('id') so PostgREST returns deleted records.
      // This distinguishes a confirmed deletion from 0 rows affected due to RLS or missing product.
      const { data, error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .select('id');

      if (error) {
        console.error('[Supabase] Failed to delete product:', error);
        if (error.message?.includes('schema cache') || error.code === 'PGRST205' || error.message?.includes('public.products')) {
          throw new Error('Supabase table "public.products" was not found in the schema cache. Please execute the complete supabase-setup.sql script in your Supabase SQL Editor to initialize the database tables and reload the schema cache.');
        }
        throw new Error(`Failed to delete product from database: ${error.message}`);
      }

      // If data is empty, 0 rows were deleted (either RLS blocked the delete or the product does not exist)
      if (!data || data.length === 0) {
        throw new Error('Deletion failed: No product was deleted. Either your account lacks administrator delete permissions (RLS policy) or the product does not exist.');
      }

      notifyShopDataChanged();
      return;
    }

    const res = await fetch(`${API_BASE}/admin/products/${productId}`, {
      method: 'DELETE',
      headers: getAdminAuthHeader()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete product');
    notifyShopDataChanged();
  },

  async toggleProductStock(productId: string, isAvailable: boolean): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('products')
        .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
        .eq('id', productId);
      if (error) {
        if (error.message?.includes('schema cache') || error.code === 'PGRST205' || error.message?.includes('public.products')) {
          throw new Error('Supabase table "public.products" was not found in the schema cache. Please run supabase-setup.sql in Supabase SQL Editor.');
        }
        throw new Error(error.message);
      }
      notifyShopDataChanged();
      return;
    }

    const res = await fetch(`${API_BASE}/admin/products/${productId}/stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify({ isAvailable })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update stock');
    notifyShopDataChanged();
  },

  async updateWeightStock(productId: string, weight: WeightUnit, inStock: boolean, price?: number): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      // The products.weights JSONB field is the source of truth used by the
      // storefront and the order-creation Edge Function. Never report success
      // unless this primary record was actually updated.
      const { data: prod, error: readError } = await supabase
        .from('products')
        .select('id, weights')
        .eq('id', productId)
        .maybeSingle();

      if (readError) {
        throw new Error(`Unable to load product variants: ${readError.message}`);
      }
      if (!prod) {
        throw new Error('Product not found. No stock or price changes were saved.');
      }

      let currentWeights: any = prod.weights;
      if (typeof currentWeights === 'string') {
        try {
          currentWeights = JSON.parse(currentWeights);
        } catch {
          throw new Error('This product has invalid weight data. No changes were saved.');
        }
      }
      if (!Array.isArray(currentWeights)) {
        throw new Error('This product has invalid weight data. No changes were saved.');
      }

      const exists = currentWeights.some((w: any) => w?.weight === weight);
      const updatedWeights = exists
        ? currentWeights.map((w: any) => {
            if (w?.weight === weight) {
              return { ...w, inStock, ...(typeof price === 'number' ? { price: Math.max(0, price) } : {}) };
            }
            return w;
          })
        : [...currentWeights, { weight, inStock, price: typeof price === 'number' ? Math.max(0, price) : 0 }];

      const { data: savedProduct, error: saveError } = await supabase
        .from('products')
        .update({ weights: updatedWeights, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .select('id')
        .maybeSingle();

      if (saveError) {
        throw new Error(`Unable to save stock or price changes: ${saveError.message}`);
      }
      if (!savedProduct) {
        throw new Error('No product was updated. Check administrator permissions and try again.');
      }

      // product_weights is a secondary/legacy mirror. The storefront and
      // order validation read products.weights, so a mirror failure must not
      // turn a successful primary update into a false failure.
      try {
        const mirrorResult = typeof price === 'number'
          ? await supabase.from('product_weights').upsert({
              product_id: productId,
              weight,
              in_stock: inStock,
              price: Math.max(0, price),
              updated_at: new Date().toISOString()
            }, { onConflict: 'product_id,weight' })
          : await supabase.from('product_weights')
              .update({ in_stock: inStock, updated_at: new Date().toISOString() })
              .match({ product_id: productId, weight });

        if (mirrorResult.error) {
          console.warn('[Supabase] Product weight mirror could not be synchronized:', mirrorResult.error);
        }
      } catch (mirrorError) {
        console.warn('[Supabase] Product weight mirror could not be synchronized:', mirrorError);
      }

      notifyShopDataChanged();
      return;
    }

    const res = await fetch(`${API_BASE}/admin/products/${productId}/weight-stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify({ weight, inStock, price })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update variant stock');
    notifyShopDataChanged();
  },

  // Admin Categories
  async saveCategory(category: Partial<Category>): Promise<Category> {
    const isEdit = Boolean(category.id);
    const id = category.id || `cat-${Date.now()}`;
    const fullCategory: Category = {
      id,
      name: category.name || 'Chicken Cuts',
      slug: category.slug || 'chicken-cuts',
      description: category.description || '',
      imageUrl: category.imageUrl || '',
      displayOrder: category.displayOrder || 1
    };

    if (isSupabaseConfigured && supabase) {
      const dbRow = {
        id: fullCategory.id,
        name: fullCategory.name,
        slug: fullCategory.slug,
        description: fullCategory.description,
        image_url: fullCategory.imageUrl,
        display_order: fullCategory.displayOrder,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('categories').upsert([dbRow]);
      if (error) throw new Error(`Database error saving category: ${error.message}`);
      notifyShopDataChanged();
      return fullCategory;
    }

    const url = isEdit ? `${API_BASE}/admin/categories/${category.id}` : `${API_BASE}/admin/categories`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify(category)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to save category');
    notifyShopDataChanged();
    return data.category || fullCategory;
  },

  async deleteCategory(categoryId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('categories').delete().eq('id', categoryId);
      if (error) throw new Error(`Failed to delete category: ${error.message}`);
      notifyShopDataChanged();
      return;
    }

    const res = await fetch(`${API_BASE}/admin/categories/${categoryId}`, {
      method: 'DELETE',
      headers: getAdminAuthHeader()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete category');
    notifyShopDataChanged();
  },

  // Image Upload
  async uploadImage(imageBase64: string, mimeType: string, filename: string): Promise<string> {
    // 1. If Supabase storage is configured, upload to 'products' bucket
    if (isSupabaseConfigured && supabase) {
      try {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const filePath = `products/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const { data, error } = await supabase.storage.from('products').upload(filePath, blob, {
          contentType: mimeType,
          upsert: true
        });

        if (!error && data) {
          const { data: publicUrlData } = supabase.storage.from('products').getPublicUrl(data.path);
          if (publicUrlData?.publicUrl) return publicUrlData.publicUrl;
        }
      } catch (e) {
        console.warn('[Supabase Storage] Upload error, falling back to data URL:', e);
      }
    }

    // 2. Try backend route
    try {
      const res = await fetch(`${API_BASE}/admin/upload-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader()
        },
        body: JSON.stringify({ imageBase64, mimeType, filename })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.result?.url) return data.result.url;
      }
    } catch {
      // fallback
    }

    // Base64 direct representation if storage bucket is not yet provisioned
    return imageBase64.startsWith('data:') ? imageBase64 : `data:${mimeType};base64,${imageBase64}`;
  },

  // Customer Past Orders by Phone (Complete history with phone number normalization)
  async getCustomerOrdersByPhone(phone: string): Promise<Order[]> {
    const rawPhone = phone.trim();
    if (!rawPhone) return [];

    const cleanDigits = rawPhone.replace(/\D/g, '');
    const last10 = cleanDigits.slice(-10);

    const isMatch = (targetPhone: string | undefined): boolean => {
      if (!targetPhone) return false;
      const targetDigits = targetPhone.replace(/\D/g, '');
      if (last10 && last10.length >= 7) {
        if (targetDigits.endsWith(last10) || targetDigits.includes(last10)) return true;
      }
      if (cleanDigits && cleanDigits.length >= 5) {
        if (targetDigits.includes(cleanDigits) || cleanDigits.includes(targetDigits)) return true;
      }
      return targetPhone.toLowerCase().includes(rawPhone.toLowerCase());
    };

    const ordersMap = new Map<string, Order>();

    // 1. Check local storage for customer orders placed on this device
    try {
      const raw = localStorage.getItem('ccc_customer_orders');
      if (raw) {
        const localList: Order[] = JSON.parse(raw);
        for (const o of localList) {
          if (isMatch(o.customer?.phone)) {
            ordersMap.set(o.orderNumber, o);
          }
        }
      }
    } catch {}

    if (isSupabaseConfigured && supabase) {
      const localOrders = Array.from(ordersMap.values());
      localOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return localOrders;
    }

    // 2. Query Supabase with specific phone query conditions
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('orders').select('*');
        if (last10 && last10.length >= 7) {
          query = query.or(
            `customer->>phone.ilike.%${last10}%,customer->>phone.ilike.%${cleanDigits}%,customer->>phone.eq.${rawPhone}`
          );
        } else if (cleanDigits) {
          query = query.ilike('customer->>phone', `%${cleanDigits}%`);
        }
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (!error && data && data.length > 0) {
          const mapped = data.map(mapDbToOrder);
          for (const mo of mapped) {
            if (isMatch(mo.customer?.phone)) {
              ordersMap.set(mo.orderNumber, mo);
            }
          }
        } else {
          // Attempt RPC fallback if available
          try {
            const { data: rpcData } = await supabase.rpc('get_customer_orders_by_phone', {
              p_phone: last10 || cleanDigits || rawPhone
            });
            if (rpcData && Array.isArray(rpcData)) {
              for (const r of rpcData) {
                const mo = mapDbToOrder(r);
                ordersMap.set(mo.orderNumber, mo);
              }
            }
          } catch {}
        }
      } catch (e) {
        console.warn('[Supabase] Customer orders by phone error:', e);
      }
    }

    // 3. Fallback to server API if available
    try {
      const data = await safeFetchJson<{ success: boolean; orders: Order[] }>(
        `${API_BASE}/orders/customer/by-phone/${encodeURIComponent(rawPhone)}`,
        undefined,
        { success: true, orders: [] }
      );
      if (data?.orders && Array.isArray(data.orders)) {
        for (const ro of data.orders) {
          const mo = mapDbToOrder(ro);
          if (isMatch(mo.customer?.phone)) {
            ordersMap.set(mo.orderNumber, mo);
          }
        }
      }
    } catch {
      // ignore
    }

    const result = Array.from(ordersMap.values());
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  },

  // Admin Reports (Issue 9 fix: complete aggregation with filterReport for Supabase & India timezone)
  async getReports(params?: { startDate?: string; endDate?: string; productIds?: string[] }) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rawOrders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (rawOrders && rawOrders.length > 0) {
          const allOrders: Order[] = rawOrders.map(mapDbToOrder);

          const todayKolkata = getKolkataDateString(new Date());
          const todayOrders = allOrders.filter(o => getKolkataDateString(o.createdAt) === todayKolkata);

          const validNonCancelledOrders = allOrders.filter(o => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Rejected');
          const todayRevenue = todayOrders
            .filter(o => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Rejected')
            .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

          const totalRevenue = validNonCancelledOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

          // Reporting date boundaries (in Asia/Kolkata timezone)
          const startDate = params?.startDate || getKolkataDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
          const endDate = params?.endDate || todayKolkata;

          // Target products
          const isAllProducts = !params?.productIds || params.productIds.length === 0 || params.productIds.includes('all');
          const selectedProductIds = isAllProducts ? [] : params!.productIds!;

          // Filter orders in date range (excluding Cancelled & Rejected from sales totals)
          const rangeOrders = allOrders.filter(o => {
            const oDate = getKolkataDateString(o.createdAt);
            return oDate >= startDate && oDate <= endDate;
          });

          const completedRangeOrders = rangeOrders.filter(
            o => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Rejected'
          );

          // Aggregate product sales
          const productBreakdownMap: Record<string, {
            productId: string;
            productName: string;
            totalQuantity: number;
            totalWeightKg: number;
            displayWeight: string;
            totalSalesValue: number;
          }> = {};

          let filterTotalQuantity = 0;
          let filterTotalWeightKg = 0;
          let filterTotalSalesValue = 0;

          // Payment breakdown within the selected period
          const filterPaymentBreakdown = {
            COD: { count: 0, amount: 0 },
            UPI: { count: 0, amount: 0, paidCount: 0, paidAmount: 0, pendingCount: 0, pendingAmount: 0 },
            Cash: { count: 0, amount: 0 }
          };

          // Daily breakdown within the period
          const dailyMap: Record<string, { date: string; orderCount: number; salesValue: number; weightKg: number }> = {};

          for (const order of completedRangeOrders) {
            filterTotalSalesValue += (order.totalAmount || 0);

            // Payment method tally
            if (order.paymentMethod === 'COD') {
              filterPaymentBreakdown.COD.count++;
              filterPaymentBreakdown.COD.amount += (order.totalAmount || 0);
            } else if (order.paymentMethod === 'UPI') {
              filterPaymentBreakdown.UPI.count++;
              filterPaymentBreakdown.UPI.amount += (order.totalAmount || 0);
              if (order.paymentStatus === 'Paid') {
                filterPaymentBreakdown.UPI.paidCount++;
                filterPaymentBreakdown.UPI.paidAmount += (order.totalAmount || 0);
              } else {
                filterPaymentBreakdown.UPI.pendingCount++;
                filterPaymentBreakdown.UPI.pendingAmount += (order.totalAmount || 0);
              }
            } else {
              filterPaymentBreakdown.Cash.count++;
              filterPaymentBreakdown.Cash.amount += (order.totalAmount || 0);
            }

            // Daily breakdown
            const oDate = getKolkataDateString(order.createdAt);
            if (!dailyMap[oDate]) {
              dailyMap[oDate] = { date: oDate, orderCount: 0, salesValue: 0, weightKg: 0 };
            }
            dailyMap[oDate].orderCount++;
            dailyMap[oDate].salesValue += (order.totalAmount || 0);

            // Items breakdown
            for (const item of order.items) {
              if (!isAllProducts && !selectedProductIds.includes(item.productId)) {
                continue;
              }

              const pId = item.productId || item.productName;
              if (!productBreakdownMap[pId]) {
                productBreakdownMap[pId] = {
                  productId: pId,
                  productName: item.productName,
                  totalQuantity: 0,
                  totalWeightKg: 0,
                  displayWeight: '',
                  totalSalesValue: 0
                };
              }

              const itemKg = parseWeightToKg(item.weight) * item.quantity;
              productBreakdownMap[pId].totalQuantity += item.quantity;
              productBreakdownMap[pId].totalWeightKg += itemKg;
              productBreakdownMap[pId].totalSalesValue += (item.subtotal || 0);

              filterTotalQuantity += item.quantity;
              filterTotalWeightKg += itemKg;
              dailyMap[oDate].weightKg += itemKg;
            }
          }

          // Format product breakdown list
          const productBreakdown = Object.values(productBreakdownMap).map(p => ({
            ...p,
            totalWeightKg: parseFloat(p.totalWeightKg.toFixed(2)),
            displayWeight: p.totalWeightKg > 0 
              ? `${p.totalWeightKg.toFixed(2)} kg (${p.totalQuantity} packs)` 
              : `${p.totalQuantity} packs`
          })).sort((a, b) => b.totalSalesValue - a.totalSalesValue);

          // Daily details sorted by date
          const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

          // Order details sorted by date desc
          const orderBreakdown = completedRangeOrders.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            createdAt: o.createdAt,
            dateKolkata: getKolkataDateString(o.createdAt),
            customerName: o.customer.name,
            customerPhone: o.customer.phone,
            totalAmount: o.totalAmount,
            paymentMethod: o.paymentMethod,
            paymentStatus: o.paymentStatus,
            orderStatus: o.orderStatus,
            itemCount: o.items.length
          }));

          return {
            todayRevenue,
            todayOrdersCount: todayOrders.length,
            pendingOrdersCount: allOrders.filter(o => o.orderStatus === 'New' || o.orderStatus === 'Preparing').length,
            activeDeliveriesCount: allOrders.filter(o => o.orderStatus === 'Out for Delivery').length,
            completedOrdersCount: allOrders.filter(o => o.orderStatus === 'Delivered').length,
            totalRevenue,
            topSellingCuts: productBreakdown.slice(0, 5).map(p => ({
              name: p.productName,
              quantity: p.totalQuantity,
              revenue: p.totalSalesValue
            })),
            statusBreakdown: {
              New: allOrders.filter(o => o.orderStatus === 'New').length,
              Accepted: allOrders.filter(o => o.orderStatus === 'Accepted').length,
              Preparing: allOrders.filter(o => o.orderStatus === 'Preparing').length,
              'Ready for Dispatch': allOrders.filter(o => o.orderStatus === 'Ready for Dispatch').length,
              'Out for Delivery': allOrders.filter(o => o.orderStatus === 'Out for Delivery').length,
              Delivered: allOrders.filter(o => o.orderStatus === 'Delivered').length,
              Rejected: allOrders.filter(o => o.orderStatus === 'Rejected').length,
              Cancelled: allOrders.filter(o => o.orderStatus === 'Cancelled').length
            },
            paymentBreakdown: {
              Pending: allOrders.filter(o => o.paymentStatus === 'Pending').length,
              Paid: allOrders.filter(o => o.paymentStatus === 'Paid').length,
              Failed: allOrders.filter(o => o.paymentStatus === 'Failed').length,
              Refunded: allOrders.filter(o => o.paymentStatus === 'Refunded').length
            },
            filterReport: {
              startDate,
              endDate,
              totalOrdersCount: completedRangeOrders.length,
              totalQuantitySold: filterTotalQuantity,
              totalWeightSoldKg: parseFloat(filterTotalWeightKg.toFixed(2)),
              totalSalesValue: filterTotalSalesValue,
              productBreakdown,
              paymentBreakdown: filterPaymentBreakdown,
              dailyBreakdown,
              orderBreakdown
            }
          };
        }
      } catch (e) {
        console.warn('[Supabase] Reports aggregation error:', e);
      }
    }

    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.productIds && params.productIds.length > 0) {
      query.append('productIds', params.productIds.join(','));
    }

    const url = `${API_BASE}/admin/reports${query.toString() ? `?${query.toString()}` : ''}`;
    const data = await safeFetchJson<{ success: boolean; reports: any }>(
      url,
      { headers: getAdminAuthHeader() },
      {
        success: true,
        reports: {
          todayRevenue: 0,
          todayOrdersCount: 0,
          pendingOrdersCount: 0,
          activeDeliveriesCount: 0,
          completedOrdersCount: 0,
          totalRevenue: 0,
          topSellingCuts: [],
          statusBreakdown: { New: 0, Accepted: 0, Preparing: 0, 'Ready for Dispatch': 0, 'Out for Delivery': 0, Delivered: 0, Rejected: 0, Cancelled: 0 },
          paymentBreakdown: { Pending: 0, Paid: 0, Failed: 0, Refunded: 0 }
        }
      }
    );
    return data.reports;
  },

  // Admin Settings - Updates shared database and synchronizes across all devices
  async updateSettings(settings: Partial<ShopSettings>): Promise<ShopSettings> {
    const current = await this.getShopSettings();

    const parseNum = (val: any, fallbackVal: number): number => {
      if (val === undefined || val === null || val === '') return fallbackVal;
      const n = typeof val === 'number' ? val : parseFloat(String(val));
      return isNaN(n) ? fallbackVal : Math.max(0, n);
    };

    const minOrderAmount = parseNum(settings.minOrderAmount, current.minOrderAmount ?? 0);
    const deliveryFee = parseNum(settings.deliveryFee, current.deliveryFee ?? 30);
    const freeDeliveryThreshold = parseNum(settings.freeDeliveryThreshold, current.freeDeliveryThreshold ?? 499);
    const deliveryTimeEstimateMins = Math.max(1, Math.round(parseNum(settings.deliveryTimeEstimateMins, current.deliveryTimeEstimateMins ?? 45)));
    const isOpen = settings.isOpen !== undefined ? Boolean(settings.isOpen) : (current.isOpen ?? true);

    const updated: ShopSettings = {
      ...current,
      ...settings,
      isOpen,
      minOrderAmount,
      deliveryFee,
      freeDeliveryThreshold,
      deliveryTimeEstimateMins
    };

    // Do not cache proposed settings before the database confirms the write.
    // Otherwise a failed RLS/network request can leave this device showing
    // values that were never saved for the shop.
    if (isSupabaseConfigured && supabase) {
      const dbRow = {
        id: 1,
        shop_name: updated.shopName,
        tagline: updated.tagline,
        shop_phone: updated.shopPhone,
        shop_whatsapp: updated.shopWhatsApp,
        address: updated.address,
        landmark: updated.landmark,
        city: updated.city,
        is_open: Boolean(updated.isOpen),
        open_time: updated.openTime,
        close_time: updated.closeTime,
        delivery_fee: updated.deliveryFee,
        free_delivery_threshold: updated.freeDeliveryThreshold,
        min_order_amount: updated.minOrderAmount, // Persist 0 properly
        delivery_time_estimate_mins: updated.deliveryTimeEstimateMins,
        announcement_banner: updated.announcementBanner,
        updated_at: new Date().toISOString()
      };

      // 1. Try direct UPDATE on existing singleton row id = 1
      let { data, error } = await supabase
        .from('shop_settings')
        .update(dbRow)
        .eq('id', 1)
        .select()
        .maybeSingle();

      // 2. If row did not exist yet, fallback to upsert
      if (error || !data) {
        const upsertRes = await supabase
          .from('shop_settings')
          .upsert([dbRow], { onConflict: 'id' })
          .select()
          .single();
        data = upsertRes.data;
        error = upsertRes.error;
      }

      if (error) {
        console.error('[Supabase] Failed to persist settings:', error);
        throw new Error(`Database error updating settings: ${error.message}`);
      }

      const saved = mapDbToSettings(data, updated);
      try {
        localStorage.setItem('ccc_cached_settings', JSON.stringify(saved));
      } catch {}

      notifyShopDataChanged();
      return saved;
    }

    // Local backend
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify(updated)
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update shop settings');
    const saved = data.settings ? mapDbToSettings(data.settings, updated) : updated;
    try {
      localStorage.setItem('ccc_cached_settings', JSON.stringify(saved));
    } catch {}
    notifyShopDataChanged();
    return saved;
  }
};
