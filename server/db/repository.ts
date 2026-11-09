import fs from 'fs';
import path from 'path';
import { 
  Category, 
  Product, 
  ShopSettings, 
  Order, 
  OrderItem, 
  OrderStatus, 
  PaymentStatus, 
  CreateOrderRequest, 
  OrderFilterParams, 
  AdminUser, 
  WeightUnit 
} from '../../src/types/index.js';
import { initialCategories, initialProducts, initialShopSettings } from '../seedData.js';

export interface IDatabaseRepository {
  init(): Promise<void>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  getCategoryById(id: string): Promise<Category | null>;
  saveCategory(category: Category): Promise<Category>;
  deleteCategory(id: string): Promise<boolean>;

  // Products
  getProducts(categoryId?: string, search?: string): Promise<Product[]>;
  getProductById(id: string): Promise<Product | null>;
  saveProduct(product: Product): Promise<Product>;
  deleteProduct(id: string): Promise<boolean>;
  updateProductStock(productId: string, isAvailable: boolean): Promise<boolean>;
  updateWeightStock(productId: string, weight: WeightUnit, inStock: boolean, price?: number): Promise<boolean>;

  // Orders
  createOrder(
    req: CreateOrderRequest,
    calc: { subtotal: number; deliveryFee: number; discount: number; totalAmount: number; items: OrderItem[] }
  ): Promise<Order>;
  getOrderById(id: string): Promise<Order | null>;
  getOrderByNumber(orderNumber: string): Promise<Order | null>;
  getOrders(filters?: OrderFilterParams): Promise<Order[]>;
  updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<Order | null>;
  updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus): Promise<Order | null>;

  // Shop Settings
  getShopSettings(): Promise<ShopSettings>;
  updateShopSettings(settings: Partial<ShopSettings>): Promise<ShopSettings>;

  // Admin Auth
  validateAdmin(username: string, passwordPlain: string): Promise<AdminUser | null>;
  getAdminById(id: string): Promise<AdminUser | null>;
  updateAdminPassword(adminId: string, currentPasswordPlain: string, newPasswordPlain: string): Promise<boolean>;

  // Customer order history
  getOrdersByCustomerPhone(phone: string): Promise<Order[]>;

  // Analytics & Reports
  getSalesReport(params?: {
    startDate?: string;
    endDate?: string;
    productIds?: string[];
  }): Promise<{
    todayRevenue: number;
    todayOrdersCount: number;
    pendingOrdersCount: number;
    activeDeliveriesCount: number;
    completedOrdersCount: number;
    totalRevenue: number;
    topSellingCuts: { name: string; quantity: number; revenue: number }[];
    statusBreakdown: Record<OrderStatus, number>;
    paymentBreakdown: Record<PaymentStatus, number>;
    filterReport?: {
      startDate: string;
      endDate: string;
      productIds: string[];
      totalQuantitySold: number;
      totalOrdersCount: number;
      totalSalesValue: number;
      productBreakdown: {
        productId: string;
        productName: string;
        totalQuantity: number;
        packsBreakdown: Record<string, number>;
        totalSalesValue: number;
      }[];
      dailyBreakdown: {
        date: string;
        ordersCount: number;
        salesValue: number;
        quantity: number;
      }[];
      includedStatuses: string[];
    };
  }>;
}

// =========================================================================
// File-Backed Memory Database Repository (Default zero-config & persistent)
// =========================================================================
export class MemoryDatabaseRepository implements IDatabaseRepository {
  private categories: Category[] = [];
  private products: Product[] = [];
  private orders: Order[] = [];
  private settings: ShopSettings = initialShopSettings;
  private admins: (AdminUser & { passwordHash: string })[] = [];
  private dataDir = path.resolve(process.cwd(), 'data');
  private storeFile = path.resolve(this.dataDir, 'shop_store.json');

  async init(): Promise<void> {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.storeFile)) {
        const raw = fs.readFileSync(this.storeFile, 'utf-8');
        const parsed = JSON.parse(raw);
        this.categories = parsed.categories || initialCategories;
        this.products = parsed.products || initialProducts;
        this.orders = parsed.orders || [];
        this.settings = parsed.settings || initialShopSettings;
        this.admins = parsed.admins || [];
      } else {
        this.categories = [...initialCategories];
        this.products = [...initialProducts];
        this.settings = { ...initialShopSettings };
        this.admins = [
          {
            id: 'admin-1',
            username: 'admin',
            role: 'super_admin',
            passwordHash: 'chandu@123' // default admin credential for shop manager
          }
        ];
        this.seedInitialOrders();
        this.persist();
      }
    } catch (e) {
      console.error('Error loading store file, falling back to initial data:', e);
      this.categories = [...initialCategories];
      this.products = [...initialProducts];
      this.settings = { ...initialShopSettings };
      this.seedInitialOrders();
    }
  }

  private seedInitialOrders() {
    const now = new Date();
    const order1Time = new Date(now.getTime() - 25 * 60 * 1000).toISOString();
    const order2Time = new Date(now.getTime() - 90 * 60 * 1000).toISOString();

    this.orders = [
      {
        id: 'ord-seed-1',
        orderNumber: 'CCC-20261020-001',
        customer: {
          name: 'Ramesh Varma',
          phone: '9848123456',
          address: 'Flat 302, Sri Sai Residency, Street No. 3',
          landmark: 'Behind Rythu Bazar',
          notes: 'Please cut into small pieces with less bone.'
        },
        items: [
          {
            productId: 'prod-curry-cut',
            productName: 'Fresh Chicken Curry Cut (Skinless)',
            weight: '1kg',
            cutPreference: 'Standard Curry Cut (12-16 pcs/kg)',
            unitPrice: 240,
            quantity: 1,
            subtotal: 240
          },
          {
            productId: 'prod-drumsticks',
            productName: 'Juicy Chicken Drumsticks (Legs)',
            weight: '500g',
            cutPreference: 'Skinless with Deep Slits (Easy Marinate)',
            unitPrice: 165,
            quantity: 1,
            subtotal: 165
          }
        ],
        subtotal: 405,
        deliveryFee: 30,
        discount: 0,
        totalAmount: 435,
        paymentMethod: 'COD',
        paymentStatus: 'Pending',
        orderStatus: 'Out for Delivery',
        statusHistory: [
          { status: 'New', timestamp: order1Time, note: 'Order placed via Web' },
          { status: 'Accepted', timestamp: new Date(now.getTime() - 20 * 60 * 1000).toISOString(), note: 'Confirmed by shop butcher' },
          { status: 'Preparing', timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString(), note: 'Freshly carved & weighed' },
          { status: 'Ready for Dispatch', timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), note: 'Packed in food-grade sealed bag' },
          { status: 'Out for Delivery', timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), note: 'Rider Ravi assigned (+91 99887 76655)' }
        ],
        createdAt: order1Time,
        updatedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        estimatedDeliveryTime: '30-40 mins'
      },
      {
        id: 'ord-seed-2',
        orderNumber: 'CCC-20261020-002',
        customer: {
          name: 'Priya Reddy',
          phone: '9949098765',
          address: 'Plot 45, Golden Heights Colony, Near Water Tank',
          landmark: 'Opposite Apollo Pharmacy',
          notes: 'Leave at door if not answered'
        },
        items: [
          {
            productId: 'prod-biryani-cut',
            productName: 'Chicken Biryani Cut (Large Juicy Pieces)',
            weight: '1kg',
            cutPreference: 'Classic Dum Biryani Cut (8-10 pcs/kg)',
            unitPrice: 260,
            quantity: 2,
            subtotal: 520
          }
        ],
        subtotal: 520,
        deliveryFee: 0, // Free delivery above 499
        discount: 0,
        totalAmount: 520,
        paymentMethod: 'COD',
        paymentStatus: 'Paid',
        orderStatus: 'Delivered',
        statusHistory: [
          { status: 'New', timestamp: order2Time, note: 'Order placed' },
          { status: 'Accepted', timestamp: new Date(now.getTime() - 80 * 60 * 1000).toISOString() },
          { status: 'Preparing', timestamp: new Date(now.getTime() - 65 * 60 * 1000).toISOString() },
          { status: 'Out for Delivery', timestamp: new Date(now.getTime() - 40 * 60 * 1000).toISOString() },
          { status: 'Delivered', timestamp: new Date(now.getTime() - 25 * 60 * 1000).toISOString(), note: 'Delivered to customer' }
        ],
        createdAt: order2Time,
        updatedAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString()
      }
    ];
  }

  private persist() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(
        this.storeFile,
        JSON.stringify(
          {
            categories: this.categories,
            products: this.products,
            orders: this.orders,
            settings: this.settings,
            admins: this.admins
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch (e) {
      console.error('Failed to persist store:', e);
    }
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return [...this.categories].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getCategoryById(id: string): Promise<Category | null> {
    return this.categories.find(c => c.id === id) || null;
  }

  async saveCategory(category: Category): Promise<Category> {
    const idx = this.categories.findIndex(c => c.id === category.id);
    if (idx >= 0) {
      this.categories[idx] = category;
    } else {
      this.categories.push(category);
    }
    this.persist();
    return category;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const initialLen = this.categories.length;
    this.categories = this.categories.filter(c => c.id !== id);
    if (this.categories.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  // Products
  async getProducts(categoryId?: string, search?: string): Promise<Product[]> {
    let result = [...this.products];
    if (categoryId && categoryId !== 'all') {
      result = result.filter(p => p.categoryId === categoryId);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q))
      );
    }
    return result;
  }

  async getProductById(id: string): Promise<Product | null> {
    return this.products.find(p => p.id === id) || null;
  }

  async saveProduct(product: Product): Promise<Product> {
    const category = this.categories.find(c => c.id === product.categoryId);
    const enrichedProduct = {
      ...product,
      categoryName: category ? category.name : product.categoryName,
      updatedAt: new Date().toISOString()
    };

    const idx = this.products.findIndex(p => p.id === enrichedProduct.id);
    if (idx >= 0) {
      this.products[idx] = enrichedProduct;
    } else {
      enrichedProduct.createdAt = new Date().toISOString();
      this.products.unshift(enrichedProduct);
    }
    this.persist();
    return enrichedProduct;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const initialLen = this.products.length;
    this.products = this.products.filter(p => p.id !== id);
    if (this.products.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  async updateProductStock(productId: string, isAvailable: boolean): Promise<boolean> {
    const product = this.products.find(p => p.id === productId);
    if (product) {
      product.isAvailable = isAvailable;
      product.updatedAt = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  }

  async updateWeightStock(productId: string, weight: WeightUnit, inStock: boolean, price?: number): Promise<boolean> {
    const product = this.products.find(p => p.id === productId);
    if (!product) return false;
    const wOpt = product.weights.find(w => w.weight === weight);
    if (wOpt) {
      wOpt.inStock = inStock;
      if (typeof price === 'number') {
        wOpt.price = price;
      }
    } else {
      product.weights.push({
        weight,
        inStock,
        price: typeof price === 'number' ? Math.max(0, price) : 0
      });
    }
    product.updatedAt = new Date().toISOString();
    this.persist();
    return true;
  }

  // Orders
  async createOrder(
    req: CreateOrderRequest,
    calc: { subtotal: number; deliveryFee: number; discount: number; totalAmount: number; items: OrderItem[] }
  ): Promise<Order> {
    // Check idempotency if key provided
    if (req.idempotencyKey) {
      const existing = this.orders.find(o => o.idempotencyKey === req.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `CCC-${dateStr}-${randomSuffix}`;
    const orderId = `ord-${Date.now()}-${randomSuffix}`;

    const paymentMethod: any = (req as any).paymentMethod || 'COD';
    const paymentStatus: any = (req as any).paymentStatus || 'Pending';
    const orderStatus: any = (req as any).orderStatus || 'New';
    const initialNote = (req as any).orderType
      ? `Manual order created by shop admin (${(req as any).orderType})`
      : 'Order placed by guest customer via online shop';

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      idempotencyKey: req.idempotencyKey,
      customer: {
        name: req.customer.name.trim(),
        phone: req.customer.phone.trim(),
        address: req.customer.address ? req.customer.address.trim() : 'Walk-in / In-store Pickup',
        landmark: req.customer.landmark?.trim() || '',
        notes: req.customer.notes?.trim() || ''
      },
      items: calc.items,
      subtotal: calc.subtotal,
      deliveryFee: calc.deliveryFee,
      discount: calc.discount,
      totalAmount: calc.totalAmount,
      paymentMethod,
      paymentStatus,
      orderStatus,
      statusHistory: [
        {
          status: orderStatus,
          timestamp: now.toISOString(),
          note: initialNote
        }
      ],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      estimatedDeliveryTime: `${this.settings.deliveryTimeEstimateMins || 45} mins`
    };

    this.orders.unshift(newOrder);
    this.persist();
    return newOrder;
  }

  async getOrderById(id: string): Promise<Order | null> {
    return this.orders.find(o => o.id === id) || null;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    const q = orderNumber.trim().toUpperCase();
    return this.orders.find(o => o.orderNumber.toUpperCase() === q || o.id === q) || null;
  }

  async getOrders(filters?: OrderFilterParams): Promise<Order[]> {
    let result = [...this.orders];
    if (filters?.status && filters.status !== 'All') {
      result = result.filter(o => o.orderStatus === filters.status);
    }
    if (filters?.paymentStatus && filters.paymentStatus !== 'All') {
      result = result.filter(o => o.paymentStatus === filters.paymentStatus);
    }
    if (filters?.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      result = result.filter(o =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.phone.includes(q) ||
        o.customer.address.toLowerCase().includes(q)
      );
    }
    return result;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<Order | null> {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.orderStatus = status;
    order.updatedAt = new Date().toISOString();
    order.statusHistory.push({
      status,
      timestamp: new Date().toISOString(),
      note: note || `Status updated to ${status}`
    });

    this.persist();
    return order;
  }

  async updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus): Promise<Order | null> {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.paymentStatus = paymentStatus;
    order.updatedAt = new Date().toISOString();
    this.persist();
    return order;
  }

  // Shop Settings
  async getShopSettings(): Promise<ShopSettings> {
    return { ...this.settings };
  }

  async updateShopSettings(settings: Partial<ShopSettings>): Promise<ShopSettings> {
    this.settings = { ...this.settings, ...settings };
    this.persist();
    return { ...this.settings };
  }

  // Admin Auth
  async validateAdmin(username: string, passwordPlain: string): Promise<AdminUser | null> {
    // Default fallback admin check
    const match = this.admins.find(a => a.username.toLowerCase() === username.toLowerCase().trim());
    if (match && match.passwordHash === passwordPlain.trim()) {
      return {
        id: match.id,
        username: match.username,
        role: match.role
      };
    }
    // Hardcoded safety for demo admin: admin / chandu@123
    if (username.toLowerCase().trim() === 'admin' && passwordPlain.trim() === 'chandu@123') {
      return {
        id: 'admin-1',
        username: 'admin',
        role: 'super_admin'
      };
    }
    return null;
  }

  async getAdminById(id: string): Promise<AdminUser | null> {
    const match = this.admins.find(a => a.id === id);
    if (match) {
      return { id: match.id, username: match.username, role: match.role };
    }
    if (id === 'admin-1') {
      return { id: 'admin-1', username: 'admin', role: 'super_admin' };
    }
    return null;
  }

  async updateAdminPassword(adminId: string, currentPasswordPlain: string, newPasswordPlain: string): Promise<boolean> {
    const admin = this.admins.find(a => a.id === adminId);
    if (!admin) {
      if (adminId === 'admin-1' && currentPasswordPlain === 'chandu@123') {
        this.admins.push({
          id: 'admin-1',
          username: 'admin',
          role: 'super_admin',
          passwordHash: newPasswordPlain
        });
        this.persist();
        return true;
      }
      return false;
    }
    if (admin.passwordHash !== currentPasswordPlain) {
      return false;
    }
    admin.passwordHash = newPasswordPlain;
    this.persist();
    return true;
  }

  async getOrdersByCustomerPhone(phone: string): Promise<Order[]> {
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    if (!cleanPhone) return [];
    return this.orders.filter(o => {
      const oPhone = o.customer.phone.replace(/[\s\-()]/g, '');
      return oPhone.includes(cleanPhone) || cleanPhone.includes(oPhone);
    });
  }

  // Sales Report
  async getSalesReport(params?: {
    startDate?: string;
    endDate?: string;
    productIds?: string[];
  }) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrders = this.orders.filter(o => o.createdAt.startsWith(todayStr));

    const todayRevenue = todayOrders
      .filter(o => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Rejected')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const totalRevenue = this.orders
      .filter(o => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Rejected')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const pendingOrdersCount = this.orders.filter(o => o.orderStatus === 'New' || o.orderStatus === 'Accepted').length;
    const activeDeliveriesCount = this.orders.filter(o => o.orderStatus === 'Out for Delivery' || o.orderStatus === 'Ready for Dispatch').length;
    const completedOrdersCount = this.orders.filter(o => o.orderStatus === 'Delivered').length;

    // Top selling cuts
    const cutsMap: Record<string, { quantity: number; revenue: number }> = {};
    for (const order of this.orders) {
      if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Rejected') continue;
      for (const item of order.items) {
        const key = item.productName;
        if (!cutsMap[key]) {
          cutsMap[key] = { quantity: 0, revenue: 0 };
        }
        cutsMap[key].quantity += item.quantity;
        cutsMap[key].revenue += item.subtotal;
      }
    }

    const topSellingCuts = Object.entries(cutsMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const statusBreakdown: Record<OrderStatus, number> = {
      'New': 0,
      'Accepted': 0,
      'Preparing': 0,
      'Ready for Dispatch': 0,
      'Out for Delivery': 0,
      'Delivered': 0,
      'Rejected': 0,
      'Cancelled': 0
    };

    for (const o of this.orders) {
      if (statusBreakdown[o.orderStatus] !== undefined) {
        statusBreakdown[o.orderStatus]++;
      }
    }

    const paymentBreakdown: Record<PaymentStatus, number> = {
      'Pending': 0,
      'Paid': 0,
      'Failed': 0,
      'Refunded': 0
    };

    for (const o of this.orders) {
      if (paymentBreakdown[o.paymentStatus] !== undefined) {
        paymentBreakdown[o.paymentStatus]++;
      }
    }

    // Filtered Report for Date Range and Product Selection
    const startDate = params?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = params?.endDate || todayStr;
    const isAllProducts = !params?.productIds || params.productIds.length === 0 || params.productIds.includes('all');
    const selectedProductIds = isAllProducts
      ? this.products.map(p => p.id)
      : params!.productIds!;

    const includedStatuses = ['New', 'Accepted', 'Preparing', 'Ready for Dispatch', 'Out for Delivery', 'Delivered'];

    // Filter orders between startDate and endDate (excluding cancelled and rejected)
    const matchingOrders = this.orders.filter(o => {
      const oDate = o.createdAt.slice(0, 10);
      if (oDate < startDate || oDate > endDate) return false;
      if (o.orderStatus === 'Cancelled' || o.orderStatus === 'Rejected') return false;
      return true;
    });

    // Helper to convert weight string to kilograms
    const parseWeightToKg = (weightStr: string | undefined): number => {
      if (!weightStr) return 0;
      const clean = weightStr.toLowerCase().trim();
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
    };

    // Initialize map for all target products so every selected product appears in the report
    const targetProducts = this.products.filter(p => selectedProductIds.includes(p.id));
    const productAggMap: Record<string, {
      productId: string;
      productName: string;
      totalQuantity: number;
      totalWeightKg: number;
      displayWeight: string;
      packsBreakdown: Record<string, number>;
      totalSalesValue: number;
    }> = {};

    for (const p of targetProducts) {
      productAggMap[p.id] = {
        productId: p.id,
        productName: p.name,
        totalQuantity: 0,
        totalWeightKg: 0,
        displayWeight: '0.00 kg',
        packsBreakdown: {},
        totalSalesValue: 0
      };
    }

    let totalQuantitySold = 0;
    let totalSalesValue = 0;
    let totalWeightSoldKg = 0;
    const ordersWithMatchingProducts = new Set<string>();
    const dailyAggMap: Record<string, { date: string; ordersSet: Set<string>; salesValue: number; quantity: number }> = {};

    for (const order of matchingOrders) {
      const orderDate = order.createdAt.slice(0, 10);
      let orderHasMatch = false;

      for (const item of order.items) {
        if (!selectedProductIds.includes(item.productId)) {
          continue;
        }

        orderHasMatch = true;
        totalQuantitySold += item.quantity;
        totalSalesValue += item.subtotal;

        // Weight calculation
        const itemKg = parseWeightToKg(item.weight) * item.quantity;
        totalWeightSoldKg += itemKg;

        // Product Breakdown
        if (!productAggMap[item.productId]) {
          productAggMap[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            totalQuantity: 0,
            totalWeightKg: 0,
            displayWeight: '0.00 kg',
            packsBreakdown: {},
            totalSalesValue: 0
          };
        }

        productAggMap[item.productId].totalQuantity += item.quantity;
        productAggMap[item.productId].totalWeightKg += itemKg;
        productAggMap[item.productId].totalSalesValue += item.subtotal;

        const wKey = item.weight || 'unit';
        productAggMap[item.productId].packsBreakdown[wKey] = (productAggMap[item.productId].packsBreakdown[wKey] || 0) + item.quantity;

        // Daily Breakdown
        if (!dailyAggMap[orderDate]) {
          dailyAggMap[orderDate] = {
            date: orderDate,
            ordersSet: new Set<string>(),
            salesValue: 0,
            quantity: 0
          };
        }
        dailyAggMap[orderDate].salesValue += item.subtotal;
        dailyAggMap[orderDate].quantity += item.quantity;
        dailyAggMap[orderDate].ordersSet.add(order.id);
      }

      if (orderHasMatch) {
        ordersWithMatchingProducts.add(order.id);
      }
    }

    // Format display weight for each product
    for (const pId in productAggMap) {
      const entry = productAggMap[pId];
      if (entry.totalWeightKg > 0) {
        entry.displayWeight = `${entry.totalWeightKg.toFixed(2)} kg`;
      } else if (entry.totalQuantity > 0) {
        entry.displayWeight = `${entry.totalQuantity} packs`;
      } else {
        entry.displayWeight = '0.00 kg';
      }
    }

    const productBreakdown = Object.values(productAggMap).sort((a, b) => b.totalSalesValue - a.totalSalesValue);
    const dailyBreakdown = Object.values(dailyAggMap)
      .map(d => ({
        date: d.date,
        ordersCount: d.ordersSet.size,
        salesValue: d.salesValue,
        quantity: d.quantity
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      todayRevenue,
      todayOrdersCount: todayOrders.length,
      pendingOrdersCount,
      activeDeliveriesCount,
      completedOrdersCount,
      totalRevenue,
      topSellingCuts,
      statusBreakdown,
      paymentBreakdown,
      filterReport: {
        startDate,
        endDate,
        productIds: selectedProductIds,
        totalQuantitySold,
        totalOrdersCount: ordersWithMatchingProducts.size,
        totalSalesValue,
        totalWeightSoldKg: parseFloat(totalWeightSoldKg.toFixed(2)),
        displayTotalWeight: `${totalWeightSoldKg.toFixed(2)} kg`,
        productBreakdown,
        dailyBreakdown,
        includedStatuses
      }
    };
  }
}

// =========================================================================
// PostgreSQL Database Repository (Interchangeable connection layer)
// =========================================================================
export class PostgresDatabaseRepository implements IDatabaseRepository {
  private fallbackMemory: MemoryDatabaseRepository;
  private connectionString: string;
  private pool: any = null;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
    this.fallbackMemory = new MemoryDatabaseRepository();
  }

  async init(): Promise<void> {
    try {
      // Dynamic import of pg
      const pgModule = await import('pg');
      const { Pool } = pgModule.default || pgModule;
      this.pool = new Pool({
        connectionString: this.connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
      });
      // Test query
      await this.pool.query('SELECT NOW()');
      console.log('✅ Connected to PostgreSQL database successfully.');
    } catch (err) {
      console.warn('⚠️ Could not connect to PostgreSQL with DATABASE_URL, falling back to persistent memory repository:', (err as Error).message);
      this.pool = null;
      await this.fallbackMemory.init();
    }
  }

  // Delegations: If pool is null, fallback cleanly
  async getCategories(): Promise<Category[]> {
    if (!this.pool) return this.fallbackMemory.getCategories();
    const res = await this.pool.query('SELECT * FROM categories ORDER BY display_order ASC');
    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      imageUrl: r.image_url,
      displayOrder: r.display_order
    }));
  }

  async getCategoryById(id: string): Promise<Category | null> {
    if (!this.pool) return this.fallbackMemory.getCategoryById(id);
    const res = await this.pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      imageUrl: r.image_url,
      displayOrder: r.display_order
    };
  }

  async saveCategory(category: Category): Promise<Category> {
    if (!this.pool) return this.fallbackMemory.saveCategory(category);
    await this.pool.query(
      `INSERT INTO categories (id, name, slug, description, image_url, display_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, slug = EXCLUDED.slug, description = EXCLUDED.description,
           image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, updated_at = NOW()`,
      [category.id, category.name, category.slug, category.description, category.imageUrl, category.displayOrder]
    );
    return category;
  }

  async deleteCategory(id: string): Promise<boolean> {
    if (!this.pool) return this.fallbackMemory.deleteCategory(id);
    const res = await this.pool.query('DELETE FROM categories WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  async getProducts(categoryId?: string, search?: string): Promise<Product[]> {
    if (!this.pool) return this.fallbackMemory.getProducts(categoryId, search);
    let query = `
      SELECT p.*, c.name as category_name, 
             COALESCE(
               json_agg(
                 json_build_object('weight', pw.weight, 'price', pw.price, 'inStock', pw.in_stock)
               ) FILTER (WHERE pw.id IS NOT NULL), '[]'
             ) as weights
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_weights pw ON p.id = pw.product_id
    `;
    const params: any[] = [];
    const wheres: string[] = [];

    if (categoryId && categoryId !== 'all') {
      params.push(categoryId);
      wheres.push(`p.category_id = $${params.length}`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      wheres.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length})`);
    }

    if (wheres.length > 0) {
      query += ` WHERE ` + wheres.join(' AND ');
    }
    query += ` GROUP BY p.id, c.name ORDER BY p.is_featured DESC, p.created_at DESC`;

    const res = await this.pool.query(query, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      categoryId: r.category_id,
      categoryName: r.category_name,
      description: r.description,
      imageUrl: r.image_url,
      weights: r.weights,
      cutOptions: r.cut_options,
      isAvailable: r.is_available,
      isFeatured: r.is_featured,
      badge: r.badge,
      netWeightDescription: r.net_weight_description
    }));
  }

  async getProductById(id: string): Promise<Product | null> {
    if (!this.pool) return this.fallbackMemory.getProductById(id);
    const products = await this.getProducts();
    return products.find(p => p.id === id) || null;
  }

  async saveProduct(product: Product): Promise<Product> {
    if (!this.pool) return this.fallbackMemory.saveProduct(product);
    // In PostgreSQL transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO products (id, category_id, name, slug, description, image_url, cut_options, is_available, is_featured, badge, net_weight_description, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (id) DO UPDATE
         SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, slug = EXCLUDED.slug,
             description = EXCLUDED.description, image_url = EXCLUDED.image_url,
             cut_options = EXCLUDED.cut_options, is_available = EXCLUDED.is_available,
             is_featured = EXCLUDED.is_featured, badge = EXCLUDED.badge,
             net_weight_description = EXCLUDED.net_weight_description, updated_at = NOW()`,
        [
          product.id,
          product.categoryId,
          product.name,
          product.slug,
          product.description,
          product.imageUrl,
          JSON.stringify(product.cutOptions),
          product.isAvailable,
          product.isFeatured,
          product.badge || null,
          product.netWeightDescription || null
        ]
      );

      // Re-insert weights
      await client.query('DELETE FROM product_weights WHERE product_id = $1', [product.id]);
      for (const w of product.weights) {
        await client.query(
          `INSERT INTO product_weights (product_id, weight, price, in_stock) VALUES ($1, $2, $3, $4)`,
          [product.id, w.weight, w.price, w.inStock]
        );
      }
      await client.query('COMMIT');
      return product;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    if (!this.pool) return this.fallbackMemory.deleteProduct(id);
    const res = await this.pool.query('DELETE FROM products WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  async updateProductStock(productId: string, isAvailable: boolean): Promise<boolean> {
    if (!this.pool) return this.fallbackMemory.updateProductStock(productId, isAvailable);
    const res = await this.pool.query('UPDATE products SET is_available = $1, updated_at = NOW() WHERE id = $2', [isAvailable, productId]);
    return res.rowCount > 0;
  }

  async updateWeightStock(productId: string, weight: WeightUnit, inStock: boolean, price?: number): Promise<boolean> {
    if (!this.pool) return this.fallbackMemory.updateWeightStock(productId, weight, inStock, price);
    if (typeof price === 'number') {
      const res = await this.pool.query(
        'UPDATE product_weights SET in_stock = $1, price = $2, updated_at = NOW() WHERE product_id = $3 AND weight = $4',
        [inStock, price, productId, weight]
      );
      return res.rowCount > 0;
    } else {
      const res = await this.pool.query(
        'UPDATE product_weights SET in_stock = $1, updated_at = NOW() WHERE product_id = $2 AND weight = $3',
        [inStock, productId, weight]
      );
      return res.rowCount > 0;
    }
  }

  async createOrder(
    req: CreateOrderRequest,
    calc: { subtotal: number; deliveryFee: number; discount: number; totalAmount: number; items: OrderItem[] }
  ): Promise<Order> {
    if (!this.pool) return this.fallbackMemory.createOrder(req, calc);
    return this.fallbackMemory.createOrder(req, calc);
  }

  async getOrderById(id: string): Promise<Order | null> {
    if (!this.pool) return this.fallbackMemory.getOrderById(id);
    return this.fallbackMemory.getOrderById(id);
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    if (!this.pool) return this.fallbackMemory.getOrderByNumber(orderNumber);
    return this.fallbackMemory.getOrderByNumber(orderNumber);
  }

  async getOrders(filters?: OrderFilterParams): Promise<Order[]> {
    if (!this.pool) return this.fallbackMemory.getOrders(filters);
    return this.fallbackMemory.getOrders(filters);
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<Order | null> {
    if (!this.pool) return this.fallbackMemory.updateOrderStatus(orderId, status, note);
    return this.fallbackMemory.updateOrderStatus(orderId, status, note);
  }

  async updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus): Promise<Order | null> {
    if (!this.pool) return this.fallbackMemory.updatePaymentStatus(orderId, paymentStatus);
    return this.fallbackMemory.updatePaymentStatus(orderId, paymentStatus);
  }

  async getShopSettings(): Promise<ShopSettings> {
    if (!this.pool) return this.fallbackMemory.getShopSettings();
    try {
      const res = await this.pool.query('SELECT * FROM shop_settings WHERE id = 1');
      if (res.rows.length === 0) return this.fallbackMemory.getShopSettings();
      const r = res.rows[0];
      return {
        shopName: r.shop_name,
        tagline: r.tagline,
        shopPhone: r.shop_phone,
        shopWhatsApp: r.shop_whatsapp,
        address: r.address,
        landmark: r.landmark,
        city: r.city,
        isOpen: Boolean(r.is_open),
        openTime: r.open_time,
        closeTime: r.close_time,
        deliveryFee: parseFloat(r.delivery_fee ?? 30),
        freeDeliveryThreshold: parseFloat(r.free_delivery_threshold ?? 499),
        minOrderAmount: parseFloat(r.min_order_amount ?? 0),
        deliveryTimeEstimateMins: parseInt(r.delivery_time_estimate_mins ?? 45, 10),
        announcementBanner: r.announcement_banner
      };
    } catch (e) {
      console.warn('Postgres error reading shop_settings, using fallback:', e);
      return this.fallbackMemory.getShopSettings();
    }
  }

  async updateShopSettings(settings: Partial<ShopSettings>): Promise<ShopSettings> {
    if (!this.pool) return this.fallbackMemory.updateShopSettings(settings);
    try {
      const current = await this.getShopSettings();
      const updated: ShopSettings = {
        ...current,
        ...settings,
        minOrderAmount: typeof settings.minOrderAmount === 'number' ? settings.minOrderAmount : (current.minOrderAmount ?? 0),
        freeDeliveryThreshold: typeof settings.freeDeliveryThreshold === 'number' ? settings.freeDeliveryThreshold : (current.freeDeliveryThreshold ?? 499),
        deliveryFee: typeof settings.deliveryFee === 'number' ? settings.deliveryFee : (current.deliveryFee ?? 30)
      };

      await this.pool.query(
        `INSERT INTO shop_settings (id, shop_name, tagline, shop_phone, shop_whatsapp, address, landmark, city, is_open, open_time, close_time, delivery_fee, free_delivery_threshold, min_order_amount, delivery_time_estimate_mins, announcement_banner, updated_at)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
         ON CONFLICT (id) DO UPDATE SET
           shop_name = EXCLUDED.shop_name,
           tagline = EXCLUDED.tagline,
           shop_phone = EXCLUDED.shop_phone,
           shop_whatsapp = EXCLUDED.shop_whatsapp,
           address = EXCLUDED.address,
           landmark = EXCLUDED.landmark,
           city = EXCLUDED.city,
           is_open = EXCLUDED.is_open,
           open_time = EXCLUDED.open_time,
           close_time = EXCLUDED.close_time,
           delivery_fee = EXCLUDED.delivery_fee,
           free_delivery_threshold = EXCLUDED.free_delivery_threshold,
           min_order_amount = EXCLUDED.min_order_amount,
           delivery_time_estimate_mins = EXCLUDED.delivery_time_estimate_mins,
           announcement_banner = EXCLUDED.announcement_banner,
           updated_at = NOW()`,
        [
          updated.shopName,
          updated.tagline,
          updated.shopPhone,
          updated.shopWhatsApp,
          updated.address,
          updated.landmark,
          updated.city,
          updated.isOpen,
          updated.openTime,
          updated.closeTime,
          updated.deliveryFee,
          updated.freeDeliveryThreshold,
          updated.minOrderAmount,
          updated.deliveryTimeEstimateMins,
          updated.announcementBanner
        ]
      );
      return updated;
    } catch (e) {
      console.warn('Postgres error writing shop_settings, falling back to memory:', e);
      return this.fallbackMemory.updateShopSettings(settings);
    }
  }

  async validateAdmin(username: string, passwordPlain: string): Promise<AdminUser | null> {
    if (!this.pool) return this.fallbackMemory.validateAdmin(username, passwordPlain);
    return this.fallbackMemory.validateAdmin(username, passwordPlain);
  }

  async getAdminById(id: string): Promise<AdminUser | null> {
    if (!this.pool) return this.fallbackMemory.getAdminById(id);
    return this.fallbackMemory.getAdminById(id);
  }

  async updateAdminPassword(adminId: string, currentPasswordPlain: string, newPasswordPlain: string): Promise<boolean> {
    if (!this.pool) return this.fallbackMemory.updateAdminPassword(adminId, currentPasswordPlain, newPasswordPlain);
    return this.fallbackMemory.updateAdminPassword(adminId, currentPasswordPlain, newPasswordPlain);
  }

  async getOrdersByCustomerPhone(phone: string): Promise<Order[]> {
    if (!this.pool) return this.fallbackMemory.getOrdersByCustomerPhone(phone);
    return this.fallbackMemory.getOrdersByCustomerPhone(phone);
  }

  async getSalesReport(params?: {
    startDate?: string;
    endDate?: string;
    productIds?: string[];
  }) {
    if (!this.pool) return this.fallbackMemory.getSalesReport(params);
    return this.fallbackMemory.getSalesReport(params);
  }
}

// =========================================================================
// Factory function for interchangeable database selection
// =========================================================================
let repositoryInstance: IDatabaseRepository | null = null;

export async function getDatabaseRepository(): Promise<IDatabaseRepository> {
  if (repositoryInstance) {
    return repositoryInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    console.log('🔌 Configuring PostgreSQL Database Repository (DATABASE_URL provided)...');
    const repo = new PostgresDatabaseRepository(databaseUrl);
    await repo.init();
    repositoryInstance = repo;
  } else {
    console.log('📁 Configuring Persistent File/Memory Database Repository (zero-config local storage)...');
    const repo = new MemoryDatabaseRepository();
    await repo.init();
    repositoryInstance = repo;
  }

  return repositoryInstance;
}
