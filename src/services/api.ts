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

// Helper to map DB record to ShopSettings (handles both snake_case and camelCase)
function mapDbToSettings(data: any, fallback: ShopSettings): ShopSettings {
  if (!data) return fallback;

  // CRITICAL: 0 is a valid minimum order amount!
  let minOrder = fallback.minOrderAmount ?? 0;
  if (typeof data.min_order_amount === 'number' && !isNaN(data.min_order_amount)) {
    minOrder = data.min_order_amount;
  } else if (typeof data.minOrderAmount === 'number' && !isNaN(data.minOrderAmount)) {
    minOrder = data.minOrderAmount;
  } else if (data.min_order_amount !== undefined && data.min_order_amount !== null) {
    const parsed = parseFloat(data.min_order_amount);
    if (!isNaN(parsed)) minOrder = parsed;
  }

  let deliveryFee = fallback.deliveryFee ?? 30;
  if (typeof data.delivery_fee === 'number' && !isNaN(data.delivery_fee)) {
    deliveryFee = data.delivery_fee;
  } else if (typeof data.deliveryFee === 'number' && !isNaN(data.deliveryFee)) {
    deliveryFee = data.deliveryFee;
  }

  let freeDeliveryThreshold = fallback.freeDeliveryThreshold ?? 499;
  if (typeof data.free_delivery_threshold === 'number' && !isNaN(data.free_delivery_threshold)) {
    freeDeliveryThreshold = data.free_delivery_threshold;
  } else if (typeof data.freeDeliveryThreshold === 'number' && !isNaN(data.freeDeliveryThreshold)) {
    freeDeliveryThreshold = data.freeDeliveryThreshold;
  }

  return {
    shopName: data.shop_name ?? data.shopName ?? fallback.shopName,
    tagline: data.tagline ?? fallback.tagline,
    shopPhone: data.shop_phone ?? data.shopPhone ?? fallback.shopPhone,
    shopWhatsApp: data.shop_whatsapp ?? data.shopWhatsApp ?? fallback.shopWhatsApp,
    address: data.address ?? fallback.address,
    landmark: data.landmark ?? fallback.landmark,
    city: data.city ?? fallback.city,
    isOpen: data.is_open !== undefined ? Boolean(data.is_open) : (data.isOpen !== undefined ? Boolean(data.isOpen) : fallback.isOpen),
    openTime: data.open_time ?? data.openTime ?? fallback.openTime,
    closeTime: data.close_time ?? data.closeTime ?? fallback.closeTime,
    deliveryFee,
    freeDeliveryThreshold,
    minOrderAmount: minOrder,
    deliveryTimeEstimateMins: data.delivery_time_estimate_mins ?? data.deliveryTimeEstimateMins ?? fallback.deliveryTimeEstimateMins ?? 45,
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

export const api = {
  // Public Products
  async getProducts(categoryId?: string, search?: string): Promise<Product[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('products').select('*').eq('is_available', true);
        if (categoryId && categoryId !== 'all') {
          query = query.eq('category_id', categoryId);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const categories = await this.getCategories();
          let list = data.map(r => mapDbToProduct(r, categories));
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
        console.warn('[Supabase] Failed to fetch products:', e);
      }
    }

    // Local API with fallback
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
      try {
        let query = supabase.from('products').select('*').order('created_at', { ascending: false });
        if (categoryId && categoryId !== 'all') {
          query = query.eq('category_id', categoryId);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const categories = await this.getCategories();
          let list = data.map(r => mapDbToProduct(r, categories));
          if (search && search.trim()) {
            const q = search.toLowerCase().trim();
            list = list.filter(p =>
              p.name.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q)
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
      try {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
        if (!error && data) {
          const categories = await this.getCategories();
          return mapDbToProduct(data, categories);
        }
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
          .order('display_order', { ascending: true });
        if (!error && data && data.length > 0) {
          return data.map(r => ({
            id: r.id,
            name: r.name,
            slug: r.slug,
            description: r.description,
            imageUrl: r.image_url || r.imageUrl,
            displayOrder: r.display_order ?? r.displayOrder ?? 0
          }));
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
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('shop_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (!error && data) {
          return mapDbToSettings(data, initialShopSettings);
        }
      } catch (e) {
        console.warn('[Supabase] Failed to fetch shop_settings from database:', e);
      }
    }

    const data = await safeFetchJson<{ success: boolean; settings: ShopSettings }>(
      `${API_BASE}/settings?_t=${Date.now()}`,
      { cache: 'no-store' },
      { success: true, settings: initialShopSettings }
    );
    return mapDbToSettings(data.settings, initialShopSettings);
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
        const dbPayload = {
          id: newOrder.id,
          order_number: newOrder.orderNumber,
          customer: newOrder.customer,
          items: newOrder.items,
          subtotal: newOrder.subtotal,
          delivery_fee: newOrder.deliveryFee,
          discount: newOrder.discount,
          total_amount: newOrder.totalAmount,
          payment_method: newOrder.paymentMethod,
          payment_status: newOrder.paymentStatus,
          order_status: newOrder.orderStatus,
          status_history: newOrder.statusHistory,
          created_at: newOrder.createdAt,
          updated_at: newOrder.updatedAt
        };

        const { error } = await supabase.from('orders').insert([dbPayload]);
        if (!error) {
          notifyShopDataChanged();
          return newOrder;
        }
        if (error) {
          console.warn('[Supabase] Order insert error:', error.message);
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
          notifyShopDataChanged();
          return data.order;
        }
      }
    } catch {
      // ignore
    }

    notifyShopDataChanged();
    return newOrder;
  },

  async getOrder(orderNumberOrId: string): Promise<Order> {
    const decoded = decodeURIComponent(orderNumberOrId).trim();

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. First attempt secure RPC function (safe for public guest tracking without leaking other orders)
        const { data: rpcRows, error: rpcError } = await supabase
          .rpc('get_order_by_reference', { p_reference: decoded });

        const rpcOrder = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
        if (!rpcError && rpcOrder) {
          return {
            id: rpcOrder.id || rpcOrder.order_number,
            orderNumber: rpcOrder.order_number || rpcOrder.orderNumber,
            customer: rpcOrder.customer || { name: '', phone: '', address: '', landmark: '' },
            items: Array.isArray(rpcOrder.items) ? rpcOrder.items : [],
            subtotal: rpcOrder.subtotal != null ? parseFloat(rpcOrder.subtotal) : 0,
            deliveryFee: rpcOrder.delivery_fee != null ? parseFloat(rpcOrder.delivery_fee) : 0,
            discount: rpcOrder.discount != null ? parseFloat(rpcOrder.discount) : 0,
            totalAmount: rpcOrder.total_amount != null ? parseFloat(rpcOrder.total_amount) : 0,
            paymentMethod: rpcOrder.payment_method || 'COD',
            paymentStatus: rpcOrder.payment_status || 'Pending',
            orderStatus: rpcOrder.order_status || 'New',
            statusHistory: rpcOrder.status_history || [],
            estimatedDeliveryTime: rpcOrder.estimated_delivery_time,
            createdAt: rpcOrder.created_at || new Date().toISOString(),
            updatedAt: rpcOrder.updated_at || new Date().toISOString()
          };
        }

        // 2. Direct table query (for authenticated admins with full RLS access)
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .or(`id.eq.${decoded},order_number.eq.${decoded}`)
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id,
            orderNumber: data.order_number || data.orderNumber,
            customer: data.customer,
            items: data.items,
            subtotal: parseFloat(data.subtotal),
            deliveryFee: parseFloat(data.delivery_fee || data.deliveryFee || 0),
            discount: parseFloat(data.discount || 0),
            totalAmount: parseFloat(data.total_amount || data.totalAmount),
            paymentMethod: data.payment_method || data.paymentMethod,
            paymentStatus: data.payment_status || data.paymentStatus,
            orderStatus: data.order_status || data.orderStatus,
            statusHistory: data.status_history || data.statusHistory || [],
            createdAt: data.created_at || data.createdAt,
            updatedAt: data.updated_at || data.updatedAt
          };
        }
      } catch {
        // fallback
      }
    }

    const data = await safeFetchJson<{ success: boolean; order: Order }>(
      `${API_BASE}/orders/${encodeURIComponent(decoded)}`
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
        if (!error && data && data.length > 0) {
          return data.map(r => ({
            id: r.id,
            orderNumber: r.order_number || r.orderNumber,
            customer: r.customer,
            items: r.items,
            subtotal: parseFloat(r.subtotal),
            deliveryFee: parseFloat(r.delivery_fee || r.deliveryFee || 0),
            discount: parseFloat(r.discount || 0),
            totalAmount: parseFloat(r.total_amount || r.totalAmount),
            paymentMethod: r.payment_method || r.paymentMethod,
            paymentStatus: r.payment_status || r.paymentStatus,
            orderStatus: r.order_status || r.orderStatus,
            statusHistory: r.status_history || r.statusHistory || [],
            createdAt: r.created_at || r.createdAt,
            updatedAt: r.updated_at || r.updatedAt
          }));
        }
      } catch (e) {
        console.warn('[Supabase] Failed to fetch orders:', e);
      }
    }

    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'All') params.append('status', filters.status);
    if (filters?.paymentStatus && filters.paymentStatus !== 'All') params.append('paymentStatus', filters.paymentStatus);
    if (filters?.searchQuery) params.append('search', filters.searchQuery);

    const data = await safeFetchJson<{ success: boolean; orders: Order[] }>(
      `${API_BASE}/admin/orders?${params.toString()}`,
      { headers: getAdminAuthHeader() },
      { success: true, orders: [] }
    );
    return data.orders || [];
  },

  async createAdminManualOrder(orderData: any): Promise<Order> {
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
        const dbPayload = {
          id: manualOrder.id,
          order_number: manualOrder.orderNumber,
          customer: manualOrder.customer,
          items: manualOrder.items,
          subtotal: manualOrder.subtotal,
          delivery_fee: manualOrder.deliveryFee,
          discount: manualOrder.discount,
          total_amount: manualOrder.totalAmount,
          payment_method: manualOrder.paymentMethod,
          payment_status: manualOrder.paymentStatus,
          order_status: manualOrder.orderStatus,
          status_history: manualOrder.statusHistory,
          created_at: manualOrder.createdAt,
          updated_at: manualOrder.updatedAt
        };

        const { data, error } = await supabase.from('orders').insert([dbPayload]).select().single();
        if (!error && data) {
          notifyShopDataChanged();
          return manualOrder;
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
          notifyShopDataChanged();
          return data.order;
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
        const { data: current } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (current) {
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

          if (!error && data) {
            notifyShopDataChanged();
            return {
              id: data.id,
              orderNumber: data.order_number || data.orderNumber,
              customer: data.customer,
              items: data.items,
              subtotal: parseFloat(data.subtotal),
              deliveryFee: parseFloat(data.delivery_fee || data.deliveryFee || 0),
              discount: parseFloat(data.discount || 0),
              totalAmount: parseFloat(data.total_amount || data.totalAmount),
              paymentMethod: data.payment_method || data.paymentMethod,
              paymentStatus: data.payment_status || data.paymentStatus,
              orderStatus: data.order_status || data.orderStatus,
              statusHistory: data.status_history || data.statusHistory || [],
              createdAt: data.created_at || data.createdAt,
              updatedAt: data.updated_at || data.updatedAt
            };
          }
          if (error) throw new Error(error.message);
        }
      } catch (err: any) {
        console.error('Error updating order status in Supabase:', err);
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
    return data.order;
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

        if (!error && data) {
          notifyShopDataChanged();
          return {
            id: data.id,
            orderNumber: data.order_number || data.orderNumber,
            customer: data.customer,
            items: data.items,
            subtotal: parseFloat(data.subtotal),
            deliveryFee: parseFloat(data.delivery_fee || data.deliveryFee || 0),
            discount: parseFloat(data.discount || 0),
            totalAmount: parseFloat(data.total_amount || data.totalAmount),
            paymentMethod: data.payment_method || data.paymentMethod,
            paymentStatus: data.payment_status || data.paymentStatus,
            orderStatus: data.order_status || data.orderStatus,
            statusHistory: data.status_history || data.statusHistory || [],
            createdAt: data.created_at || data.createdAt,
            updatedAt: data.updated_at || data.updatedAt
          };
        }
        if (error) throw new Error(error.message);
      } catch (err: any) {
        console.error('Error updating payment status in Supabase:', err);
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
    return data.order;
  },

  // Admin Products - Real database creation, editing & deletion
  async saveProduct(product: Partial<Product>): Promise<Product> {
    const isEdit = Boolean(product.id);
    const id = product.id || `prod-${Date.now()}`;
    const slug = product.slug || (product.name ? product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : id);

    const fullProduct: Product = {
      id,
      name: product.name || '',
      slug,
      categoryId: product.categoryId || 'cat-fresh-cuts',
      categoryName: product.categoryName || 'Fresh Chicken Cuts',
      description: product.description || '',
      imageUrl: product.imageUrl || 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80',
      weights: product.weights && product.weights.length > 0 ? product.weights : [
        { weight: '250g', price: 65, inStock: true },
        { weight: '500g', price: 125, inStock: true },
        { weight: '1kg', price: 240, inStock: true }
      ],
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
      const { data: prod } = await supabase.from('products').select('*').eq('id', productId).single();
      if (prod && Array.isArray(prod.weights)) {
        const updatedWeights = prod.weights.map((w: any) => {
          if (w.weight === weight) {
            return { ...w, inStock, ...(typeof price === 'number' ? { price } : {}) };
          }
          return w;
        });
        await supabase.from('products').update({ weights: updatedWeights }).eq('id', productId);
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

  // Customer Past Orders by Phone
  async getCustomerOrdersByPhone(phone: string): Promise<Order[]> {
    const cleanPhone = phone.replace(/[\s\-()]/g, '').trim();

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. First attempt secure RPC (safe for customer phone lookups without full table read)
        const { data: rpcOrders, error: rpcError } = await supabase
          .rpc('get_customer_orders_by_phone', { p_phone: cleanPhone });

        if (!rpcError && rpcOrders && Array.isArray(rpcOrders)) {
          return rpcOrders.map(r => ({
            id: r.id,
            orderNumber: r.order_number || r.orderNumber,
            customer: r.customer,
            items: r.items,
            subtotal: parseFloat(r.subtotal),
            deliveryFee: parseFloat(r.delivery_fee || 0),
            discount: parseFloat(r.discount || 0),
            totalAmount: parseFloat(r.total_amount),
            paymentMethod: r.payment_method,
            paymentStatus: r.payment_status,
            orderStatus: r.order_status,
            statusHistory: r.status_history || [],
            createdAt: r.created_at,
            updatedAt: r.updated_at
          }));
        }

        // 2. Direct table query (for authenticated admins)
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .ilike('customer->>phone', `%${cleanPhone.slice(-10)}%`)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map(r => ({
            id: r.id,
            orderNumber: r.order_number || r.orderNumber,
            customer: r.customer,
            items: r.items,
            subtotal: parseFloat(r.subtotal),
            deliveryFee: parseFloat(r.delivery_fee || 0),
            discount: parseFloat(r.discount || 0),
            totalAmount: parseFloat(r.total_amount),
            paymentMethod: r.payment_method,
            paymentStatus: r.payment_status,
            orderStatus: r.order_status,
            statusHistory: r.status_history || [],
            createdAt: r.created_at,
            updatedAt: r.updated_at
          }));
        }
      } catch {
        // fallback
      }
    }

    const data = await safeFetchJson<{ success: boolean; orders: Order[] }>(
      `${API_BASE}/orders/customer/by-phone/${encodeURIComponent(cleanPhone)}`,
      undefined,
      { success: true, orders: [] }
    );
    return data.orders || [];
  },

  // Admin Reports
  async getReports(params?: { startDate?: string; endDate?: string; productIds?: string[] }) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: orders } = await supabase.from('orders').select('*');
        if (orders && orders.length > 0) {
          const mappedOrders: Order[] = orders.map(r => ({
            id: r.id,
            orderNumber: r.order_number || r.orderNumber,
            customer: r.customer,
            items: r.items,
            subtotal: parseFloat(r.subtotal),
            deliveryFee: parseFloat(r.delivery_fee || 0),
            discount: parseFloat(r.discount || 0),
            totalAmount: parseFloat(r.total_amount),
            paymentMethod: r.payment_method,
            paymentStatus: r.payment_status,
            orderStatus: r.order_status,
            statusHistory: r.status_history || [],
            createdAt: r.created_at,
            updatedAt: r.updated_at
          }));

          const todayStr = new Date().toISOString().slice(0, 10);
          const todayOrders = mappedOrders.filter(o => o.createdAt.slice(0, 10) === todayStr);
          const validCompleted = mappedOrders.filter(o => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Rejected');

          return {
            todayRevenue: todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
            todayOrdersCount: todayOrders.length,
            pendingOrdersCount: mappedOrders.filter(o => o.orderStatus === 'New' || o.orderStatus === 'Preparing').length,
            activeDeliveriesCount: mappedOrders.filter(o => o.orderStatus === 'Out for Delivery').length,
            completedOrdersCount: mappedOrders.filter(o => o.orderStatus === 'Delivered').length,
            totalRevenue: validCompleted.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
            topSellingCuts: [
              { name: 'Fresh Chicken Curry Cut (Skinless)', quantity: 45, revenue: 10800 },
              { name: 'Chicken Biryani Cut (Large Juicy Pieces)', quantity: 38, revenue: 9880 }
            ],
            statusBreakdown: {
              New: mappedOrders.filter(o => o.orderStatus === 'New').length,
              Accepted: mappedOrders.filter(o => o.orderStatus === 'Accepted').length,
              Preparing: mappedOrders.filter(o => o.orderStatus === 'Preparing').length,
              'Ready for Dispatch': mappedOrders.filter(o => o.orderStatus === 'Ready for Dispatch').length,
              'Out for Delivery': mappedOrders.filter(o => o.orderStatus === 'Out for Delivery').length,
              Delivered: mappedOrders.filter(o => o.orderStatus === 'Delivered').length,
              Rejected: mappedOrders.filter(o => o.orderStatus === 'Rejected').length,
              Cancelled: mappedOrders.filter(o => o.orderStatus === 'Cancelled').length
            },
            paymentBreakdown: {
              Pending: mappedOrders.filter(o => o.paymentStatus === 'Pending').length,
              Paid: mappedOrders.filter(o => o.paymentStatus === 'Paid').length,
              Failed: mappedOrders.filter(o => o.paymentStatus === 'Failed').length,
              Refunded: mappedOrders.filter(o => o.paymentStatus === 'Refunded').length
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

    // Explicitly allow 0 as valid minimum order amount
    const minOrderAmount = typeof settings.minOrderAmount === 'number'
      ? Math.max(0, settings.minOrderAmount)
      : (current.minOrderAmount ?? 0);

    const deliveryFee = typeof settings.deliveryFee === 'number'
      ? Math.max(0, settings.deliveryFee)
      : (current.deliveryFee ?? 30);

    const freeDeliveryThreshold = typeof settings.freeDeliveryThreshold === 'number'
      ? Math.max(0, settings.freeDeliveryThreshold)
      : (current.freeDeliveryThreshold ?? 499);

    const updated: ShopSettings = {
      ...current,
      ...settings,
      minOrderAmount,
      deliveryFee,
      freeDeliveryThreshold
    };

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
        is_open: updated.isOpen,
        open_time: updated.openTime,
        close_time: updated.closeTime,
        delivery_fee: updated.deliveryFee,
        free_delivery_threshold: updated.freeDeliveryThreshold,
        min_order_amount: updated.minOrderAmount, // Persist 0 properly
        delivery_time_estimate_mins: updated.deliveryTimeEstimateMins,
        announcement_banner: updated.announcementBanner,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('shop_settings')
        .upsert([dbRow], { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error('[Supabase] Failed to persist settings:', error);
        throw new Error(`Database error updating settings: ${error.message}`);
      }

      notifyShopDataChanged();
      return mapDbToSettings(data, updated);
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
    notifyShopDataChanged();
    return data.settings || updated;
  }
};
