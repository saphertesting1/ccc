import React, { useState, useEffect, useMemo } from 'react';
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
  Plus,
  Calendar,
  User,
  History,
  Tag,
  ExternalLink,
  Copy
} from 'lucide-react';
import { api, getKolkataDateString } from '../services/api.js';
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

// Consistent color badge mapping across entire application (Delivered is ALWAYS emerald green!)
export const getStatusBadgeClass = (status: OrderStatus | string) => {
  switch (status) {
    case 'Delivered':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
    case 'New':
      return 'bg-amber-100 text-amber-800 border border-amber-300';
    case 'Accepted':
      return 'bg-blue-100 text-blue-800 border border-blue-300';
    case 'Preparing':
      return 'bg-purple-100 text-purple-800 border border-purple-300';
    case 'Ready for Dispatch':
      return 'bg-indigo-100 text-indigo-800 border border-indigo-300';
    case 'Out for Delivery':
      return 'bg-cyan-100 text-cyan-800 border border-cyan-300';
    case 'Cancelled':
    case 'Rejected':
      return 'bg-red-100 text-red-800 border border-red-300';
    default:
      return 'bg-stone-100 text-stone-700 border border-stone-200';
  }
};

export const getStatusTextClass = (status: OrderStatus | string) => {
  switch (status) {
    case 'Delivered':
      return 'text-emerald-700 font-bold';
    case 'New':
      return 'text-amber-700 font-bold';
    case 'Accepted':
      return 'text-blue-700 font-bold';
    case 'Preparing':
      return 'text-purple-700 font-bold';
    case 'Ready for Dispatch':
      return 'text-indigo-700 font-bold';
    case 'Out for Delivery':
      return 'text-cyan-700 font-bold';
    case 'Cancelled':
    case 'Rejected':
      return 'text-red-700 font-bold';
    default:
      return 'text-stone-700 font-bold';
  }
};

export const isManualOrder = (order: Order) => {
  return Boolean(
    order.isManual === true ||
    order.orderSource === 'manual' ||
    order.idempotencyKey?.startsWith('admin-') ||
    order.customer?.notes?.toLowerCase().includes('manual order')
  );
};

export default function AdminOrdersPage() {
  const todayKolkata = getKolkataDateString(new Date());
  const yesterdayKolkata = getKolkataDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>('All'); // Default All, but quick buttons for Today & Yesterday

  // Modals & Active View State
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Phone Order History Modal State (Issue 1)
  const [phoneHistoryPhone, setPhoneHistoryPhone] = useState<string | null>(null);
  const [phoneHistoryCustomerName, setPhoneHistoryCustomerName] = useState<string>('');
  const [phoneHistoryOrders, setPhoneHistoryOrders] = useState<Order[]>([]);
  const [isLoadingPhoneHistory, setIsLoadingPhoneHistory] = useState(false);

  // Fetch orders from Supabase / Backend
  const loadOrders = async (options?: { resetSearch?: boolean }) => {
    try {
      if (options?.resetSearch) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const data = await api.getAdminOrders();
      setOrders(data);
    } catch (e: any) {
      console.error('Failed to load orders:', e);
      setErrorMessage(e.message || 'Failed to fetch latest orders from database');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Filtered orders in-memory (supports instant client-side search across phone, customer, id, product)
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Date Filter (Issue 5)
    if (selectedDate && selectedDate !== 'All') {
      result = result.filter(o => getKolkataDateString(o.createdAt) === selectedDate);
    }

    // Status Filter
    if (selectedStatus !== 'All') {
      result = result.filter(o => o.orderStatus === selectedStatus);
    }

    // Payment Status Filter
    if (selectedPaymentStatus !== 'All') {
      result = result.filter(o => o.paymentStatus === selectedPaymentStatus);
    }

    // Search Bar Filter (Issue 7)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const digits = search.replace(/\D/g, '');

      result = result.filter(o => {
        // Order # or ID
        if (o.orderNumber.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)) {
          return true;
        }
        // Customer Name
        if (o.customer.name.toLowerCase().includes(q)) {
          return true;
        }
        // Phone number matching (exact or normalized digits)
        if (o.customer.phone.toLowerCase().includes(q)) {
          return true;
        }
        if (digits.length >= 3) {
          const oDigits = o.customer.phone.replace(/\D/g, '');
          if (oDigits.includes(digits) || digits.includes(oDigits)) {
            return true;
          }
        }
        // Locality / Address / Landmark
        if (o.customer.address.toLowerCase().includes(q) || (o.customer.landmark && o.customer.landmark.toLowerCase().includes(q))) {
          return true;
        }
        // Product item name
        if (o.items.some(item => item.productName.toLowerCase().includes(q))) {
          return true;
        }
        return false;
      });
    }

    // Chronological order: newest first
    return [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, selectedDate, selectedStatus, selectedPaymentStatus, search]);

  // Handle Search Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  // Handle Refresh Button (Issue 8: resets search, filters, and loads latest Supabase data)
  const handleRefresh = async () => {
    if (isLoading || isRefreshing) return;
    setSearch('');
    setSelectedStatus('All');
    setSelectedPaymentStatus('All');
    setSelectedDate('All');
    await loadOrders({ resetSearch: true });
  };

  // Fast Optimistic Order Status Update (Issue 4)
  const handleUpdateOrderStatus = async (newStatus: OrderStatus) => {
    if (!activeOrder || isUpdating) return;
    const prevOrder = { ...activeOrder };
    const prevOrders = [...orders];

    // Optimistic UI state update immediately
    const optimisticUpdated: Order = {
      ...activeOrder,
      orderStatus: newStatus,
      statusHistory: [
        ...activeOrder.statusHistory,
        {
          status: newStatus,
          timestamp: new Date().toISOString(),
          note: statusNote || `Status updated to ${newStatus}`
        }
      ],
      updatedAt: new Date().toISOString()
    };
    setActiveOrder(optimisticUpdated);
    setOrders(prev => prev.map(o => o.id === activeOrder.id ? optimisticUpdated : o));
    setMessage(`Order status updated to ${newStatus}`);
    setErrorMessage(null);
    setStatusNote('');

    try {
      setIsUpdating(true);
      const confirmed = await api.updateOrderStatus(activeOrder.id, newStatus, statusNote);
      setActiveOrder(confirmed);
      setOrders(prev => prev.map(o => o.id === activeOrder.id ? confirmed : o));
    } catch (e: any) {
      console.error('Failed to update order status:', e);
      // Revert optimistic update on error
      setActiveOrder(prevOrder);
      setOrders(prevOrders);
      setErrorMessage(e.message || 'Failed to update order status in Supabase. Reverting.');
      setMessage(null);
    } finally {
      setIsUpdating(false);
    }
  };

  // Fast Payment Status Update
  const handleUpdatePaymentStatus = async (newPaymentStatus: PaymentStatus) => {
    if (!activeOrder || isUpdating) return;
    const prevOrder = { ...activeOrder };
    const prevOrders = [...orders];

    // Optimistic update
    const optimisticUpdated: Order = {
      ...activeOrder,
      paymentStatus: newPaymentStatus,
      updatedAt: new Date().toISOString()
    };
    setActiveOrder(optimisticUpdated);
    setOrders(prev => prev.map(o => o.id === activeOrder.id ? optimisticUpdated : o));
    setMessage(`Payment status set to ${newPaymentStatus}`);
    setErrorMessage(null);

    try {
      setIsUpdating(true);
      const confirmed = await api.updatePaymentStatus(activeOrder.id, newPaymentStatus);
      setActiveOrder(confirmed);
      setOrders(prev => prev.map(o => o.id === activeOrder.id ? confirmed : o));
    } catch (e: any) {
      console.error('Failed to update payment status:', e);
      setActiveOrder(prevOrder);
      setOrders(prevOrders);
      setErrorMessage(e.message || 'Failed to update payment status in Supabase. Reverting.');
      setMessage(null);
    } finally {
      setIsUpdating(false);
    }
  };

  // Open Phone History Modal (Issue 1)
  const handleOpenPhoneHistory = async (phone: string, customerName?: string) => {
    if (!phone) return;
    setPhoneHistoryPhone(phone);
    setPhoneHistoryCustomerName(customerName || 'Customer');
    setIsLoadingPhoneHistory(true);

    try {
      const history = await api.getCustomerOrdersByPhone(phone);
      setPhoneHistoryOrders(history);
    } catch (err) {
      console.error('Error fetching phone history:', err);
    } finally {
      setIsLoadingPhoneHistory(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#38251F]">
            Order Management
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Process customer orders, review meat cuts, manage phone order history, and record walk-in counter sales.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsManualModalOpen(true)}
            className="px-4 py-2.5 bg-[#D92332] hover:bg-[#b81d2a] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Manual Order</span>
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-60 text-stone-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset filters and refresh latest orders from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? 'animate-spin text-[#D92332]' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button 
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-800 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter, Search & Date Controls Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200/90 shadow-2xs space-y-3.5">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row gap-3">
          {/* Search by Number, Name, Phone, Locality, or Product (Issue 7) */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by Order #, Customer Name, Phone, Address, or Chicken Cut..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-10 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Presets & Date Picker (Issue 5) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-stone-50 border border-stone-200 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setSelectedDate('All')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  selectedDate === 'All'
                    ? 'bg-[#38251F] text-white shadow-2xs'
                    : 'text-stone-600 hover:bg-stone-200/60'
                }`}
              >
                All Dates
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(todayKolkata)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  selectedDate === todayKolkata
                    ? 'bg-[#D92332] text-white shadow-2xs'
                    : 'text-stone-600 hover:bg-stone-200/60'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(yesterdayKolkata)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  selectedDate === yesterdayKolkata
                    ? 'bg-[#38251F] text-white shadow-2xs'
                    : 'text-stone-600 hover:bg-stone-200/60'
                }`}
              >
                Yesterday
              </button>
            </div>

            {/* Custom Date Input */}
            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDate === 'All' ? '' : selectedDate}
                onChange={e => setSelectedDate(e.target.value || 'All')}
                className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-hidden focus:border-[#D92332]"
                title="Filter orders by specific Indian calendar date"
              />
            </div>
          </div>

          {/* Status Dropdowns */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-hidden focus:border-[#D92332]"
            >
              <option value="All">All Order Statuses</option>
              {ALL_ORDER_STATUSES.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            <select
              value={selectedPaymentStatus}
              onChange={e => setSelectedPaymentStatus(e.target.value)}
              className="px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-hidden focus:border-[#D92332]"
            >
              <option value="All">All Payments</option>
              {ALL_PAYMENT_STATUSES.map(pst => (
                <option key={pst} value={pst}>Payment: {pst}</option>
              ))}
            </select>
          </div>
        </form>

        {/* Filter Summary Tags */}
        <div className="flex flex-wrap items-center justify-between text-xs text-stone-500 pt-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#38251F]">{filteredOrders.length}</span>
            <span>orders found</span>
            {selectedDate !== 'All' && (
              <span className="px-2 py-0.5 rounded-md bg-stone-100 font-semibold text-stone-700 text-[11px]">
                Date: {selectedDate} (IST)
              </span>
            )}
            {selectedStatus !== 'All' && (
              <span className="px-2 py-0.5 rounded-md bg-stone-100 font-semibold text-stone-700 text-[11px]">
                Status: {selectedStatus}
              </span>
            )}
            {search && (
              <span className="px-2 py-0.5 rounded-md bg-stone-100 font-semibold text-stone-700 text-[11px]">
                Search: "{search}"
              </span>
            )}
          </div>

          {(selectedDate !== 'All' || selectedStatus !== 'All' || selectedPaymentStatus !== 'All' || search) && (
            <button
              type="button"
              onClick={handleRefresh}
              className="text-[#D92332] hover:underline font-bold text-[11px] cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[11px] font-bold">
                <th className="py-3 px-4">Order # & Type</th>
                <th className="py-3 px-4">Customer & Phone</th>
                <th className="py-3 px-4">Chicken Cuts & Packs</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Order Status</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-stone-400 space-y-2">
                    <RefreshCw className="w-7 h-7 text-[#D92332] animate-spin mx-auto mb-2" />
                    <p className="font-semibold text-stone-600">Loading orders from database...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-stone-400 space-y-2">
                    <ShoppingBag className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-bold text-stone-700 text-sm">No orders match your filter criteria</p>
                    <p className="text-xs text-stone-400 max-w-sm mx-auto">
                      {selectedDate !== 'All'
                        ? `No orders found for date ${selectedDate}. Try selecting another date or resetting filters.`
                        : 'No orders found matching the current search parameters.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="mt-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-[#38251F] font-bold text-xs rounded-xl"
                    >
                      Reset Filters & View All
                    </button>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const manual = isManualOrder(order);
                  return (
                    <tr key={order.id} className="hover:bg-amber-50/60 transition-colors odd:bg-white even:bg-stone-50/50 border-b border-stone-200/90">
                      {/* Order # and Tag */}
                      <td className="py-3.5 px-4 font-mono font-bold text-[#D92332]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{order.orderNumber}</span>
                          {manual && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                              Manual
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-400 font-sans mt-0.5">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} • {getKolkataDateString(order.createdAt)}
                        </div>
                      </td>

                      {/* Customer, Phone & Delivery Address / Maps Pin */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-[#38251F]">{order.customer.name}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPhoneHistory(order.customer.phone, order.customer.name)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer group"
                            title="Click to view complete order history for this phone number"
                          >
                            <Phone className="w-3 h-3 text-emerald-600 group-hover:scale-110 transition-transform" />
                            <span>{order.customer.phone || 'No phone'}</span>
                          </button>
                        </div>
                        <div className="text-[11px] text-stone-500 line-clamp-1 mt-0.5" title={order.customer.address}>
                          {order.customer.address}{order.customer.landmark ? ` (${order.customer.landmark})` : ''}
                        </div>
                        {order.customer.googleMapsUrl && (
                          <a
                            href={order.customer.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline mt-0.5"
                          >
                            <MapPin className="w-2.5 h-2.5" />
                            <span>Google Maps Pin</span>
                            <ExternalLink className="w-2 h-2" />
                          </a>
                        )}
                      </td>

                      {/* Cuts Summary */}
                      <td className="py-3.5 px-4 max-w-xs text-stone-600">
                        {order.items && order.items.length > 0 ? (
                          <div className="space-y-0.5">
                            <div className="font-medium truncate" title={order.items.map(i => `${i.quantity}x ${i.productName} (${i.weight})`).join(', ')}>
                              {order.items.map(i => `${i.quantity}x ${i.productName} (${i.weight})`).join(', ')}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              {order.items.length} item{order.items.length > 1 ? 's' : ''} total
                            </div>
                          </div>
                        ) : (
                          <span className="text-stone-400 italic">No item snapshot</span>
                        )}
                      </td>

                      {/* Order Amount (Issue 2: Guaranteed ₹ display without ₹0 bug) */}
                      <td className="py-3.5 px-4 font-extrabold text-[#38251F]">
                        <span className="text-sm font-black text-[#D92332]">
                          ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-stone-400 font-normal block">
                          {order.paymentMethod}
                        </span>
                      </td>

                      {/* Order Status Badge (Issue 3: Delivered is Emerald Green) */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-block ${getStatusBadgeClass(order.orderStatus)}`}>
                          {order.orderStatus}
                        </span>
                      </td>

                      {/* Payment Status Badge */}
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

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveOrder(order);
                            setMessage(null);
                            setErrorMessage(null);
                          }}
                          className="px-3 py-1.5 bg-[#38251F] hover:bg-[#D92332] text-white rounded-lg font-bold text-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Manage</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Management Details Modal */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-[#FFF9F1] rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-300 relative text-[#38251F] my-2 sm:my-8 flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden">
            {/* Sticky Header with visible Close (X) button */}
            <div className="sticky top-0 z-20 bg-[#FFF9F1] px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-200 flex items-center justify-between shrink-0 shadow-2xs">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#D92332] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-[#38251F] truncate">
                      Order #{activeOrder.orderNumber}
                    </h3>
                    {isManualOrder(activeOrder) && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-300">
                        Manual Order
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] sm:text-xs text-stone-500 truncate">
                    Placed on {new Date(activeOrder.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white hover:bg-stone-100 text-stone-600 hover:text-[#D92332] border border-stone-300 shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer"
                aria-label="Close order details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 overscroll-contain">
              {message && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{message}</span>
                </div>
              )}
              {activeOrder.trackingToken && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-amber-900">Secure customer tracking link</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const trackingUrl = `${window.location.origin}/order-status/${encodeURIComponent(activeOrder.orderNumber)}#token=${encodeURIComponent(activeOrder.trackingToken!)}`;
                      try {
                        await navigator.clipboard.writeText(trackingUrl);
                        setMessage('Secure tracking link copied. Share it with the customer.');
                      } catch {
                        setErrorMessage('Could not copy the tracking link. Check browser clipboard permissions.');
                      }
                    }}
                    className="px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-900 hover:bg-amber-100 inline-flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy link
                  </button>
                </div>
              )}

              {/* Status Modification Controls (Issue 3: Dynamic status color text!) */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 1. Order Status */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Order Status (Current: <span className={getStatusTextClass(activeOrder.orderStatus)}>{activeOrder.orderStatus}</span>)
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

                  {/* 2. Payment Status */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Payment Status (Current: <span className="text-emerald-700 font-bold">{activeOrder.paymentStatus}</span>)
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
                    Optional Transition Note (e.g. Assigned to delivery partner Ravi, or special butchering cut instruction):
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
                  <div className="flex items-center gap-2 pt-1">
                    <span className="font-semibold text-emerald-700">{activeOrder.customer.phone}</span>
                    <button
                      type="button"
                      onClick={() => handleOpenPhoneHistory(activeOrder.customer.phone, activeOrder.customer.name)}
                      className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      title="View all orders for this customer"
                    >
                      <History className="w-3 h-3 text-[#D92332]" />
                      <span>Order History</span>
                    </button>
                  </div>
                  {activeOrder.customer.notes && (
                    <div className="text-amber-800 bg-amber-50 p-2 rounded-lg mt-2 text-[11px]">
                      <strong>Note:</strong> {activeOrder.customer.notes}
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-1.5">
                  <span className="font-bold text-stone-500 uppercase tracking-wider text-[10px]">
                    Delivery / Pickup Address
                  </span>
                  <div className="text-stone-800 font-medium">{activeOrder.customer.address}</div>
                  {activeOrder.customer.landmark && (
                    <div className="text-stone-500 text-[11px]">Landmark: {activeOrder.customer.landmark}</div>
                  )}
                  {(() => {
                    const mapsUrl = activeOrder.customer.googleMapsUrl || 
                      (activeOrder.customer.latitude && activeOrder.customer.longitude
                        ? `https://www.google.com/maps?q=${activeOrder.customer.latitude},${activeOrder.customer.longitude}`
                        : null);

                    return mapsUrl ? (
                      <div className="pt-1.5">
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs transition-colors shadow-2xs"
                        >
                          <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>View on Google Maps</span>
                          <ExternalLink className="w-3 h-3 text-blue-500" />
                        </a>
                        {activeOrder.customer.latitude && activeOrder.customer.longitude && (
                          <div className="text-[10px] text-stone-400 mt-1 font-mono">
                            GPS: {activeOrder.customer.latitude}, {activeOrder.customer.longitude}
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Ordered Items Table (Issue 6 & Issue 2: Accurate line items, weights, and total amount) */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-3">
                <span className="font-bold text-stone-500 uppercase tracking-wider text-[10px]">
                  Ordered Poultry Items Snapshot ({activeOrder.items.length})
                </span>
                <div className="divide-y divide-stone-100 text-xs">
                  {activeOrder.items.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#38251F]">{item.productName}</div>
                        <div className="text-[11px] text-stone-500">
                          Pack: {item.weight} • Cut: {item.cutPreference} • Rate: ₹{item.unitPrice} × {item.quantity}
                        </div>
                      </div>
                      <div className="font-extrabold text-[#38251F]">₹{item.subtotal}</div>
                    </div>
                  ))}
                </div>

                {/* Subtotals & Total Breakdown */}
                <div className="pt-2 border-t border-stone-200 space-y-1 text-xs">
                  <div className="flex justify-between text-stone-500">
                    <span>Subtotal:</span>
                    <span>₹{activeOrder.subtotal}</span>
                  </div>
                  {activeOrder.deliveryFee > 0 && (
                    <div className="flex justify-between text-stone-500">
                      <span>Delivery Fee:</span>
                      <span>₹{activeOrder.deliveryFee}</span>
                    </div>
                  )}
                  {activeOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount:</span>
                      <span>-₹{activeOrder.discount}</span>
                    </div>
                  )}
                  <div className="pt-1 border-t border-stone-200 flex justify-between font-black text-sm">
                    <span className="text-[#38251F]">Total Bill Amount:</span>
                    <span className="text-base text-[#D92332]">
                      ₹{Number(activeOrder.totalAmount || 0).toLocaleString('en-IN')} ({activeOrder.paymentMethod})
                    </span>
                  </div>
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
                      <span className="text-stone-400">
                        {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Bottom Close Action */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveOrder(null)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-700 transition-colors shadow-2xs active:scale-95 text-center cursor-pointer"
                >
                  Close Order Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phone Number Order History Modal (Issue 1) */}
      {phoneHistoryPhone && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#FFF9F1] rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-stone-300 relative text-[#38251F] my-4 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#38251F]">
                    Customer Order History
                  </h2>
                  <p className="text-xs text-stone-500">
                    Phone: <span className="font-bold text-emerald-800">{phoneHistoryPhone}</span> ({phoneHistoryCustomerName})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPhoneHistoryPhone(null)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-full hover:bg-stone-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto flex-1 space-y-3">
              {isLoadingPhoneHistory ? (
                <div className="py-12 text-center text-xs text-stone-400 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#D92332] mx-auto" />
                  <p>Retrieving complete customer order history...</p>
                </div>
              ) : phoneHistoryOrders.length === 0 ? (
                <div className="py-12 text-center text-stone-400 space-y-2">
                  <AlertCircle className="w-7 h-7 text-stone-300 mx-auto" />
                  <p className="font-bold text-stone-600 text-xs">No prior orders found for this phone number.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-stone-500 bg-white p-3 rounded-xl border border-stone-200">
                    <span>Total Orders: <strong className="text-[#38251F]">{phoneHistoryOrders.length}</strong></span>
                    <span>
                      Cumulative Spend: <strong className="text-[#D92332]">₹{phoneHistoryOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toLocaleString('en-IN')}</strong>
                    </span>
                  </div>

                  <div className="space-y-2">
                    {phoneHistoryOrders.map(order => (
                      <div
                        key={order.id}
                        className="p-3.5 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-2 hover:border-[#D92332]/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-xs text-[#D92332]">{order.orderNumber}</span>
                            <span className="text-[10px] text-stone-400 ml-2">
                              {new Date(order.createdAt).toLocaleDateString('en-IN')} at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeClass(order.orderStatus)}`}>
                              {order.orderStatus}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setPhoneHistoryPhone(null);
                                setActiveOrder(order);
                              }}
                              className="px-2 py-0.5 rounded bg-stone-100 hover:bg-[#38251F] hover:text-white text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              Manage
                            </button>
                          </div>
                        </div>

                        <div className="text-xs text-stone-600">
                          {order.items.map(i => `${i.quantity}x ${i.productName} (${i.weight})`).join(', ')}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs">
                          <span className="text-stone-400 text-[11px]">{order.paymentMethod} • {order.paymentStatus}</span>
                          <span className="font-black text-[#D92332]">₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setPhoneHistoryPhone(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Order Creation Modal */}
      <AdminManualOrderModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onOrderCreated={(newOrder) => {
          loadOrders();
          setActiveOrder(newOrder);
          setMessage(`Manual order ${newOrder.orderNumber} successfully recorded in database!`);
        }}
      />
    </div>
  );
}
