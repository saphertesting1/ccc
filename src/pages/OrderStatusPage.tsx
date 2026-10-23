import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Search, 
  Clock, 
  CheckCircle2, 
  Truck, 
  MapPin, 
  RefreshCw, 
  AlertCircle, 
  Phone, 
  MessageCircle,
  PackageCheck,
  ChefHat,
  Ban
} from 'lucide-react';
import { Order, OrderStatus } from '../types/index.js';
import { api } from '../services/api.js';
import { useShop } from '../context/ShopContext.js';

const STATUS_STEPS: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'New', label: 'Order Placed', description: 'Received in shop queue' },
  { status: 'Accepted', label: 'Accepted', description: 'Confirmed by butcher' },
  { status: 'Preparing', label: 'Carving Fresh', description: 'Cleaned with RO water & cut' },
  { status: 'Ready for Dispatch', label: 'Packed & Sealed', description: 'In food-grade sealed pouch' },
  { status: 'Out for Delivery', label: 'Out for Delivery', description: 'Rider is on the way to you' },
  { status: 'Delivered', label: 'Delivered', description: 'Package handed over' }
];

export default function OrderStatusPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRef = searchParams.get('ref') || '';
  const { settings } = useShop();

  const [query, setQuery] = useState(initialRef);
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchOrder = useCallback(async (ref: string) => {
    if (!ref.trim()) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getOrder(ref.trim());
      setOrder(data);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'Order not found');
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRef) {
      fetchOrder(initialRef);
    }
  }, [initialRef, fetchOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ ref: query.trim() });
      fetchOrder(query.trim());
    }
  };

  const getStepState = (stepStatus: OrderStatus) => {
    if (!order) return 'upcoming';

    const orderStatus = order.orderStatus;
    if (orderStatus === 'Cancelled' || orderStatus === 'Rejected') {
      return 'cancelled';
    }

    const stepIndex = STATUS_STEPS.findIndex(s => s.status === stepStatus);
    const currentIndex = STATUS_STEPS.findIndex(s => s.status === orderStatus);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'upcoming';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-black text-[#38251F]">
          Track Live Order Status
        </h1>
        <p className="text-xs sm:text-sm text-stone-500">
          Enter your Order Number (e.g. <code>CCC-20261020-001</code>) to track your fresh chicken preparation and delivery in real-time.
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} className="max-w-lg mx-auto flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            required
            placeholder="Enter Order # (e.g. CCC-20261020-001)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-3 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm text-[#38251F] font-mono uppercase focus:outline-hidden focus:border-[#D92332] shadow-xs"
          />
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-[#D92332] hover:bg-[#b81d2a] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-95"
        >
          {isLoading ? 'Checking...' : 'Track'}
        </button>
      </form>

      {/* Error state */}
      {error && (
        <div className="max-w-lg mx-auto p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Order Details View */}
      {order && (
        <div className="space-y-6">
          {/* Status Header Banner */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-[#D92332]">{order.orderNumber}</span>
                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                  order.orderStatus === 'Delivered'
                    ? 'bg-emerald-100 text-emerald-800'
                    : order.orderStatus === 'Cancelled' || order.orderStatus === 'Rejected'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {order.orderStatus}
                </span>
              </div>
              <div className="text-xs text-stone-500 mt-1 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                <span>Placed on {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>•</span>
                <span>Est. Delivery: ~{order.estimatedDeliveryTime || '45 mins'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchOrder(order.orderNumber)}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-bold text-stone-700 flex items-center gap-1.5 transition-colors"
                title="Refresh Status"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#D92332]' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Stepper Status Timeline */}
          {order.orderStatus === 'Cancelled' || order.orderStatus === 'Rejected' ? (
            <div className="bg-red-50 p-6 rounded-3xl border border-red-200 text-center space-y-2">
              <Ban className="w-8 h-8 text-red-600 mx-auto" />
              <h3 className="font-bold text-base text-red-900">
                This Order was {order.orderStatus}
              </h3>
              <p className="text-xs text-red-700 max-w-md mx-auto">
                {order.statusHistory[order.statusHistory.length - 1]?.note || 'This order could not be fulfilled. For inquiries, please call the shop.'}
              </p>
            </div>
          ) : (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-sm">
              <h3 className="font-bold text-sm text-[#38251F] mb-6">Live Butchering & Delivery Progress</h3>
              <div className="relative">
                {/* Stepper Grid */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 relative z-10">
                  {STATUS_STEPS.map((step) => {
                    const state = getStepState(step.status);
                    return (
                      <div key={step.status} className="flex flex-col items-center text-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs mb-2 transition-all ${
                            state === 'completed'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : state === 'active'
                              ? 'bg-[#D92332] text-white ring-4 ring-red-100 shadow-md animate-pulse'
                              : 'bg-stone-100 text-stone-400 border border-stone-200'
                          }`}
                        >
                          {state === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : state === 'active' ? (
                            <ChefHat className="w-5 h-5" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>
                        <div className={`text-xs font-bold ${state === 'active' ? 'text-[#D92332]' : state === 'completed' ? 'text-stone-800' : 'text-stone-400'}`}>
                          {step.label}
                        </div>
                        <div className="text-[10px] text-stone-500 mt-0.5 hidden sm:block">
                          {step.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Separate Payment & Delivery Information Cards (displayed when details are present) */}
          {(Boolean(order.totalAmount) || Boolean(order.customer?.name)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment Snapshot */}
              {Boolean(order.totalAmount) && (
                <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <span className="font-bold text-xs text-stone-500 uppercase tracking-wider">Payment Details</span>
                    <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                      order.paymentStatus === 'Paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      Payment: {order.paymentStatus}
                    </span>
                  </div>
                  <div className="text-xs space-y-1.5 text-stone-700">
                    <div className="flex justify-between">
                      <span>Method:</span>
                      <span className="font-bold text-[#38251F]">{order.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : 'UPI'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Bill:</span>
                      <span className="font-bold text-base text-[#D92332]">₹{order.totalAmount}</span>
                    </div>
                    {order.paymentStatus === 'Pending' && (
                      <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200/60 mt-2">
                        Payable to delivery partner at your doorstep. Please keep exact change ready.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Destination Snapshot */}
              {Boolean(order.customer?.name) && (
                <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-3">
                  <div className="border-b border-stone-100 pb-2">
                    <span className="font-bold text-xs text-stone-500 uppercase tracking-wider">Delivery Recipient</span>
                  </div>
                  <div className="text-xs text-stone-700 space-y-1">
                    <div className="font-bold text-[#38251F]">{order.customer.name}</div>
                    {order.customer.address && <div className="text-stone-600">{order.customer.address}</div>}
                    {order.customer.landmark && (
                      <div className="text-stone-500">Landmark: {order.customer.landmark}</div>
                    )}
                    {order.customer.phone && (
                      <div className="font-medium text-stone-800 pt-1 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-[#D92332]" />
                        <span>{order.customer.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Item Breakdown (displayed when items are present) */}
          {Array.isArray(order.items) && order.items.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-3">
              <h4 className="font-bold text-sm text-[#38251F]">Cuts in this Order</h4>
              <div className="divide-y divide-stone-100 text-xs">
                {order.items.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#38251F]">{item.productName}</span>
                      <span className="text-stone-500 text-[11px] ml-2">
                        ({item.weight} • {item.cutPreference} • Qty {item.quantity})
                      </span>
                    </div>
                    <span className="font-extrabold text-[#38251F]">₹{item.subtotal}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Direct Shop Support Links */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-200 gap-3 text-xs">
            <span className="font-medium text-amber-900">
              Need immediate updates on this order? Our butcher shop is standing by.
            </span>
            <div className="flex items-center gap-2">
              <a
                href={`tel:${settings?.shopPhone || '+919848022338'}`}
                className="px-3 py-2 bg-white text-[#D92332] font-bold rounded-xl border border-amber-300 hover:bg-stone-50 transition-colors flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" /> Call Shop
              </a>
              <a
                href={`https://wa.me/${(settings?.shopWhatsApp || '919848022338').replace(/\D/g, '')}?text=Checking%20status%20for%20order%20${order.orderNumber}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#20ba5a] transition-colors flex items-center gap-1"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
