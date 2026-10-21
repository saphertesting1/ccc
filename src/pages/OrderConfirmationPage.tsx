import { useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  MapPin, 
  Phone, 
  Clock, 
  ShoppingBag, 
  MessageCircle, 
  ArrowRight,
  ShieldCheck,
  Printer
} from 'lucide-react';
import { Order } from '../types/index.js';
import { useShop } from '../context/ShopContext.js';

export default function OrderConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useShop();

  const order = (location.state as { order?: Order })?.order;

  useEffect(() => {
    // Launch celebratory confetti
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#D92332', '#16A34A', '#EAB308', '#38251F']
      });
    } catch {
      // Ignore if unavailable
    }
  }, []);

  if (!order) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-[#38251F]">No Order Found</h2>
        <p className="text-xs text-stone-500">
          You might have refreshed this page or navigated directly.
        </p>
        <Link
          to="/products"
          className="inline-block px-5 py-2.5 bg-[#D92332] text-white text-xs font-bold rounded-xl"
        >
          Browse Fresh Cuts
        </Link>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Success Hero Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-md text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-3 py-1 rounded-full">
            Order Confirmed & Sent to Butcher
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#38251F] mt-2">
            Thank You, {order.customer.name}!
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Your fresh poultry order is confirmed. Our butchers are preparing your tender cuts right now.
          </p>
        </div>

        {/* Order Reference Box */}
        <div className="bg-[#FFF9F1] p-4 rounded-2xl border border-amber-200 inline-block max-w-sm w-full mx-auto">
          <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Order Tracking Number
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#D92332] tracking-wider mt-0.5">
            {order.orderNumber}
          </div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Estimated Delivery: ~{order.estimatedDeliveryTime || '45 mins'}</span>
          </div>
        </div>

        {/* Fast Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to={`/track-order?ref=${encodeURIComponent(order.orderNumber)}`}
            className="w-full sm:w-auto px-6 py-3 bg-[#D92332] hover:bg-[#b81d2a] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>Track Live Order Status</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <a
            href={`https://wa.me/${(settings?.shopWhatsApp || '919848022338').replace(/\D/g, '')}?text=Hi%20Chandu%20Chicken%20Center,%20I%20have%20an%20order%20update%20for%20order%20${order.orderNumber}`}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-5 py-3 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp Butcher</span>
          </a>

          <button
            onClick={handlePrint}
            className="w-full sm:w-auto px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>

      {/* Order Item Snapshot Details */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-[#38251F] flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-[#D92332]" />
          <span>Carved Item Details</span>
        </h3>

        <div className="divide-y divide-stone-100">
          {order.items.map((item, idx) => (
            <div key={idx} className="py-3 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-[#38251F] text-sm">{item.productName}</div>
                <div className="text-stone-500 text-[11px] mt-0.5">
                  Pack: <span className="font-semibold text-stone-700">{item.weight}</span> • Style: {item.cutPreference} • Qty: {item.quantity}
                </div>
              </div>
              <div className="text-right">
                <div className="font-extrabold text-[#38251F]">₹{item.subtotal}</div>
                <div className="text-[10px] text-stone-400">₹{item.unitPrice} each</div>
              </div>
            </div>
          ))}
        </div>

        {/* Price Breakdown */}
        <div className="pt-3 border-t border-stone-100 space-y-1.5 text-xs text-stone-600">
          <div className="flex justify-between">
            <span>Items Subtotal</span>
            <span className="font-semibold text-[#38251F]">₹{order.subtotal}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Delivery Charges</span>
            <span className="font-semibold text-[#38251F]">
              {order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}
            </span>
          </div>
          <div className="flex justify-between text-base font-black text-[#38251F] pt-2 border-t border-stone-100">
            <span>Total Payable Amount</span>
            <span className="text-[#D92332]">₹{order.totalAmount}</span>
          </div>
        </div>
      </div>

      {/* Delivery & Payment Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#38251F]">
            <MapPin className="w-4 h-4 text-[#D92332]" />
            <span>Delivery Address</span>
          </div>
          <div className="text-stone-700 leading-relaxed">
            <p className="font-semibold text-[#38251F]">{order.customer.name}</p>
            <p>{order.customer.address}</p>
            {order.customer.landmark && (
              <p className="text-stone-500">Landmark: {order.customer.landmark}</p>
            )}
            <p className="font-medium text-stone-600 mt-1">Phone: {order.customer.phone}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#38251F]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Payment Status</span>
          </div>
          <div className="space-y-1 text-stone-700">
            <div>
              Method: <strong>Cash on Delivery (COD)</strong>
            </div>
            <div>
              Status: <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[11px]">{order.paymentStatus}</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-2">
              Please keep ₹{order.totalAmount} exact cash ready for the delivery partner upon arrival.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center pt-4">
        <Link
          to="/products"
          className="text-xs font-bold text-[#D92332] hover:underline"
        >
          ← Continue Browsing Chicken Cuts
        </Link>
      </div>
    </div>
  );
}
