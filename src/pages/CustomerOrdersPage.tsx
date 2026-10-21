import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ClipboardList, 
  Search, 
  Clock, 
  MapPin, 
  Phone, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import { Order } from '../types/index.js';
import { api } from '../services/api.js';
import { useCart } from '../context/CartContext.js';

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [phoneQuery, setPhoneQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { addItem } = useCart();

  // Load orders stored locally from previous checkouts
  useEffect(() => {
    loadLocalOrders();
  }, []);

  const loadLocalOrders = async () => {
    try {
      setIsLoading(true);
      const raw = localStorage.getItem('ccc_customer_orders');
      if (raw) {
        const localOrderList: Order[] = JSON.parse(raw);
        // Refresh statuses for these orders from the API
        const refreshed = await Promise.all(
          localOrderList.map(async o => {
            try {
              return await api.getOrder(o.orderNumber);
            } catch {
              return o;
            }
          })
        );
        setOrders(refreshed);
      }
    } catch (e) {
      console.error('Failed to load local customer orders:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneQuery.trim().replace(/[\s\-()]/g, '');
    if (!cleanPhone || cleanPhone.length < 5) return;

    try {
      setIsLoading(true);
      setSearched(true);
      const remoteOrders = await api.getCustomerOrdersByPhone(cleanPhone);
      setOrders(remoteOrders);

      // Merge into localStorage for future convenience
      if (remoteOrders.length > 0) {
        const raw = localStorage.getItem('ccc_customer_orders');
        const existing: Order[] = raw ? JSON.parse(raw) : [];
        const existingMap = new Map(existing.map(o => [o.orderNumber, o]));
        for (const ro of remoteOrders) {
          existingMap.set(ro.orderNumber, ro);
        }
        localStorage.setItem('ccc_customer_orders', JSON.stringify(Array.from(existingMap.values())));
      }
    } catch (e) {
      console.error('Failed to lookup orders by phone:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Out for Delivery':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Preparing':
      case 'Ready for Dispatch':
      case 'Accepted':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Cancelled':
      case 'Rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-28 md:pb-16">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#38251F]">
          My Chicken Orders
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          Review your current poultry preparation, past orders, and live delivery updates.
        </p>
      </div>

      {/* Phone Lookup Card for Multi-Device Ordering */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs">
        <form onSubmit={handlePhoneSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              type="tel"
              placeholder="Enter your 10-digit mobile number to find orders..."
              value={phoneQuery}
              onChange={e => setPhoneQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2.5 bg-[#38251F] hover:bg-[#D92332] text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
          >
            {isLoading ? 'Searching...' : 'Find My Orders'}
          </button>
        </form>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#D92332] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-stone-500">Retrieving your fresh chicken orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-stone-200 max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-50 text-[#D92332] flex items-center justify-center mx-auto">
            <ClipboardList className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#38251F]">
            {searched ? 'No orders found for this mobile number' : 'No past orders found on this device'}
          </h3>
          <p className="text-xs text-stone-500 max-w-xs mx-auto">
            Browse our farm fresh chicken cuts and place your first order with fast home delivery. No account or password required!
          </p>
          <Link
            to="/products"
            className="inline-block px-6 py-3 bg-[#D92332] hover:bg-[#b81d2a] text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            Explore Fresh Chicken Cuts
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium px-1">
            <span>Showing {orders.length} {orders.length === 1 ? 'order' : 'orders'}</span>
            <button
              onClick={loadLocalOrders}
              className="text-stone-600 hover:text-[#D92332] flex items-center gap-1 font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
            </button>
          </div>

          <div className="space-y-4">
            {orders.map(order => (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs hover:shadow-md transition-all space-y-4"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-[#D92332]">
                        {order.orderNumber}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeColor(order.orderStatus)}`}>
                        {order.orderStatus}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="text-right sm:text-right flex sm:flex-col items-center sm:items-end justify-between">
                    <span className="text-base font-black text-[#38251F]">
                      ₹{order.totalAmount}
                    </span>
                    <span className="text-[10px] text-stone-500 font-semibold bg-stone-100 px-1.5 py-0.5 rounded">
                      {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'UPI'} ({order.paymentStatus})
                    </span>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="space-y-1.5 text-xs">
                  <div className="font-bold text-stone-500 uppercase text-[10px] tracking-wider">
                    Cuts Ordered:
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-stone-700">
                        <span>
                          <strong>{item.quantity}×</strong> {item.productName} ({item.weight} • {item.cutPreference})
                        </span>
                        <span className="font-bold text-stone-900">₹{item.subtotal}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Address snippet */}
                <div className="text-xs text-stone-500 flex items-start gap-1.5 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                  <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{order.customer.address}{order.customer.landmark ? ` (${order.customer.landmark})` : ''}</span>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] text-stone-500">
                    Est. delivery: ~{order.estimatedDeliveryTime || '45 mins'}
                  </span>

                  <Link
                    to={`/order-status/${encodeURIComponent(order.orderNumber)}`}
                    className="w-full sm:w-auto px-4 py-2 bg-[#D92332] hover:bg-[#b81d2a] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>Track Live Butchering & Delivery</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
