import { useEffect } from 'react';
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Navigate, 
  useLocation, 
  Outlet 
} from 'react-router-dom';

import { ShopProvider } from './context/ShopContext.js';
import { CartProvider } from './context/CartContext.js';
import { AdminAuthProvider } from './context/AdminAuthContext.js';
import { useBackButton } from './hooks/useBackButton.js';

import Navbar from './components/Navbar.js';
import Footer from './components/Footer.js';
import CartDrawer from './components/CartDrawer.js';
import NetworkStatus from './components/NetworkStatus.js';

import HomePage from './pages/HomePage.js';
import ProductsPage from './pages/ProductsPage.js';
import ProductDetailPage from './pages/ProductDetailPage.js';
import CartPage from './pages/CartPage.js';
import CheckoutPage from './pages/CheckoutPage.js';
import CustomerOrdersPage from './pages/CustomerOrdersPage.js';
import AccountPage from './pages/AccountPage.js';
import OrderConfirmationPage from './pages/OrderConfirmationPage.js';
import OrderStatusPage from './pages/OrderStatusPage.js';

import AdminLayout from './admin/AdminLayout.js';
import AdminLoginPage from './admin/AdminLoginPage.js';
import AdminDashboardPage from './admin/AdminDashboardPage.js';
import AdminOrdersPage from './admin/AdminOrdersPage.js';
import AdminProductsPage from './admin/AdminProductsPage.js';
import AdminCategoriesPage from './admin/AdminCategoriesPage.js';
import AdminReportsPage from './admin/AdminReportsPage.js';
import AdminSettingsPage from './admin/AdminSettingsPage.js';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function MobileHardwareBackController() {
  useBackButton();
  return null;
}

// Public Customer Layout Wrapper
function CustomerLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FFF9F1] text-[#38251F]">
      <NetworkStatus />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ShopProvider>
        <CartProvider>
          <AdminAuthProvider>
            <ScrollToTop />
            <MobileHardwareBackController />

            <Routes>
              {/* Customer Public Routes */}
              <Route element={<CustomerLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/orders" element={<CustomerOrdersPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                <Route path="/track-order" element={<OrderStatusPage />} />
                <Route path="/order-status/:ref" element={<OrderStatusPage />} />
              </Route>

              {/* Admin Portal Routes */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="reports" element={<AdminReportsPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AdminAuthProvider>
        </CartProvider>
      </ShopProvider>
    </BrowserRouter>
  );
}
