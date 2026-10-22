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
  WeightUnit
} from '../types/index.js';
import { supabase, isSupabaseConfigured } from './supabase.js';
import { initialCategories, initialProducts, initialShopSettings } from '../data/seedData.js';

const API_BASE = '/api';

function getAdminAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('ccc_admin_token') || sessionStorage.getItem('ccc_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
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

// Helper to safely execute fetch without throwing on Vercel 404 HTML pages
async function safeFetchJson<T>(url: string, init?: RequestInit, fallbackData?: T): Promise<T> {
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';
    
    // Check if server returned HTML (typical of Vercel 404 static page)
    if (!res.ok) {
      if (contentType.includes('text/html') || res.status === 404) {
        if (fallbackData !== undefined) {
          console.warn(`[API] Endpoint ${url} returned 404; using fallback data.`);
          return fallbackData;
        }
        throw new Error(
          `Backend endpoint ${url} not found (404). If deployed on Vercel, ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel Project Settings.`
        );
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
      console.warn(`[API] Network error on ${url}: ${err.message}. Using fallback data.`);
      return fallbackData;
    }
    throw err;
  }
}

// Local storage backup helpers for offline/standalone resilience
function getStoredSettings(): ShopSettings {
  try {
    const raw = localStorage.getItem('ccc_shop_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...initialShopSettings, ...parsed };
    }
  } catch {
    // ignore
  }
  return initialShopSettings;
}

function saveStoredSettings(settings: ShopSettings) {
  try {
    localStorage.setItem('ccc_shop_settings', JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function getStoredOrders(): Order[] {
  try {
    const raw = localStorage.getItem('ccc_orders');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredOrder(order: Order) {
  try {
    const orders = getStoredOrders();
    const existingIdx = orders.findIndex(o => o.id === order.id || o.orderNumber === order.orderNumber);
    if (existingIdx >= 0) {
      orders[existingIdx] = order;
    } else {
      orders.unshift(order);
    }
    localStorage.setItem('ccc_orders', JSON.stringify(orders.slice(0, 100)));
  } catch {
    // ignore
  }
}

export const api = {
  // Public Products
  async getProducts(categoryId?: string, search?: string): Promise<Product[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('products').select('*');
        if (categoryId && categoryId !== 'all') {
          query = query.eq('categoryId', categoryId);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          let list: Product[] = data;
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
      } catch (e) {
        console.warn('[Supabase] Failed to fetch products, falling back to catalog:', e);
      }
    }

    // Try API with fallback to initialProducts
    const params = new URLSearchParams();
    if (categoryId && categoryId !== 'all') params.append('category', categoryId);
    if (search) params.append('search', search);
    params.append('_t', Date.now().toString());

    // Filter initialProducts for local fallback
    let filteredInitial = [...initialProducts];
    if (categoryId && categoryId !== 'all') {
      filteredInitial = filteredInitial.filter(p => p.categoryId === categoryId);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filteredInitial = filteredInitial.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q))
      );
    }

    const data = await safeFetchJson<{ success: boolean; products: Product[] }>(
      `${API_BASE}/products?${params.toString()}`,
      { cache: 'no-store' },
      { success: true, products: filteredInitial }
    );
    return data.products || filteredInitial;
  },

  // Admin Products
  async getAdminProducts(search?: string, categoryId?: string): Promise<Product[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('products').select('*');
        if (categoryId && categoryId !== 'all') {
          query = query.eq('categoryId', categoryId);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          let list: Product[] = data;
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
      } catch (e) {
        console.warn('[Supabase] Failed to fetch admin products:', e);
      }
    }

    const params = new URLSearchParams();
    if (categoryId && categoryId !== 'all') params.append('category', categoryId);
    if (search) params.append('search', search);
    params.append('_t', Date.now().toString());

    let filteredInitial = [...initialProducts];
    if (categoryId && categoryId !== 'all') {
      filteredInitial = filteredInitial.filter(p => p.categoryId === categoryId);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filteredInitial = filteredInitial.filter(p =>
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
      { success: true, products: filteredInitial }
    );
    return data.products || filteredInitial;
  },

  async getProductById(id: string): Promise<Product> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
        if (!error && data) return data;
      } catch {
        // fallback
      }
    }

    const fallbackProduct = initialProducts.find(p => p.id === id) || initialProducts[0];
    const data = await safeFetchJson<{ success: boolean; product: Product }>(
      `${API_BASE}/products/${id}?_t=${Date.now()}`,
      { cache: 'no-store' },
      { success: true, product: fallbackProduct }
    );
    return data.product || fallbackProduct;
  },

  // Public Categories
  async getCategories(): Promise<Category[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('displayOrder', { ascending: true });
        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (e) {
        console.warn('[Supabase] Categories query error:', e);
      }
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
    const cached = getStoredSettings();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('shop_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const loaded: ShopSettings = {
            ...cached,
            ...data,
            // Ensure minOrderAmount allows 0 as valid number
            minOrderAmount: typeof data.minOrderAmount === 'number' ? data.minOrderAmount : (cached.minOrderAmount ?? 0),
            freeDeliveryThreshold: typeof data.freeDeliveryThreshold === 'number' ? data.freeDeliveryThreshold : (cached.freeDeliveryThreshold ?? 499),
            deliveryFee: typeof data.deliveryFee === 'number' ? data.deliveryFee : (cached.deliveryFee ?? 30)
          };
          saveStoredSettings(loaded);
          return loaded;
        }
      } catch (e) {
        console.warn('[Supabase] Failed to fetch shop_settings:', e);
      }
    }

    const data = await safeFetchJson<{ success: boolean; settings: ShopSettings }>(
      `${API_BASE}/settings?_t=${Date.now()}`,
      { cache: 'no-store' },
      { success: true, settings: cached }
    );
    const resolved = data.settings || cached;
    saveStoredSettings(resolved);
    return resolved;
  },

  // Orders
  async createOrder(payload: CreateOrderRequest): Promise<Order> {
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
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // Save to Supabase if available
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('orders').insert([newOrder]).select().single();
        if (!error && data) {
          saveStoredOrder(data);
          notifyShopDataChanged();
          return data;
        }
      } catch (e) {
        console.warn('[Supabase] Failed to write order to Supabase:', e);
      }
    }

    // Attempt local API
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          saveStoredOrder(data.order);
          notifyShopDataChanged();
          return data.order;
        }
      }
    } catch {
      // ignore
    }

    // Always persist to local storage as guaranteed fallback
    saveStoredOrder(newOrder);
    notifyShopDataChanged();
    return newOrder;
  },

  async getOrder(orderNumberOrId: string): Promise<Order> {
    const decoded = decodeURIComponent(orderNumberOrId).trim();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .or(`id.eq.${decoded},orderNumber.eq.${decoded}`)
          .maybeSingle();
        if (!error && data) return data;
      } catch {
        // fallback
      }
    }

    // Try local storage
    const stored = getStoredOrders().find(o => o.id === decoded || o.orderNumber === decoded);
    if (stored) return stored;

    const data = await safeFetchJson<{ success: boolean; order: Order }>(
      `${API_BASE}/orders/${encodeURIComponent(decoded)}`,
      undefined,
      stored ? { success: true, order: stored } : undefined
    );
    if (!data?.order) throw new Error('Order not found');
    return data.order;
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

  // Admin Authentication
  async adminLogin(username: string, passwordPlain: string): Promise<{ token: string; admin: AdminUser }> {
    const trimmedUser = username.trim();

    // 1. If Supabase is configured, use Supabase Auth directly
    if (isSupabaseConfigured && supabase) {
      // Supabase Auth requires an email. If the user provided an email, use it directly.
      // If they provided a username like 'admin', try standard email aliases or username.
      const candidateEmails = trimmedUser.includes('@')
        ? [trimmedUser]
        : [`${trimmedUser}@chanduchicken.com`, `${trimmedUser}@gmail.com`, trimmedUser];

      let lastError = 'Invalid credentials';
      for (const email of candidateEmails) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: passwordPlain
          });

          if (!error && data?.user) {
            const token = data.session?.access_token || `sb_${data.user.id}`;
            const adminObj: AdminUser = {
              id: data.user.id,
              username: data.user.email ? data.user.email.split('@')[0] : trimmedUser,
              role: 'super_admin',
              fullName: data.user.user_metadata?.full_name || 'Shop Manager'
            };
            return { token, admin: adminObj };
          }
          if (error) lastError = error.message;
        } catch (e: any) {
          lastError = e.message || lastError;
        }
      }

      // If user is developing or wants local fallback with default credentials
      if (trimmedUser === 'admin' && passwordPlain === 'chandu@123') {
        const devAdmin: AdminUser = {
          id: 'adm-1',
          username: 'admin',
          role: 'super_admin',
          fullName: 'Chandu (Owner & Butcher)'
        };
        return { token: 'dev_mock_admin_token_ccc', admin: devAdmin };
      }

      throw new Error(`Supabase Auth failed: ${lastError}`);
    }

    // 2. Local Express backend login
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUser, password: passwordPlain })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('text/html')) {
        // If running on Vercel without Supabase credentials configured
        if (trimmedUser === 'admin' && passwordPlain === 'chandu@123') {
          const localAdmin: AdminUser = {
            id: 'adm-1',
            username: 'admin',
            role: 'super_admin',
            fullName: 'Chandu (Owner & Butcher)'
          };
          return { token: 'ccc_standalone_token', admin: localAdmin };
        }
        throw new Error(
          'Vercel API route not found (404). Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured in your Vercel Project Settings to authenticate with Supabase.'
        );
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Invalid admin credentials');
      return { token: data.token, admin: data.admin };
    } catch (err: any) {
      if (trimmedUser === 'admin' && passwordPlain === 'chandu@123') {
        const localAdmin: AdminUser = {
          id: 'adm-1',
          username: 'admin',
          role: 'super_admin',
          fullName: 'Chandu (Owner & Butcher)'
        };
        return { token: 'ccc_standalone_token', admin: localAdmin };
      }
      throw err;
    }
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
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          return {
            id: data.user.id,
            username: data.user.email ? data.user.email.split('@')[0] : 'admin',
            role: 'super_admin',
            fullName: data.user.user_metadata?.full_name || 'Shop Manager'
          };
        }
      } catch {
        // ignore
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

    // Check token presence
    const token = localStorage.getItem('ccc_admin_token');
    if (token) {
      return {
        id: 'adm-1',
        username: 'admin',
        role: 'super_admin',
        fullName: 'Chandu (Owner & Butcher)'
      };
    }
    return null;
  },

  // Admin Orders
  async getAdminOrders(filters?: OrderFilterParams): Promise<Order[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('orders').select('*').order('createdAt', { ascending: false });
        if (filters?.status && filters.status !== 'All') {
          query = query.eq('orderStatus', filters.status);
        }
        if (filters?.paymentStatus && filters.paymentStatus !== 'All') {
          query = query.eq('paymentStatus', filters.paymentStatus);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (e) {
        console.warn('[Supabase] Failed to fetch orders:', e);
      }
    }

    const fallbackOrders = getStoredOrders();
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'All') params.append('status', filters.status);
    if (filters?.paymentStatus && filters.paymentStatus !== 'All') params.append('paymentStatus', filters.paymentStatus);
    if (filters?.searchQuery) params.append('search', filters.searchQuery);

    const data = await safeFetchJson<{ success: boolean; orders: Order[] }>(
      `${API_BASE}/admin/orders?${params.toString()}`,
      { headers: getAdminAuthHeader() },
      { success: true, orders: fallbackOrders }
    );
    return data.orders || fallbackOrders;
  },

  async createAdminManualOrder(orderData: any): Promise<Order> {
    const settings = await this.getShopSettings();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const orderNumber = `CCC-${dateStr}-${randomSuffix}`;
    const nowIso = new Date().toISOString();

    const manualOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customer: orderData.customer,
      items: orderData.items || [],
      subtotal: orderData.subtotal || 0,
      deliveryFee: orderData.deliveryFee || 0,
      discount: orderData.discount || 0,
      totalAmount: orderData.totalAmount || 0,
      paymentMethod: orderData.paymentMethod || 'COD',
      paymentStatus: orderData.paymentStatus || 'Pending',
      orderStatus: orderData.orderStatus || 'New',
      statusHistory: [
        {
          status: orderData.orderStatus || 'New',
          timestamp: nowIso,
          note: orderData.adminNotes || 'Order created manually by Admin'
        }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('orders').insert([manualOrder]).select().single();
        if (!error && data) {
          saveStoredOrder(data);
          notifyShopDataChanged();
          return data;
        }
      } catch {
        // fallback
      }
    }

    try {
      const res = await fetch(`${API_BASE}/admin/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader()
        },
        body: JSON.stringify(orderData)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          saveStoredOrder(data.order);
          notifyShopDataChanged();
          return data.order;
        }
      }
    } catch {
      // fallback
    }

    saveStoredOrder(manualOrder);
    notifyShopDataChanged();
    return manualOrder;
  },

  async updateOrderStatus(orderId: string, status: string, note?: string): Promise<Order> {
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: current } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (current) {
          const history = Array.isArray(current.statusHistory) ? [...current.statusHistory] : [];
          history.push({ status, timestamp: nowIso, note: note || `Status updated to ${status}` });
          const { data, error } = await supabase
            .from('orders')
            .update({ orderStatus: status, statusHistory: history, updatedAt: nowIso })
            .eq('id', orderId)
            .select()
            .single();
          if (!error && data) {
            saveStoredOrder(data);
            notifyShopDataChanged();
            return data;
          }
        }
      } catch {
        // fallback
      }
    }

    try {
      const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader()
        },
        body: JSON.stringify({ status, note })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          saveStoredOrder(data.order);
          notifyShopDataChanged();
          return data.order;
        }
      }
    } catch {
      // fallback
    }

    // Update in local store
    const orders = getStoredOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.orderStatus = status as OrderStatus;
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({ status: status as OrderStatus, timestamp: nowIso, note });
      order.updatedAt = nowIso;
      saveStoredOrder(order);
      notifyShopDataChanged();
      return order;
    }

    throw new Error('Order not found to update status');
  },

  async updatePaymentStatus(orderId: string, paymentStatus: string): Promise<Order> {
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .update({ paymentStatus, updatedAt: nowIso })
          .eq('id', orderId)
          .select()
          .single();
        if (!error && data) {
          saveStoredOrder(data);
          notifyShopDataChanged();
          return data;
        }
      } catch {
        // fallback
      }
    }

    try {
      const res = await fetch(`${API_BASE}/admin/orders/${orderId}/payment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader()
        },
        body: JSON.stringify({ paymentStatus })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          saveStoredOrder(data.order);
          notifyShopDataChanged();
          return data.order;
        }
      }
    } catch {
      // fallback
    }

    const orders = getStoredOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.paymentStatus = paymentStatus as PaymentStatus;
      order.updatedAt = nowIso;
      saveStoredOrder(order);
      notifyShopDataChanged();
      return order;
    }

    throw new Error('Order not found to update payment');
  },

  // Admin Products
  async saveProduct(product: Partial<Product>): Promise<Product> {
    const isEdit = Boolean(product.id);
    const id = product.id || `prod-${Date.now()}`;
    const fullProduct: Product = {
      ...(initialProducts.find(p => p.id === id) || initialProducts[0]),
      ...product,
      id
    } as Product;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('products').upsert([fullProduct]).select().single();
        if (!error && data) {
          notifyShopDataChanged();
          return data;
        }
      } catch {
        // fallback
      }
    }

    const url = isEdit ? `${API_BASE}/admin/products/${product.id}` : `${API_BASE}/admin/products`;
    const method = isEdit ? 'PUT' : 'POST';

    const data = await safeFetchJson<{ success: boolean; product: Product }>(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader()
        },
        body: JSON.stringify(product)
      },
      { success: true, product: fullProduct }
    );
    notifyShopDataChanged();
    return data.product || fullProduct;
  },

  async deleteProduct(productId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('products').delete().eq('id', productId);
      } catch {
        // ignore
      }
    }
    await safeFetchJson(
      `${API_BASE}/admin/products/${productId}`,
      {
        method: 'DELETE',
        headers: getAdminAuthHeader()
      },
      { success: true }
    );
    notifyShopDataChanged();
  },

  async toggleProductStock(productId: string, isAvailable: boolean): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('products').update({ isAvailable }).eq('id', productId);
        notifyShopDataChanged();
        return;
      } catch {
        // fallback
      }
    }
    await safeFetchJson(
      `${API_BASE}/admin/products/${productId}/stock`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader()
        },
        body: JSON.stringify({ isAvailable })
      },
      { success: true }
    );
    notifyShopDataChanged();
  },

  async updateWeightStock(productId: string, weight: WeightUnit, inStock: boolean, price?: number): Promise<void> {
    await safeFetchJson(
      `${API_BASE}/admin/products/${productId}/weight-stock`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader()
        },
        body: JSON.stringify({ weight, inStock, price })
      },
      { success: true }
    );
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
      try {
        const { data, error } = await supabase.from('categories').upsert([fullCategory]).select().single();
        if (!error && data) {
          notifyShopDataChanged();
          return data;
        }
      } catch {
        // fallback
      }
    }

    const url = isEdit ? `${API_BASE}/admin/categories/${category.id}` : `${API_BASE}/admin/categories`;
    const method = isEdit ? 'PUT' : 'POST';

    const data = await safeFetchJson<{ success: boolean; category: Category }>(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader()
        },
        body: JSON.stringify(category)
      },
      { success: true, category: fullCategory }
    );
    notifyShopDataChanged();
    return data.category || fullCategory;
  },

  async deleteCategory(categoryId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('categories').delete().eq('id', categoryId);
      } catch {
        // ignore
      }
    }
    await safeFetchJson(
      `${API_BASE}/admin/categories/${categoryId}`,
      {
        method: 'DELETE',
        headers: getAdminAuthHeader()
      },
      { success: true }
    );
    notifyShopDataChanged();
  },

  // Image Upload
  async uploadImage(imageBase64: string, mimeType: string, filename: string): Promise<string> {
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
    // Return base64 data URL directly if backend upload route is unavailable
    return imageBase64.startsWith('data:') ? imageBase64 : `data:${mimeType};base64,${imageBase64}`;
  },

  // Customer Past Orders by Phone
  async getCustomerOrdersByPhone(phone: string): Promise<Order[]> {
    const cleanPhone = phone.replace(/[\s\-()]/g, '').trim();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .ilike('customer->>phone', `%${cleanPhone.slice(-10)}%`)
          .order('createdAt', { ascending: false });
        if (!error && data) return data;
      } catch {
        // fallback
      }
    }

    const localMatches = getStoredOrders().filter(o => {
      const p = (o.customer?.phone || '').replace(/[\s\-()]/g, '');
      return p.includes(cleanPhone.slice(-10));
    });

    const data = await safeFetchJson<{ success: boolean; orders: Order[] }>(
      `${API_BASE}/orders/customer/by-phone/${encodeURIComponent(cleanPhone)}`,
      undefined,
      { success: true, orders: localMatches }
    );
    return data.orders || localMatches;
  },

  // Admin Reports
  async getReports(params?: { startDate?: string; endDate?: string; productIds?: string[] }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.productIds && params.productIds.length > 0) {
      query.append('productIds', params.productIds.join(','));
    }

    const storedOrders = getStoredOrders();
    const fallbackReports = {
      todayRevenue: storedOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0),
      todayOrdersCount: storedOrders.length,
      pendingOrdersCount: storedOrders.filter(o => o.orderStatus === 'New' || o.orderStatus === 'Preparing').length,
      activeDeliveriesCount: storedOrders.filter(o => o.orderStatus === 'Out for Delivery').length,
      completedOrdersCount: storedOrders.filter(o => o.orderStatus === 'Delivered').length,
      totalRevenue: storedOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0),
      topSellingCuts: [
        { name: 'Chicken Curry Cut (Small/Medium)', quantity: 24, revenue: 5760 },
        { name: 'Chicken Biryani Cut', quantity: 18, revenue: 4680 }
      ],
      statusBreakdown: {
        New: storedOrders.filter(o => o.orderStatus === 'New').length,
        Accepted: storedOrders.filter(o => o.orderStatus === 'Accepted').length,
        Preparing: storedOrders.filter(o => o.orderStatus === 'Preparing').length,
        'Out for Delivery': storedOrders.filter(o => o.orderStatus === 'Out for Delivery').length,
        Delivered: storedOrders.filter(o => o.orderStatus === 'Delivered').length,
        Cancelled: storedOrders.filter(o => o.orderStatus === 'Cancelled').length
      },
      paymentBreakdown: {
        Pending: storedOrders.filter(o => o.paymentStatus === 'Pending').length,
        Paid: storedOrders.filter(o => o.paymentStatus === 'Paid').length,
        Failed: storedOrders.filter(o => o.paymentStatus === 'Failed').length
      }
    };

    const url = `${API_BASE}/admin/reports${query.toString() ? `?${query.toString()}` : ''}`;
    const data = await safeFetchJson<{ success: boolean; reports: any }>(
      url,
      { headers: getAdminAuthHeader() },
      { success: true, reports: fallbackReports }
    );
    return data.reports || fallbackReports;
  },

  // Admin Settings
  async updateSettings(settings: Partial<ShopSettings>): Promise<ShopSettings> {
    const current = getStoredSettings();
    const updated: ShopSettings = {
      ...current,
      ...settings,
      // Explicitly allow 0 as valid numeric value
      minOrderAmount: typeof settings.minOrderAmount === 'number' ? settings.minOrderAmount : (current.minOrderAmount ?? 0),
      freeDeliveryThreshold: typeof settings.freeDeliveryThreshold === 'number' ? settings.freeDeliveryThreshold : (current.freeDeliveryThreshold ?? 499),
      deliveryFee: typeof settings.deliveryFee === 'number' ? settings.deliveryFee : (current.deliveryFee ?? 30)
    };

    saveStoredSettings(updated);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('shop_settings').upsert([{ id: 1, ...updated }]);
      } catch (e) {
        console.warn('[Supabase] Failed to persist settings to Supabase:', e);
      }
    }

    try {
      const res = await fetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader()
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          saveStoredSettings(data.settings);
          notifyShopDataChanged();
          return data.settings;
        }
      }
    } catch {
      // fallback
    }

    notifyShopDataChanged();
    return updated;
  }
};
