import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  Phone, 
  MapPin, 
  ShoppingBag,
  RefreshCw,
  IndianRupee,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { api } from '../services/api.js';
import { Order, OrderStatus, PaymentStatus } from '../types/index.js';
import AdminManualOrderModal from './AdminManualOrderModal.js';

const ALL_ORDER_STATUSES: OrderStatus[] = [
  'New',
  'Accepted',
  'Preparing',
  'Ready for Dispatch',
  'Out for Delivery',
  'Delivered',
  'Rejected',
  'Cancelled'
];

const ALL_PAYMENT_STATUSES: PaymentStatus[] = ['Pending', 'Paid', 'Failed', 'Refunded'];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('All');

  // Selected Order for Modal View & Updates
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAdminOrders({
        status: selectedStatus as any,
        paymentStatus: selectedPaymentStatus as any,
        searchQuery: search
      });
      setOrders(data);
    } catch (e) {
      console.error('Failed to load orders:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [selectedStatus, selectedPaymentStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
  };

  const handleUpdateOrderStatus = async (newStatus: OrderStatus) => {
    if (!activeOrder) return;
    try {
      setIsUpdating(true);
      const updated = await api.updateOrderStatus(activeOrder.id, newStatus, statusNote);
      setActiveOrder(updated);
      setMessage(`Order status updated to ${newStatus}`);
      setStatusNote('');
      await loadOrders();
    } catch (e: any) {
      alert(e.message || 'Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePaymentStatus = async (newPaymentStatus: PaymentStatus) => {
    if (!activeOrder) return;
    try {
      setIsUpdating(true);
      const updated = await api.updatePaymentStatus(activeOrder.id, newPaymentStatus);
      setActiveOrder(updated);
      setMessage(`Payment status set to ${newPaymentStatus}`);
      await loadOrders();
    } catch (e: any) {
      alert(e.message || 'Failed to update payment status');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200/80 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#38251F]">
            Order Management
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Process customer orders, update butchering stages, and reconcile cash payments.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="px-4 py-2 bg-[#D92332] hover:bg-[#b81d2a] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Manual Order</span>
          </button>
          <button
            onClick={loadOrders}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#D92332]' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          {/* Search by Number, Name, Phone */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by Order #, Customer Name, Phone, or Locality..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-16 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#D92332] text-white text-xs font-bold rounded-lg"
            >
              Search
            </button>
          </div>

          {/* Status Dropdown */}
          <div className="flex gap-2">
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-hidden focus:border-[#D92332]"
            >
              <option value="All">All Order Statuses</option>
              {ALL_ORDER_STATUSES.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            {/* Payment Status Dropdown */}
            <select
              value={selectedPaymentStatus}
              onChange={e => setSelectedPaymentStatus(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-hidden focus:border-[#D92332]"
            >
              <option value="All">All Payment Statuses</option>
              {ALL_PAYMENT_STATUSES.map(pst => (
                <option key={pst} value={pst}>Payment: {pst}</option>
              ))}
            </select>
          </div>
        </form>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[11px] font-bold">
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Customer & Phone</th>
                <th className="py-3 px-4">Cuts Summary</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Order Status</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    No orders match your current filters.
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#D92332]">
                      {order.orderNumber}
                      <div className="text-[10px] text-stone-400 font-sans">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#38251F]">{order.customer.name}</div>
                      <div className="text-[11px] text-stone-500">{order.customer.phone}</div>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs truncate text-stone-600">
                      {order.items.map(i => `${i.quantity}x ${i.productName} (${i.weight})`).join(', ')}
                    </td>

                    <td className="py-3.5 px-4 font-extrabold text-[#38251F]">
                      ₹{order.totalAmount}
                      <span className="text-[10px] text-stone-400 font-normal block">
                        {order.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-block ${
                        order.orderStatus === 'Delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.orderStatus === 'Cancelled' || order.orderStatus === 'Rejected'
                          ? 'bg-red-100 text-red-800'
                          : order.orderStatus === 'Out for Delivery'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {order.orderStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold inline-block ${
                        order.paymentStatus === 'Paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.paymentStatus === 'Failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setActiveOrder(order);
                          setMessage(null);
                        }}
                        className="px-3 py-1.5 bg-[#38251F] hover:bg-[#D92332] text-white rounded-lg font-bold text-xs transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Manage</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Management Details Modal */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-[#FFF9F1] rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-300 relative text-[#38251F] my-2 sm:my-8 flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden">
            {/* Sticky Header with visible, accessible Close (X) button */}
            <div className="sticky top-0 z-20 bg-[#FFF9F1] px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-200 flex items-center justify-between shrink-0 shadow-2xs">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#D92332] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-[#38251F] truncate">
                    Order #{activeOrder.orderNumber}
                  </h3>
                  <div className="text-[11px] sm:text-xs text-stone-500 truncate">
                    Placed on {new Date(activeOrder.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* High-visibility Close button for mobile and desktop */}
              <button
                onClick={() => setActiveOrder(null)}
                className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white hover:bg-stone-100 text-stone-600 hover:text-[#D92332] border border-stone-300 shadow-2xs transition-all active:scale-95 shrink-0"
                aria-label="Close order details"
                title="Close details (Return to Orders)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 overscroll-contain">

            {message && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{message}</span>
              </div>
            )}

            {/* Status Modification Controls */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Order Status */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Order Status (Current: <span className="text-[#D92332]">{activeOrder.orderStatus}</span>)
                  </label>
                  <select
                    value={activeOrder.orderStatus}
                    disabled={isUpdating}
                    onChange={e => handleUpdateOrderStatus(e.target.value as OrderStatus)}
                    className="w-full text-xs font-bold p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  >
                    {ALL_ORDER_STATUSES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Payment Status (Separated!) */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Payment Status (Current: <span className="text-emerald-700">{activeOrder.paymentStatus}</span>)
                  </label>
                  <select
                    value={activeOrder.paymentStatus}
                    disabled={isUpdating}
                    onChange={e => handleUpdatePaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full text-xs font-bold p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  >
                    {ALL_PAYMENT_STATUSES.map(pst => (
                      <option key={pst} value={pst}>Payment: {pst}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Note */}
              <div>
                <label className="block text-[11px] font-bold text-stone-500 mb-1">
                  Optional Status Transition Note (e.g. Assigned to Rider Ravi, or Butcher custom cut note):
                </label>
                <input
                  type="text"
                  placeholder="Enter transition note..."
                  value={statusNote}
                  onChange={e => setStatusNote(e.target.value)}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Customer & Delivery Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-1">
                <span className="font-bold text-stone-500 uppercase tracking-wider text-[10px]">
                  Customer Contact
                </span>
                <div className="font-bold text-sm text-[#38251F]">{activeOrder.customer.name}</div>
                <div className="font-semibold text-emerald-700">{activeOrder.customer.phone}</div>
                {activeOrder.customer.notes && (
                  <div className="text-amber-800 bg-amber-50 p-2 rounded-lg mt-2 text-[11px]">
                    <strong>Note:</strong> {activeOrder.customer.notes}
                  </div>
                )}
              </div>

              <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-1">
                <span className="font-bold text-stone-500 uppercase tracking-wider text-[10px]">
                  Home Delivery Address
                </span>
                <div className="text-stone-800 font-medium">{activeOrder.customer.address}</div>
                {activeOrder.customer.landmark && (
                  <div className="text-stone-500 text-[11px]">Landmark: {activeOrder.customer.landmark}</div>
                )}
              </div>
            </div>

            {/* Ordered Items Table */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-3">
              <span className="font-bold text-stone-500 uppercase tracking-wider text-[10px]">
                Carved Items Snapshot
              </span>
              <div className="divide-y divide-stone-100 text-xs">
                {activeOrder.items.map((item, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#38251F]">{item.productName}</div>
                      <div className="text-[11px] text-stone-500">
                        Pack: {item.weight} • Cut: {item.cutPreference} • Qty: {item.quantity}
                      </div>
                    </div>
                    <div className="font-bold text-[#38251F]">₹{item.subtotal}</div>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-stone-200 flex justify-between font-bold text-xs">
                <span>Total Amount:</span>
                <span className="text-sm text-[#D92332]">₹{activeOrder.totalAmount} ({activeOrder.paymentMethod})</span>
              </div>
            </div>

            {/* Status History Audit Trail */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-2">
              <span className="font-bold text-stone-500 uppercase tracking-wider text-[10px]">
                Status Audit Trail
              </span>
              <div className="space-y-1 text-[11px] text-stone-600 max-h-36 overflow-y-auto no-scrollbar">
                {activeOrder.statusHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-stone-50">
                    <span className="font-bold text-[#38251F]">{h.status}</span>
                    <span className="text-stone-500">{h.note || ''}</span>
                    <span className="text-stone-400">{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Bottom Close Action */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-700 transition-colors shadow-2xs active:scale-95 text-center"
              >
                Close Order Details
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Manual Order Modal */}
      <AdminManualOrderModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onOrderCreated={(newOrder) => {
          loadOrders();
          setMessage(`Manual order ${newOrder.orderNumber} successfully recorded!`);
          setTimeout(() => setMessage(null), 4000);
        }}
      />
    </div>
  );
}
