import {
  Product,
  Category,
  ShopSettings,
  Order,
  CreateOrderRequest,
  OrderFilterParams,
  AdminUser,
  WeightUnit
} from '../types/index.js';

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

export const api = {
  // Public Products
  async getProducts(categoryId?: string, search?: string): Promise<Product[]> {
    const params = new URLSearchParams();
    if (categoryId && categoryId !== 'all') params.append('category', categoryId);
    if (search) params.append('search', search);
    params.append('_t', Date.now().toString());

    const res = await fetch(`${API_BASE}/products?${params.toString()}`, {
      cache: 'no-store'
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch products');
    return data.products;
  },

  // Admin Products (includes all active & deactivated items)
  async getAdminProducts(search?: string, categoryId?: string): Promise<Product[]> {
    const params = new URLSearchParams();
    if (categoryId && categoryId !== 'all') params.append('category', categoryId);
    if (search) params.append('search', search);
    params.append('_t', Date.now().toString());

    const res = await fetch(`${API_BASE}/admin/products?${params.toString()}`, {
      headers: getAdminAuthHeader(),
      cache: 'no-store'
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch admin products');
    return data.products;
  },

  async getProductById(id: string): Promise<Product> {
    const res = await fetch(`${API_BASE}/products/${id}?_t=${Date.now()}`, {
      cache: 'no-store'
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Product not found');
    return data.product;
  },

  // Public Categories
  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${API_BASE}/categories?_t=${Date.now()}`, {
      cache: 'no-store'
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch categories');
    return data.categories;
  },

  // Public Shop Settings
  async getShopSettings(): Promise<ShopSettings> {
    const res = await fetch(`${API_BASE}/settings?_t=${Date.now()}`, {
      cache: 'no-store'
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch shop settings');
    return data.settings;
  },

  // Orders
  async createOrder(payload: CreateOrderRequest): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to place order');
    return data.order;
  },

  async getOrder(orderNumberOrId: string): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderNumberOrId)}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Order not found');
    return data.order;
  },

  // Payment Session (Pending UPI status check)
  async getUpiSession(orderId: string, amountInPaise: number) {
    const res = await fetch(`${API_BASE}/payment/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, amountInPaise })
    });
    return res.json();
  },

  // Admin Authentication
  async adminLogin(username: string, passwordPlain: string): Promise<{ token: string; admin: AdminUser }> {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: passwordPlain })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Invalid admin credentials');
    return { token: data.token, admin: data.admin };
  },

  async adminLogout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/admin/logout`, {
        method: 'POST',
        headers: getAdminAuthHeader()
      });
    } catch {
      // Ignore network errors on logout
    }
  },

  async getAdminMe(): Promise<AdminUser | null> {
    try {
      const res = await fetch(`${API_BASE}/admin/me`, {
        headers: getAdminAuthHeader()
      });
      const data = await res.json();
      return data.success ? data.admin : null;
    } catch {
      return null;
    }
  },

  // Admin Orders
  async getAdminOrders(filters?: OrderFilterParams): Promise<Order[]> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'All') params.append('status', filters.status);
    if (filters?.paymentStatus && filters.paymentStatus !== 'All') params.append('paymentStatus', filters.paymentStatus);
    if (filters?.searchQuery) params.append('search', filters.searchQuery);

    const res = await fetch(`${API_BASE}/admin/orders?${params.toString()}`, {
      headers: getAdminAuthHeader()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch admin orders');
    return data.orders;
  },

  async createAdminManualOrder(orderData: any): Promise<Order> {
    const res = await fetch(`${API_BASE}/admin/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify(orderData)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create manual order');
    notifyShopDataChanged();
    return data.order;
  },

  async updateOrderStatus(orderId: string, status: string, note?: string): Promise<Order> {
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
    return data.order;
  },

  async updatePaymentStatus(orderId: string, paymentStatus: string): Promise<Order> {
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
    return data.order;
  },

  // Admin Products
  async saveProduct(product: Partial<Product>): Promise<Product> {
    const isEdit = Boolean(product.id);
    const url = isEdit ? `${API_BASE}/admin/products/${product.id}` : `${API_BASE}/admin/products`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify(product)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to save product');
    notifyShopDataChanged();
    return data.product;
  },

  async deleteProduct(productId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/products/${productId}`, {
      method: 'DELETE',
      headers: getAdminAuthHeader()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete product');
    notifyShopDataChanged();
  },

  async toggleProductStock(productId: string, isAvailable: boolean): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/products/${productId}/stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify({ isAvailable })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update product stock');
    notifyShopDataChanged();
  },

  async updateWeightStock(productId: string, weight: WeightUnit, inStock: boolean, price?: number): Promise<void> {
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
    return data.category;
  },

  async deleteCategory(categoryId: string): Promise<void> {
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
    const res = await fetch(`${API_BASE}/admin/upload-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify({ imageBase64, mimeType, filename })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to upload image');
    return data.result.url;
  },

  // Customer Past Orders by Phone
  async getCustomerOrdersByPhone(phone: string): Promise<Order[]> {
    const res = await fetch(`${API_BASE}/orders/customer/by-phone/${encodeURIComponent(phone.trim())}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch customer orders');
    return data.orders;
  },

  // Admin Reports
  async getReports(params?: { startDate?: string; endDate?: string; productIds?: string[] }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.productIds && params.productIds.length > 0) {
      query.append('productIds', params.productIds.join(','));
    }

    const url = `${API_BASE}/admin/reports${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      headers: getAdminAuthHeader()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch sales reports');
    return data.reports;
  },

  // Admin Settings
  async updateSettings(settings: Partial<ShopSettings>): Promise<ShopSettings> {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeader()
      },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update settings');
    notifyShopDataChanged();
    return data.settings;
  }
};
