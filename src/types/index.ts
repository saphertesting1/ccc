export type WeightUnit = '250g' | '500g' | '1kg';

export interface WeightOption {
  weight: WeightUnit;
  price: number;
  inStock: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName?: string;
  description: string;
  imageUrl: string;
  weights: WeightOption[];
  cutOptions: string[];
  isAvailable: boolean;
  isFeatured: boolean;
  badge?: string; // e.g. "Bestseller", "Farm Fresh", "Daily Special"
  netWeightDescription?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  cartItemId: string; // unique combo of productId + weight + cutPreference
  productId: string;
  name: string;
  imageUrl: string;
  weight: WeightUnit;
  cutPreference: string;
  unitPrice: number;
  quantity: number;
  itemTotal: number;
}

export type OrderStatus =
  | 'New'
  | 'Accepted'
  | 'Preparing'
  | 'Ready for Dispatch'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Rejected'
  | 'Cancelled';

export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded';

export type PaymentMethod = 'COD' | 'UPI' | 'Cash';

export interface CustomerInfo {
  name: string;
  phone: string;
  address: string;
  landmark?: string;
  notes?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  weight: WeightUnit;
  cutPreference: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: CustomerInfo;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  statusHistory: OrderStatusHistoryItem[];
  createdAt: string;
  updatedAt: string;
  estimatedDeliveryTime?: string;
  idempotencyKey?: string;
}

export interface ShopSettings {
  shopName: string;
  tagline: string;
  shopPhone: string;
  shopWhatsApp: string;
  address: string;
  landmark: string;
  city: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  minOrderAmount: number;
  deliveryTimeEstimateMins: number;
  announcementBanner: string;
}

export interface AdminUser {
  id: string;
  username: string;
  role: 'super_admin' | 'shop_manager';
  fullName?: string;
  token?: string;
}

export interface CreateOrderRequest {
  customer: CustomerInfo;
  items: {
    productId: string;
    weight: WeightUnit;
    cutPreference: string;
    quantity: number;
  }[];
  paymentMethod: 'COD'; // Only COD permitted for direct placement
  idempotencyKey?: string;
}

export interface OrderFilterParams {
  status?: OrderStatus | 'All';
  paymentStatus?: PaymentStatus | 'All';
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
}
