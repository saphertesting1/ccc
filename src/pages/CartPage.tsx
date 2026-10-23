import { Link, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  ShieldCheck, 
  Truck, 
  ArrowLeft,
  Clock,
  Sparkles
} from 'lucide-react';
import { useCart } from '../context/CartContext.js';
import { useShop } from '../context/ShopContext.js';

export default function CartPage() {
  const {
    cart,
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

  const minOrderAmount = typeof settings?.minOrderAmount === 'number' ? settings.minOrderAmount : 0;
  const isBelowMinOrder = minOrderAmount > 0 && subtotal < minOrderAmount;

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6 pb-28 md:pb-16">
        <div className="w-20 h-20 rounded-full bg-amber-100 text-[#D92332] flex items-center justify-center mx-auto shadow-inner">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-[#38251F]">Your Cart is Empty</h1>
          <p className="text-sm text-stone-500 max-w-sm mx-auto">
            You haven't added any fresh tender chicken cuts yet. Pick from our curry cuts, biryani pieces, boneless fillets, or farm eggs.
          </p>
        </div>
        <div className="pt-2">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#D92332] hover:bg-[#b81d2a] text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95"
          >
            <span>Browse Fresh Cuts</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-28 md:pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-[#D92332] transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Continue Shopping</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-black text-[#38251F]">
            Review Your Cart
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            {cart.length} {cart.length === 1 ? 'item' : 'items'} in your fresh poultry order
          </p>
        </div>

        <button
          onClick={clearCart}
          className="text-xs font-bold text-stone-500 hover:text-red-600 px-3 py-2 border border-stone-200 rounded-xl bg-white hover:bg-stone-50 transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Cart</span>
        </button>
      </div>

      {/* Free delivery threshold progress */}
      {freeDeliveryShortfall > 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl space-y-2 text-xs">
          <div className="flex items-center justify-between font-bold text-amber-900">
            <span className="flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-amber-700" />
              Add ₹{freeDeliveryShortfall} more for FREE Delivery!
            </span>
            <span>₹{subtotal} / ₹{settings?.freeDeliveryThreshold || 499}</span>
          </div>
          <div className="w-full bg-amber-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#D92332] h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (subtotal / (settings?.freeDeliveryThreshold || 499)) * 100)}%`
              }}
            />
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Congratulations! You have unlocked FREE Home Delivery.</span>
        </div>
      )}

      {/* Cart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Items List */}
        <div className="lg:col-span-7 space-y-3">
          {cart.map(item => (
            <div
              key={item.cartItemId}
              className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
            >
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 bg-stone-100 border border-stone-100"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-[#38251F] line-clamp-1">
                    {item.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mt-1">
                    <span className="font-bold text-[#38251F] bg-amber-100/70 text-amber-900 px-2 py-0.5 rounded-md text-[11px]">
                      {item.weight}
                    </span>
                    <span className="text-stone-400">•</span>
                    <span className="text-stone-600 font-medium text-[11px]">
                      {item.cutPreference}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-stone-500 mt-1">
                    ₹{item.unitPrice} per pack
                  </div>
                </div>
              </div>

              {/* Quantity Stepper & Subtotal */}
              <div className="flex items-center justify-between w-full sm:w-auto sm:flex-col sm:items-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                <div className="text-right">
                  <span className="text-base font-black text-[#D92332]">
                    ₹{item.itemTotal}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-stone-100 rounded-xl p-1 border border-stone-200">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                      className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg bg-white text-stone-700 hover:text-red-600 shadow-2xs font-bold text-xs active:scale-95 transition-transform"
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
                      className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg bg-white text-stone-700 hover:text-emerald-600 shadow-2xs font-bold text-xs active:scale-95 transition-transform"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.cartItemId)}
                    className="p-2 text-stone-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Bill Summary */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
            <h2 className="font-bold text-base text-[#38251F] border-b border-stone-100 pb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D92332]" />
              <span>Bill Summary</span>
            </h2>

            <div className="space-y-2.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-bold text-[#38251F]">₹{subtotal}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-stone-500" />
                  <span>Delivery Charges</span>
                </span>
                <span className="font-bold">
                  {deliveryFee === 0 ? (
                    <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                      FREE
                    </span>
                  ) : (
                    `₹${deliveryFee}`
                  )}
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t border-stone-200 text-sm font-black text-[#38251F]">
                <span>To Pay</span>
                <span className="text-xl text-[#D92332]">₹{totalAmount}</span>
              </div>
            </div>

            {isBelowMinOrder && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium leading-relaxed">
                Minimum order amount for delivery is ₹{minOrderAmount}. Please add ₹{minOrderAmount - subtotal} more to checkout.
              </div>
            )}

            <button
              type="button"
              disabled={isBelowMinOrder}
              onClick={() => navigate('/checkout')}
              className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 shadow-md active:scale-98 ${
                isBelowMinOrder
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed shadow-none'
                  : 'bg-[#D92332] hover:bg-[#b81d2a]'
              }`}
            >
              <span>Proceed to Guest Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="space-y-1.5 pt-2 text-[11px] text-stone-500 text-center">
              <div className="flex items-center justify-center gap-1.5 text-emerald-700 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Zero Account or Password Needed • Guest Checkout</span>
              </div>
              <p>Cash on Delivery (COD) supported upon delivery</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
