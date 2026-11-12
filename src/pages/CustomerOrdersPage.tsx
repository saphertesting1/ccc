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
import { getOrderTrackingPath, loadCustomerOrders, saveCustomerOrders } from '../services/orderTrackingStorage.js';

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
      const localOrderList = loadCustomerOrders();
      if (localOrderList.length > 0) {
        // Refresh statuses for these orders from the API while preserving customer details
        const refreshed = await Promise.all(
          localOrderList.map(async o => {
            try {
              const live = await api.getOrder(
                o.orderNumber,
                o.trackingToken,
                o.trackingToken ? undefined : o.customer?.phone
              );
              // Calculate fallback subtotal & total
              const calcSub = o.items && o.items.length > 0
                ? o.items.reduce((s, it) => s + (it.subtotal || (it.unitPrice * it.quantity)), 0)
                : 0;
              const calcTotal = (live.totalAmount && live.totalAmount > 0)
                ? live.totalAmount
                : (o.totalAmount && o.totalAmount > 0)
                ? o.totalAmount
                : (calcSub + (o.deliveryFee || 0) - (o.discount || 0));

              return {
                ...o,
                orderStatus: live.orderStatus || o.orderStatus,
                statusHistory: (live.statusHistory && live.statusHistory.length > 0) ? live.statusHistory : o.statusHistory,
                estimatedDeliveryTime: live.estimatedDeliveryTime || o.estimatedDeliveryTime,
                paymentStatus: live.paymentStatus || o.paymentStatus,
                items: (live.items && live.items.length > 0) ? live.items : (o.items || []),
                subtotal: (live.subtotal && live.subtotal > 0) ? live.subtotal : (o.subtotal || calcSub),
                deliveryFee: live.deliveryFee ?? o.deliveryFee ?? 0,
                discount: live.discount ?? o.discount ?? 0,
                totalAmount: calcTotal,
                customer: {
                  name: o.customer?.name || live.customer?.name || 'Customer',
                  phone: o.customer?.phone || live.customer?.phone || '',
                  address: o.customer?.address || live.customer?.address || '',
                  landmark: o.customer?.landmark || live.customer?.landmark || '',
                  notes: o.customer?.notes || live.customer?.notes || '',
                  latitude: o.customer?.latitude ?? live.customer?.latitude,
                  longitude: o.customer?.longitude ?? live.customer?.longitude,
                  coordinatesConfirmed: o.customer?.coordinatesConfirmed ?? live.customer?.coordinatesConfirmed,
                  googleMapsUrl: o.customer?.googleMapsUrl ?? live.customer?.googleMapsUrl
                }
              };
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

      // Merge into localStorage for future convenience
      if (remoteOrders.length > 0) {
        const existing = loadCustomerOrders();
        const existingMap = new Map(existing.map(o => [o.orderNumber, o]));
        for (const ro of remoteOrders) {
          const existingOrder = existingMap.get(ro.orderNumber);
          existingMap.set(ro.orderNumber, {
            ...ro,
            ...(existingOrder?.trackingToken ? { trackingToken: existingOrder.trackingToken } : {})
          });
        }
        const mergedOrders = Array.from(existingMap.values());
        setOrders(mergedOrders);
        saveCustomerOrders(mergedOrders);
      } else {
        setOrders(remoteOrders);
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

                  {(() => {
                    const calcSub = order.items && order.items.length > 0
                      ? order.items.reduce((sum, it) => sum + (it.subtotal || (it.unitPrice * it.quantity)), 0)
                      : (order.subtotal || 0);
                    const finalTotal = order.totalAmount > 0
                      ? order.totalAmount
                      : (calcSub + (order.deliveryFee || 0) - (order.discount || 0));

                    return (
                      <div className="text-right flex sm:flex-col items-center sm:items-end justify-between">
                        <div>
                          <span className="text-base font-black text-[#38251F]">
                            ₹{finalTotal}
                          </span>
                          {order.deliveryFee > 0 && (
                            <div className="text-[10px] text-stone-500 font-medium">
                              Subtotal: ₹{calcSub} + Delivery: ₹{order.deliveryFee}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-stone-500 font-semibold bg-stone-100 px-1.5 py-0.5 rounded mt-0.5">
                          {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'UPI'} ({order.paymentStatus})
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Items Summary */}
                <div className="space-y-1.5 text-xs bg-amber-50/40 p-3 rounded-xl border border-amber-100/70">
                  <div className="font-bold text-stone-600 uppercase text-[10px] tracking-wider flex items-center justify-between">
                    <span>Cuts Ordered ({order.items.length})</span>
                    <span>Line Subtotal</span>
                  </div>
                  <div className="space-y-1 divide-y divide-amber-100/60 pt-1">
                    {order.items.length > 0 ? (
                      order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-stone-700 pt-1">
                          <span>
                            <strong className="text-[#38251F]">{item.quantity}×</strong> {item.productName}{' '}
                            <span className="text-stone-500 text-[11px]">({item.weight} • {item.cutPreference})</span>
                          </span>
                          <span className="font-bold text-stone-900">₹{item.subtotal || (item.unitPrice * item.quantity)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-stone-400 italic text-[11px] pt-1">Item details saved in shop butchering queue</div>
                    )}
                  </div>
                </div>

                {/* Delivery Address snippet */}
                <div className="text-xs text-stone-700 bg-stone-50 p-3 rounded-xl border border-stone-200/80 space-y-1">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#D92332] shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-[#38251F]">
                        {order.customer.name || 'Customer'} {order.customer.phone ? `• ${order.customer.phone}` : ''}
                      </div>
                      <div className="text-stone-600 mt-0.5">
                        {order.customer.address || 'Standard home delivery'}
                        {order.customer.landmark ? ` (Landmark: ${order.customer.landmark})` : ''}
                      </div>
                      {order.customer.googleMapsUrl && (
                        <a
                          href={order.customer.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-bold mt-1.5 hover:underline"
                        >
                          <MapPin className="w-3 h-3 text-blue-600" />
                          <span>View Location on Google Maps</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] text-stone-500">
                    Est. delivery: ~{order.estimatedDeliveryTime || '45 mins'}
                  </span>

                  <Link
                    to={getOrderTrackingPath(order.orderNumber, order.trackingToken)}
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
