import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  ShoppingBag, 
  Search, 
  Clock, 
  ShieldCheck, 
  Home, 
  UtensilsCrossed, 
  ClipboardList,
  User 
} from 'lucide-react';
import { useCart } from '../context/CartContext.js';
import { useShop } from '../context/ShopContext.js';

export default function Navbar() {
  const { totalItemsCount, openCartDrawer } = useCart();
  const { settings } = useShop();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/products');
    }
  };

  const isOpen = settings?.isOpen ?? true;

  // Active state checkers for customer bottom navigation
  const isHomeActive = location.pathname === '/';
  const isProductsActive = location.pathname.startsWith('/products');
  const isCartActive = location.pathname === '/cart';
  const isOrdersActive = location.pathname === '/orders' || location.pathname.startsWith('/order-status') || location.pathname.startsWith('/track-order');
  const isAccountActive = location.pathname === '/account';

  return (
    <>
      {/* Top Announcement Bar */}
      <div className="bg-[#38251F] text-[#FFF9F1] text-xs px-4 py-2 border-b border-[#4d332a]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-red-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isOpen ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="font-semibold text-amber-200">
              {isOpen ? 'Store Open for Fresh Orders' : 'Store Currently Closed'}
            </span>
            <span className="text-stone-300 hidden md:inline">|</span>
            <span className="text-stone-300 hidden md:inline flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              {settings?.openTime || '7:00 AM'} - {settings?.closeTime || '9:00 PM'} Daily
            </span>
          </div>

          <div className="flex items-center gap-4 text-stone-300 text-xs">
            <span className="hidden lg:flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% Halal & RO Washed
            </span>
            <span className="text-amber-300 font-medium hidden sm:inline">
              ⚡ 100% Farm Fresh Tender Chicken Cleaned to Order
            </span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-[#FFF9F1]/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          {/* Logo & Brand Identity */}
          <Link to="/" className="flex items-center gap-3 shrink-0 group">
            <div className="w-11 h-11 rounded-xl bg-[#D92332] text-white flex items-center justify-center font-black text-xl tracking-tighter shadow-md group-hover:scale-105 transition-transform">
              CCC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black text-[#D92332] tracking-tight font-serif uppercase">
                  Chandu
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#38251F] uppercase tracking-wider bg-amber-100/80 px-2 py-0.5 rounded text-[10px]">
                  Chicken Center
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium hidden sm:block">
                Farm Fresh Tender Poultry • Daily Clean Cuts
              </p>
            </div>
          </Link>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <input
                type="text"
                placeholder="Search curry cut, boneless, drumstick, eggs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-20 py-2.5 bg-white border border-stone-300 rounded-full text-sm text-[#38251F] placeholder-stone-400 focus:outline-hidden focus:border-[#D92332] focus:ring-2 focus:ring-[#D92332]/20 transition-all shadow-xs"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#D92332] text-white text-xs font-semibold rounded-full hover:bg-[#b81d2a] transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {/* Desktop Nav Actions */}
          <div className="flex items-center gap-3">
            <nav className="hidden lg:flex items-center gap-5 text-sm font-semibold text-[#38251F]">
              <Link 
                to="/" 
                className={`transition-colors ${isHomeActive ? 'text-[#D92332] font-bold' : 'hover:text-[#D92332]'}`}
              >
                Home
              </Link>
              <Link 
                to="/products" 
                className={`transition-colors flex items-center gap-1 ${isProductsActive ? 'text-[#D92332] font-bold' : 'hover:text-[#D92332]'}`}
              >
                <UtensilsCrossed className="w-4 h-4 text-[#D92332]" />
                Products
              </Link>
              <Link 
                to="/orders" 
                className={`transition-colors flex items-center gap-1 ${isOrdersActive ? 'text-[#D92332] font-bold' : 'hover:text-[#D92332]'}`}
              >
                <ClipboardList className="w-4 h-4 text-amber-700" />
                Orders
              </Link>
              <Link 
                to="/account" 
                className={`transition-colors flex items-center gap-1 ${isAccountActive ? 'text-[#D92332] font-bold' : 'hover:text-[#D92332]'}`}
              >
                <User className="w-4 h-4 text-stone-600" />
                Account
              </Link>
            </nav>

            {/* Cart Button */}
            <button
              onClick={openCartDrawer}
              className="relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#D92332] text-white hover:bg-[#b81d2a] transition-all shadow-md active:scale-95"
              aria-label="View Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="font-bold text-sm hidden sm:inline">Cart</span>
              {totalItemsCount > 0 && (
                <span className="bg-amber-300 text-[#38251F] text-xs font-black px-2 py-0.5 rounded-full shadow-xs">
                  {totalItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile search bar */}
        <div className="p-3 border-t border-stone-200/60 md:hidden bg-white/70">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Search chicken cuts, biryani cuts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-16 py-2 bg-white border border-stone-300 rounded-full text-xs text-[#38251F] placeholder-stone-400 focus:outline-hidden focus:border-[#D92332]"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-[#D92332] text-white text-[11px] font-bold rounded-full"
            >
              Find
            </button>
          </form>
        </div>
      </header>

      {/* Customer Mobile Bottom Navigation Bar:
          Exactly 5 items in this order:
          1. Home
          2. Products
          3. Cart
          4. Orders
          5. Account */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFF9F1] border-t border-stone-300/80 shadow-2xl md:hidden safe-bottom"
        aria-label="Customer Navigation"
      >
        <div className="grid grid-cols-5 h-16 items-center text-center text-[10px] font-bold">
          {/* 1. Home */}
          <Link
            to="/"
            className={`flex flex-col items-center justify-center h-full transition-colors relative ${
              isHomeActive 
                ? 'text-[#D92332]' 
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {isHomeActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#D92332] rounded-b-full" />
            )}
            <Home className={`w-5 h-5 mb-1 ${isHomeActive ? 'text-[#D92332]' : 'text-stone-500'}`} />
            <span className={isHomeActive ? 'font-extrabold text-[#D92332]' : ''}>Home</span>
          </Link>

          {/* 2. Products */}
          <Link
            to="/products"
            className={`flex flex-col items-center justify-center h-full transition-colors relative ${
              isProductsActive 
                ? 'text-[#D92332]' 
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {isProductsActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#D92332] rounded-b-full" />
            )}
            <UtensilsCrossed className={`w-5 h-5 mb-1 ${isProductsActive ? 'text-[#D92332]' : 'text-stone-500'}`} />
            <span className={isProductsActive ? 'font-extrabold text-[#D92332]' : ''}>Products</span>
          </Link>

          {/* 3. Cart */}
          <Link
            to="/cart"
            className={`flex flex-col items-center justify-center h-full transition-colors relative ${
              isCartActive 
                ? 'text-[#D92332]' 
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {isCartActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#D92332] rounded-b-full" />
            )}
            <div className="relative">
              <ShoppingBag className={`w-5 h-5 mb-1 ${isCartActive ? 'text-[#D92332]' : 'text-stone-700'}`} />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-[#D92332] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {totalItemsCount}
                </span>
              )}
            </div>
            <span className={isCartActive ? 'font-extrabold text-[#D92332]' : ''}>Cart</span>
          </Link>

          {/* 4. Orders */}
          <Link
            to="/orders"
            className={`flex flex-col items-center justify-center h-full transition-colors relative ${
              isOrdersActive 
                ? 'text-[#D92332]' 
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {isOrdersActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#D92332] rounded-b-full" />
            )}
            <ClipboardList className={`w-5 h-5 mb-1 ${isOrdersActive ? 'text-[#D92332]' : 'text-stone-500'}`} />
            <span className={isOrdersActive ? 'font-extrabold text-[#D92332]' : ''}>Orders</span>
          </Link>

          {/* 5. Account */}
          <Link
            to="/account"
            className={`flex flex-col items-center justify-center h-full transition-colors relative ${
              isAccountActive 
                ? 'text-[#D92332]' 
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {isAccountActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#D92332] rounded-b-full" />
            )}
            <User className={`w-5 h-5 mb-1 ${isAccountActive ? 'text-[#D92332]' : 'text-stone-500'}`} />
            <span className={isAccountActive ? 'font-extrabold text-[#D92332]' : ''}>Account</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
