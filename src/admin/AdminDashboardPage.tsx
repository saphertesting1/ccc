import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingBag, 
  IndianRupee, 
  Clock, 
  Truck, 
  CheckCircle2, 
  ChevronRight, 
  AlertCircle, 
  Power, 
  RefreshCw, 
  UtensilsCrossed, 
  Phone, 
  MapPin, 
  ExternalLink, 
  ChevronDown,
  Calendar
} from 'lucide-react';
import { api, getKolkataDateString } from '../services/api.js';
import { Order, OrderStatus } from '../types/index.js';
import { useShop } from '../context/ShopContext.js';

export default function AdminDashboardPage() {
  const { settings, refreshShopData } = useShop();
  const todayKolkata = getKolkataDateString(new Date());

  const [reports, setReports] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [reportData, ordersData] = await Promise.all([
        api.getReports(),
        api.getAdminOrders()
      ]);
      setReports(reportData);
      setOrders(ordersData);
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleToggleShopOpen = async () => {
    if (!settings) return;
    try {
      await api.updateSettings({ isOpen: !settings.isOpen });
      await refreshShopData();
    } catch (e) {
      console.error('Failed to toggle shop status:', e);
    }
  };

  const handleQuickStatusAdvance = async (order: Order, nextStatus: OrderStatus) => {
    try {
      setIsUpdatingStatus(order.id);
      await api.updateOrderStatus(order.id, nextStatus, `Updated via admin dashboard quick-action`);
      await loadDashboardData();
    } catch (e) {
      console.error('Failed to update status:', e);
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  // Derive operations metrics strictly for TODAY in Indian Standard Time (Asia/Kolkata)
  const todayOrders = orders.filter(o => o.createdAt && getKolkataDateString(o.createdAt) === todayKolkata);
  
  // 1. Today's orders count
  const todayOrdersCount = reports?.todayOrdersCount ?? todayOrders.length;

  // 2. Orders awaiting action (New orders placed today waiting for store acceptance)
  const ordersAwaitingAction = todayOrders.filter(o => o.orderStatus === 'New').length;

  // 3. Orders currently being prepared or delivered today
  const ordersBeingPreparedOrDelivered = todayOrders.filter(
    o => o.orderStatus === 'Accepted' || 
         o.orderStatus === 'Preparing' || 
         o.orderStatus === 'Ready for Dispatch' || 
         o.orderStatus === 'Out for Delivery'
  ).length;

  // 4. Completed orders (Delivered today)
  const completedOrdersCount = todayOrders.filter(o => o.orderStatus === 'Delivered').length;

  // 5. Today's sales total (Delivered or active orders today)
  const calculatedTodaySales = todayOrders
    .filter(o => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Rejected')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const todaySalesTotal = reports?.todayRevenue ?? calculatedTodaySales;

  // Filtered today's orders by Status
  const displayedOrders = (statusFilter === 'All' 
    ? todayOrders 
    : todayOrders.filter(o => o.orderStatus === statusFilter)
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'New':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Accepted':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'Preparing':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'Ready for Dispatch':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      case 'Out for Delivery':
        return 'bg-cyan-100 text-cyan-900 border-cyan-300';
      case 'Delivered':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Cancelled':
      case 'Rejected':
        return 'bg-red-100 text-red-900 border-red-300';
      default:
        return 'bg-stone-100 text-stone-800 border-stone-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Overview Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#38251F]">
            Shop Operations Dashboard
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Real-time poultry orders, kitchen preparation status, and daily sales metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Refresh button */}
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors shadow-2xs"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#D92332]' : ''}`} />
          </button>

          {/* Quick Store Open/Close Toggle */}
          <button
            onClick={handleToggleShopOpen}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs ${
              settings?.isOpen
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{settings?.isOpen ? 'Store: OPEN' : 'Store: CLOSED'}</span>
          </button>
        </div>
      </div>

      {/* 5 Compact Summary Cards:
          1. Today's orders
          2. Orders awaiting action
          3. Orders currently being prepared or delivered
          4. Completed orders
          5. Today's sales total */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Card 1: Today's Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              Today's Orders
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-[#38251F]">
              {todayOrdersCount}
            </div>
            <p className="text-[10px] text-stone-400 mt-0.5">Placed today</p>
          </div>
        </div>

        {/* Card 2: Orders Awaiting Action */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Awaiting Action
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-700">
              {ordersAwaitingAction}
            </div>
            <p className="text-[10px] text-stone-400 mt-0.5">Requires store acceptance</p>
          </div>
        </div>

        {/* Card 3: Currently Being Prepared or Delivered */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              Prep & Delivery
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-purple-800">
              {ordersBeingPreparedOrDelivered}
            </div>
            <p className="text-[10px] text-stone-400 mt-0.5">In kitchen / Out with rider</p>
          </div>
        </div>

        {/* Card 4: Completed Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Completed Orders
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-700">
              {completedOrdersCount}
            </div>
            <p className="text-[10px] text-stone-400 mt-0.5">Delivered to customers</p>
          </div>
        </div>

        {/* Card 5: Today's Sales Total */}
        <div className="col-span-2 lg:col-span-1 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#D92332] uppercase tracking-wider">
              Today's Sales
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-100 text-[#D92332] flex items-center justify-center font-black text-sm shrink-0">
              ₹
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-[#D92332]">
              ₹{todaySalesTotal}
            </div>
            <p className="text-[10px] text-stone-400 mt-0.5">Total gross for today</p>
          </div>
        </div>
      </div>

      {/* Recent Orders Table & List */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
        {/* Table Header & Controls (Strictly Today's Orders in Asia/Kolkata timezone) */}
        <div className="p-4 sm:p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#38251F]">
                  Today's Orders
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-[10px] font-bold text-amber-900 border border-amber-200">
                  IST • Today
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                Live customer orders placed today ({displayedOrders.length} orders)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="text-xs font-semibold bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-stone-700 focus:outline-hidden"
            >
              <option value="All">All Statuses ({todayOrders.length})</option>
              <option value="New">New</option>
              <option value="Accepted">Accepted</option>
              <option value="Preparing">Preparing</option>
              <option value="Ready for Dispatch">Ready for Dispatch</option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Delivered">Delivered</option>
            </select>

            <Link
              to="/admin/orders"
              className="px-3.5 py-1.5 bg-[#38251F] hover:bg-[#D92332] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <span>Manage All Historical Orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-stone-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#D92332] mb-2" />
            <span>Loading orders...</span>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-500 space-y-1">
            <ShoppingBag className="w-8 h-8 text-stone-300 mx-auto mb-1" />
            <p className="font-bold text-stone-700">No orders placed today yet</p>
            <p className="text-stone-400">Customer orders placed today ({todayKolkata}) will appear here live in chronological order.</p>
            {statusFilter !== 'All' && (
              <button
                type="button"
                onClick={() => setStatusFilter('All')}
                className="mt-2 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl"
              >
                Clear Status Filter ({statusFilter})
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {displayedOrders.map(order => (
                    <tr key={order.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-[#D92332]">
                          {order.orderNumber}
                        </span>
                        <div className="text-[10px] text-stone-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#38251F]">
                          {order.customer.name}
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{order.customer.phone}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="truncate font-medium text-stone-700" title={order.items.map(i => `${i.quantity}x ${i.productName} (${i.weight})`).join(', ')}>
                          {order.items.map(i => `${i.quantity}x ${i.productName} (${i.weight})`).join(', ')}
                        </div>
                        <div className="text-[10px] text-stone-400 truncate">
                          {order.customer.address}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#38251F]">
                          ₹{order.totalAmount}
                        </span>
                        <div className="text-[10px] text-stone-400">
                          {order.paymentMethod} • {order.paymentStatus}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold border ${getStatusBadge(order.orderStatus)}`}>
                          {order.orderStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {order.orderStatus === 'New' && (
                            <button
                              onClick={() => handleQuickStatusAdvance(order, 'Accepted')}
                              disabled={isUpdatingStatus === order.id}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-colors"
                            >
                              Accept
                            </button>
                          )}
                          {order.orderStatus === 'Accepted' && (
                            <button
                              onClick={() => handleQuickStatusAdvance(order, 'Preparing')}
                              disabled={isUpdatingStatus === order.id}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-colors"
                            >
                              Prep
                            </button>
                          )}
                          {order.orderStatus === 'Preparing' && (
                            <button
                              onClick={() => handleQuickStatusAdvance(order, 'Out for Delivery')}
                              disabled={isUpdatingStatus === order.id}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-colors"
                            >
                              Dispatch
                            </button>
                          )}
                          {order.orderStatus === 'Out for Delivery' && (
                            <button
                              onClick={() => handleQuickStatusAdvance(order, 'Delivered')}
                              disabled={isUpdatingStatus === order.id}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-colors"
                            >
                              Delivered
                            </button>
                          )}

                          <Link
                            to="/admin/orders"
                            className="p-1 text-stone-400 hover:text-[#D92332] rounded"
                            title="View Full Details in Orders"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (Optimized for small phone screens) */}
            <div className="md:hidden divide-y divide-stone-100">
              {displayedOrders.map(order => (
                <div key={order.id} className="p-4 space-y-2.5 hover:bg-stone-50 transition-colors">
                  {/* Top line: Order # & Status Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#D92332]">
                        {order.orderNumber}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(order.orderStatus)}`}>
                      {order.orderStatus}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#38251F]">
                      {order.customer.name}
                    </span>
                    <a
                      href={`tel:${order.customer.phone}`}
                      className="text-[#D92332] font-semibold flex items-center gap-1 text-[11px]"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{order.customer.phone}</span>
                    </a>
                  </div>

                  {/* Items Summary */}
                  <div className="text-xs text-stone-600 bg-stone-50 p-2 rounded-xl border border-stone-200/60 leading-relaxed">
                    {order.items.map(i => `${i.quantity}x ${i.productName} (${i.weight})`).join(', ')}
                  </div>

                  {/* Address & Bill */}
                  <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                    <span className="truncate max-w-[180px]">
                      {order.customer.address}
                    </span>
                    <span className="font-bold text-xs text-[#38251F]">
                      ₹{order.totalAmount} <span className="text-[10px] font-normal text-stone-400">({order.paymentMethod})</span>
                    </span>
                  </div>

                  {/* Actions on mobile */}
                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                    {order.orderStatus === 'New' && (
                      <button
                        onClick={() => handleQuickStatusAdvance(order, 'Accepted')}
                        disabled={isUpdatingStatus === order.id}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-2xs"
                      >
                        Accept Order
                      </button>
                    )}
                    {order.orderStatus === 'Accepted' && (
                      <button
                        onClick={() => handleQuickStatusAdvance(order, 'Preparing')}
                        disabled={isUpdatingStatus === order.id}
                        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold shadow-2xs"
                      >
                        Start Prep
                      </button>
                    )}
                    {order.orderStatus === 'Preparing' && (
                      <button
                        onClick={() => handleQuickStatusAdvance(order, 'Out for Delivery')}
                        disabled={isUpdatingStatus === order.id}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-2xs"
                      >
                        Dispatch
                      </button>
                    )}
                    {order.orderStatus === 'Out for Delivery' && (
                      <button
                        onClick={() => handleQuickStatusAdvance(order, 'Delivered')}
                        disabled={isUpdatingStatus === order.id}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-2xs"
                      >
                        Mark Delivered
                      </button>
                    )}

                    <Link
                      to="/admin/orders"
                      className="px-2.5 py-1.5 text-xs font-bold text-stone-600 hover:text-[#D92332] border border-stone-200 rounded-lg flex items-center gap-1"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
