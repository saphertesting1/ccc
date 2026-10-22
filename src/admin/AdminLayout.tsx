import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  ShieldCheck, 
  Store,
  ChevronRight,
  Power
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext.js';
import { useShop } from '../context/ShopContext.js';

export default function AdminLayout() {
  const { admin, logout, isAuthenticated, isLoading } = useAdminAuth();
  const { settings, refreshShopData } = useShop();
  const location = useLocation();
  const navigate = useNavigate();

  // Sidebar states:
  // Mobile drawer open/closed
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  // Desktop sidebar collapsed/expanded
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF9F1] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#D92332] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // Exactly these 6 main navigation items:
  // 1. Dashboard, 2. Orders, 3. Products, 4. Sales Reports, 5. Shop Settings, 6. Logout
  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Orders', path: '/admin/orders', icon: ShoppingBag },
    { name: 'Products', path: '/admin/products', icon: Package },
    { name: 'Sales Reports', path: '/admin/reports', icon: BarChart3 },
    { name: 'Shop Settings', path: '/admin/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const currentNav = navItems.find(item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col text-[#38251F]">
      {/* Top Admin Header with Hamburger Menu */}
      <header className="sticky top-0 z-30 bg-[#38251F] text-stone-200 border-b border-stone-800 shadow-md">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: Hamburger Button & Shop Brand */}
          <div className="flex items-center gap-3">
            {/* Hamburger button for mobile & desktop collapse */}
            <button
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileDrawerOpen(prev => !prev);
                } else {
                  setIsDesktopCollapsed(prev => !prev);
                }
              }}
              className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-200 hover:text-white transition-colors focus:outline-hidden"
              aria-label="Toggle navigation menu"
              title="Toggle Menu"
            >
              <Menu className="w-5 h-5 text-amber-300" />
            </button>

            {/* Shop Brand Title */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#D92332] text-white flex items-center justify-center font-black text-base shadow-sm">
                CCC
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-white text-sm font-serif tracking-tight">
                    Chandu Chicken Center
                  </h1>
                  <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/60">
                    Admin
                  </span>
                </div>
                <p className="text-[10px] text-stone-400">
                  {currentNav?.name || 'Shop Administration'}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Store Status Indicator & Actions */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Store Status Pill */}
            <div className="hidden xs:flex items-center gap-2 px-2.5 py-1 rounded-full bg-stone-800/90 border border-stone-700 text-[11px] font-semibold">
              <span className={`w-2 h-2 rounded-full ${settings?.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span className={settings?.isOpen ? 'text-emerald-300 font-bold' : 'text-red-300 font-bold'}>
                {settings?.isOpen ? 'Store Open' : 'Store Closed'}
              </span>
            </div>

            {/* View Public Store */}
            <Link
              to="/"
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors border border-stone-700"
              title="Open public customer shop in new tab"
            >
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>Customer Shop</span>
            </Link>

            {/* Admin User Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-800/60 text-stone-300 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="max-w-[100px] truncate font-bold text-white">
                {admin?.username || 'Admin'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar Drawer & Content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Mobile Backdrop Overlay */}
        {isMobileDrawerOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-40 md:hidden transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Navigation (Collapsible on Desktop, Sliding Drawer on Mobile) */}
        <aside
          className={`
            fixed md:static inset-y-0 left-0 z-50 
            bg-[#38251F] text-stone-300 flex flex-col justify-between 
            shadow-2xl md:shadow-lg transition-all duration-300 ease-in-out
            ${isMobileDrawerOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
            ${isDesktopCollapsed ? 'md:w-20' : 'md:w-64'}
          `}
        >
          {/* Top of Sidebar */}
          <div>
            {/* Drawer Header (Mobile close button) */}
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#D92332] text-white flex items-center justify-center font-black text-sm">
                  CCC
                </div>
                {(!isDesktopCollapsed || isMobileDrawerOpen) && (
                  <div>
                    <h2 className="font-bold text-white text-xs font-serif uppercase tracking-wider">
                      Admin Menu
                    </h2>
                    <span className="text-[10px] text-stone-400">Chandu Chicken</span>
                  </div>
                )}
              </div>

              {/* Close button for Mobile Drawer */}
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 md:hidden"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Exactly the 6 main navigation items:
                1. Dashboard
                2. Orders
                3. Products
                4. Sales Reports
                5. Shop Settings
                6. Logout */}
            <nav className="p-3 space-y-1.5" aria-label="Admin Navigation">
              {navItems.map(item => {
                const isActive = location.pathname === item.path || (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[#D92332] text-white shadow-md'
                        : 'text-stone-300 hover:bg-white/5 hover:text-white'
                    } ${isDesktopCollapsed && !isMobileDrawerOpen ? 'md:justify-center md:px-2' : ''}`}
                    title={item.name}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {(!isDesktopCollapsed || isMobileDrawerOpen) && (
                      <span className="truncate">{item.name}</span>
                    )}
                  </Link>
                );
              })}

              {/* 6. Logout Navigation Item */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  handleLogout();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold text-red-300 hover:bg-red-950/50 hover:text-red-200 transition-colors ${
                  isDesktopCollapsed && !isMobileDrawerOpen ? 'md:justify-center md:px-2' : ''
                }`}
                title="Logout"
              >
                <LogOut className="w-4 h-4 shrink-0 text-red-400" />
                {(!isDesktopCollapsed || isMobileDrawerOpen) && (
                  <span>Logout</span>
                )}
              </button>
            </nav>
          </div>

          {/* Sidebar Footer Info */}
          {(!isDesktopCollapsed || isMobileDrawerOpen) && (
            <div className="p-4 border-t border-stone-800/80 text-[11px] text-stone-400 space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span>Admin User:</span>
                <span className="text-white font-bold">{admin?.username}</span>
              </div>
              <Link
                to="/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 p-2 rounded-lg bg-stone-800/60 hover:bg-stone-800 text-stone-300 hover:text-white transition-colors text-xs font-semibold"
              >
                <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Visit Storefront</span>
              </Link>
            </div>
          )}
        </aside>

        {/* Content Area - Resizes dynamically */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
