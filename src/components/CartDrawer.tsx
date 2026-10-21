import { useNavigate } from 'react-router-dom';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext.js';
import { useShop } from '../context/ShopContext.js';

export default function CartDrawer() {
  const {
    cart,
    isCartDrawerOpen,
    closeCartDrawer,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    deliveryFee,
    totalAmount,
    freeDeliveryShortfall
  } = useCart();
  const { settings } = useShop();
  const navigate = useNavigate();

  if (!isCartDrawerOpen) return null;

  const minOrderAmount = typeof settings?.minOrderAmount === 'number' ? settings.minOrderAmount : 150;
  const isBelowMinOrder = minOrderAmount > 0 && subtotal < minOrderAmount;

  const handleProceedToCheckout = () => {
    closeCartDrawer();
    navigate('/checkout');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-2xs transition-opacity"
        onClick={closeCartDrawer}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex sm:pl-10">
        <div className="w-full sm:w-screen max-w-md bg-[#FFF9F1] shadow-2xl flex flex-col h-full">
          {/* Header */}
          <div className="p-4 bg-white border-b border-stone-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#D92332]" />
              <h2 className="text-base font-bold text-[#38251F]">Your Fresh Cart</h2>
              <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                {cart.length} {cart.length === 1 ? 'cut' : 'cuts'}
              </span>
            </div>
            <button
              onClick={closeCartDrawer}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 active:scale-95 transition-all"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Delivery Bar */}
          {cart.length > 0 && (
            <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200/60 text-xs">
              {freeDeliveryShortfall > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-semibold text-amber-900">
                    <span className="flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-amber-700" /> Add ₹{freeDeliveryShortfall} more for FREE Delivery!
                    </span>
                    <span>₹{subtotal}/₹{settings?.freeDeliveryThreshold || 499}</span>
                  </div>
                  <div className="w-full bg-amber-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#D92332] h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (subtotal / (settings?.freeDeliveryThreshold || 499)) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Yay! You unlocked FREE Delivery!</span>
                </div>
              )}
            </div>
          )}

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500">
                <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-3 text-stone-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-stone-800 text-base mb-1">Your cart is empty</h3>
                <p className="text-xs text-stone-500 max-w-xs mb-6">
                  Add fresh tender chicken cuts, biryani pieces, boneless breast, or farm eggs to get started.
                </p>
                <button
                  onClick={() => {
                    closeCartDrawer();
                    navigate('/products');
                  }}
                  className="px-5 py-2.5 bg-[#D92332] text-white text-xs font-bold rounded-xl hover:bg-[#b81d2a] shadow-sm transition-all"
                >
                  Explore Fresh Chicken Cuts
                </button>
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={item.cartItemId}
                  className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex gap-3 items-center"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-16 h-16 rounded-lg object-cover shrink-0 bg-stone-100"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-[#38251F] truncate">
                      {item.name}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                      <span className="font-semibold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
                        {item.weight}
                      </span>
                      <span className="truncate">{item.cutPreference}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-xs text-[#D92332]">
                        ₹{item.itemTotal}
                        <span className="text-[10px] text-stone-400 font-normal ml-1">
                          (₹{item.unitPrice} each)
                        </span>
                      </span>

                      {/* Stepper */}
                      <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center rounded bg-white text-stone-700 hover:text-red-600 shadow-2xs text-xs font-bold active:scale-95 transition-transform"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold px-2 text-[#38251F] min-w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded bg-white text-stone-700 hover:text-emerald-600 shadow-2xs text-xs font-bold active:scale-95 transition-transform"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => removeItem(item.cartItemId)}
                    className="text-stone-300 hover:text-red-500 p-2 rounded-lg transition-colors self-start shrink-0"
                    aria-label="Remove item"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer Checkout Summary */}
          {cart.length > 0 && (
            <div className="p-4 bg-white border-t border-stone-200 space-y-3 pb-8 sm:pb-4 safe-bottom shrink-0">
              <div className="space-y-1.5 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#38251F]">₹{subtotal}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    Delivery Fee
                    {deliveryFee === 0 && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                        FREE
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-[#38251F]">
                    {deliveryFee === 0 ? '₹0' : `₹${deliveryFee}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#38251F] pt-2 border-t border-stone-100">
                  <span>To Pay</span>
                  <span className="text-base text-[#D92332]">₹{totalAmount}</span>
                </div>
              </div>

              {isBelowMinOrder ? (
                <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-medium text-center border border-red-200">
                  Minimum order amount for delivery is ₹{minOrderAmount}. Please add ₹{minOrderAmount - subtotal} more.
                </div>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearCart}
                  className="px-3.5 py-3 border border-stone-300 hover:bg-stone-50 rounded-xl text-xs font-semibold text-stone-600 transition-colors shrink-0"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={isBelowMinOrder}
                  onClick={handleProceedToCheckout}
                  className={`flex-1 py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold text-white transition-all flex items-center justify-center gap-1.5 sm:gap-2 shadow-md active:scale-[0.98] ${
                    isBelowMinOrder
                      ? 'bg-stone-300 cursor-not-allowed text-stone-500 shadow-none'
                      : 'bg-[#D92332] hover:bg-[#b81d2a]'
                  }`}
                >
                  <span>Proceed to Guest Checkout</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>

              <div className="text-[10px] text-center text-stone-400">
                No password or account required • Pay on Delivery
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
