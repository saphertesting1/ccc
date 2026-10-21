import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Truck, 
  Banknote, 
  Clock, 
  MapPin, 
  Phone, 
  User, 
  AlertCircle, 
  ArrowLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { useCart } from '../context/CartContext.js';
import { useShop } from '../context/ShopContext.js';
import { api } from '../services/api.js';
import { UpiPendingModal } from '../components/UpiPendingModal.js';

export default function CheckoutPage() {
  const { cart, subtotal, deliveryFee, totalAmount, clearCart } = useCart();
  const { settings } = useShop();
  const navigate = useNavigate();

  // Load saved profile & addresses from Account
  const savedProfile = (() => {
    try {
      const raw = localStorage.getItem('ccc_customer_profile');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const savedAddresses: Array<{ id: string; label: string; tag: string; address: string; landmark?: string; isDefault?: boolean }> = (() => {
    try {
      const raw = localStorage.getItem('ccc_saved_addresses');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  })();

  const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];

  // Form State (Guest Checkout)
  const [name, setName] = useState(savedProfile?.name || '');
  const [phone, setPhone] = useState(savedProfile?.phone || '');
  const [address, setAddress] = useState(defaultAddr?.address || '');
  const [landmark, setLandmark] = useState(defaultAddr?.landmark || '');
  const [notes, setNotes] = useState('');

  // Payment method selection
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UPI'>('COD');
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (cart.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Truck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#38251F]">Your Cart is Empty</h2>
        <p className="text-xs text-stone-500">
          Please add fresh chicken cuts to proceed with guest checkout.
        </p>
        <Link
          to="/products"
          className="inline-block px-5 py-2.5 bg-[#D92332] text-white text-xs font-bold rounded-xl"
        >
          View Fresh Cuts
        </Link>
      </div>
    );
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }

    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    const phoneRegex = /^(\+91|0)?[6-9]\d{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setErrorMessage('Please enter a valid 10-digit Indian phone number (e.g. 9848012345).');
      return;
    }

    if (!address.trim() || address.trim().length < 8) {
      setErrorMessage('Please provide a detailed home delivery address (House/Flat No, Street, Locality).');
      return;
    }

    if (paymentMethod === 'UPI') {
      setIsUpiModalOpen(true);
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        customer: {
          name: name.trim(),
          phone: cleanPhone,
          address: address.trim(),
          landmark: landmark.trim(),
          notes: notes.trim()
        },
        items: cart.map(item => ({
          productId: item.productId,
          weight: item.weight,
          cutPreference: item.cutPreference,
          quantity: item.quantity
        })),
        paymentMethod: 'COD' as const,
        idempotencyKey: `idem-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      };

      const order = await api.createOrder(payload);

      // Persist order locally for customer orders history
      try {
        const raw = localStorage.getItem('ccc_customer_orders');
        const existingList = raw ? JSON.parse(raw) : [];
        localStorage.setItem('ccc_customer_orders', JSON.stringify([order, ...existingList]));
      } catch (e) {
        console.error('Failed to save to local customer orders:', e);
      }

      // Persist profile contact info
      try {
        localStorage.setItem('ccc_customer_profile', JSON.stringify({
          name: name.trim(),
          phone: cleanPhone
        }));

        // If no addresses saved yet, save this address as default
        const rawAddr = localStorage.getItem('ccc_saved_addresses');
        const currentAddrs = rawAddr ? JSON.parse(rawAddr) : [];
        if (currentAddrs.length === 0) {
          localStorage.setItem('ccc_saved_addresses', JSON.stringify([{
            id: `addr-${Date.now()}`,
            tag: 'Home',
            label: 'Home',
            address: address.trim(),
            landmark: landmark.trim(),
            isDefault: true
          }]));
        }
      } catch (e) {
        console.error('Failed to save profile / address:', e);
      }

      // Order created successfully! Clear cart and navigate to confirmation
      clearCart();
      navigate('/order-confirmation', { state: { order } });
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMessage(err.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 pb-28 md:pb-16">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-[#D92332] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Cart</span>
      </button>

      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#38251F]">
          Fast Guest Checkout
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          No account or password required. Provide your delivery address and pay on arrival.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Guest Delivery Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Guest Identity Notice */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-700" />
            </div>
            <div className="text-xs text-stone-700">
              <div className="font-bold text-[#38251F]">Instant Guest Order • No Login Required</div>
              <div>We only use your phone number to send live delivery tracking updates.</div>
            </div>
          </div>

          {/* Delivery Information Box */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-stone-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#38251F] flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#D92332]" />
              <span>Home Delivery Details</span>
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Varma"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  />
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Contact Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9848012345 (10-digit mobile)"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  />
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Delivery rider will call this number upon arrival.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-700">
                    Delivery Address <span className="text-red-500">*</span>
                  </label>
                  {savedAddresses.length > 0 && (
                    <span className="text-[10px] text-stone-500">
                      Tap a saved address to autofill:
                    </span>
                  )}
                </div>

                {savedAddresses.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {savedAddresses.map(addrItem => (
                      <button
                        key={addrItem.id}
                        type="button"
                        onClick={() => {
                          setAddress(addrItem.address);
                          if (addrItem.landmark) setLandmark(addrItem.landmark);
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                          address === addrItem.address
                            ? 'bg-[#38251F] text-amber-300 border-[#38251F]'
                            : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
                        }`}
                      >
                        📍 {addrItem.label || addrItem.tag}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  required
                  rows={3}
                  placeholder="Flat/House number, building name, street address, locality..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Optional Landmark
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near Rythu Bazar, Opposite Water Tank"
                  value={landmark}
                  onChange={e => setLandmark(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Butchering / Delivery Instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Please cut into extra small pieces / ring doorbell once"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Selection (Only COD & UPI shown, no cards or netbanking!) */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-stone-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#38251F]">Select Payment Method</h2>

            <div className="space-y-3">
              {/* Option 1: Cash on Delivery (Active) */}
              <label
                onClick={() => setPaymentMethod('COD')}
                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'COD'
                    ? 'border-[#D92332] bg-red-50/40 shadow-xs'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="COD"
                  checked={paymentMethod === 'COD'}
                  onChange={() => setPaymentMethod('COD')}
                  className="mt-1 text-[#D92332] focus:ring-[#D92332]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span className="font-extrabold text-xs sm:text-sm text-[#38251F]">
                      Cash on Delivery (COD)
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Pay with cash when your fresh chicken package arrives at your door.
                  </p>
                </div>
              </label>

              {/* Option 2: UPI (Clearly labelled "UPI integration pending") */}
              <div
                onClick={() => {
                  setPaymentMethod('UPI');
                  setIsUpiModalOpen(true);
                }}
                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'UPI'
                    ? 'border-amber-400 bg-amber-50/50'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="UPI"
                  checked={paymentMethod === 'UPI'}
                  onChange={() => {
                    setPaymentMethod('UPI');
                    setIsUpiModalOpen(true);
                  }}
                  className="mt-1 text-amber-600 focus:ring-amber-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-xs sm:text-sm text-[#38251F]">
                      UPI (Google Pay / PhonePe / Paytm / BHIM)
                    </span>
                    <span className="bg-amber-200 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" /> Integration Pending
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-1">
                    Direct bank gateway onboarding in progress. Click to view pending integration notice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Placement */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-stone-200 shadow-xs space-y-4 sticky top-24">
            <h2 className="text-base font-bold text-[#38251F] border-b border-stone-100 pb-3">
              Order Summary ({cart.length} {cart.length === 1 ? 'item' : 'items'})
            </h2>

            {/* Items summary */}
            <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
              {cart.map(item => (
                <div key={item.cartItemId} className="flex items-center gap-3 text-xs">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-12 h-12 rounded-lg object-cover bg-stone-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#38251F] truncate">{item.name}</div>
                    <div className="text-[11px] text-stone-500">
                      {item.weight} • {item.cutPreference} • Qty: {item.quantity}
                    </div>
                  </div>
                  <span className="font-extrabold text-[#38251F] shrink-0">₹{item.itemTotal}</span>
                </div>
              ))}
            </div>

            {/* Bill Details */}
            <div className="space-y-2 pt-3 border-t border-stone-100 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-[#38251F]">₹{subtotal}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Delivery Fee</span>
                <span className="font-semibold text-[#38251F]">
                  {deliveryFee === 0 ? (
                    <span className="text-emerald-700 font-bold">FREE</span>
                  ) : (
                    `₹${deliveryFee}`
                  )}
                </span>
              </div>
              <div className="flex justify-between text-base font-black text-[#38251F] pt-2 border-t border-stone-100">
                <span>Total Amount</span>
                <span className="text-[#D92332]">₹{totalAmount}</span>
              </div>
            </div>

            {/* Place Order CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] ${
                isSubmitting ? 'bg-stone-400 cursor-wait' : 'bg-[#D92332] hover:bg-[#b81d2a]'
              }`}
            >
              {isSubmitting ? (
                <span>Placing your order...</span>
              ) : (
                <>
                  <span>Place Guest Order (₹{totalAmount})</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-[11px] text-stone-500 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-emerald-700 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% Genuine Farm Cuts Guarantee
              </div>
              <p>Estimated Delivery: ~{settings?.deliveryTimeEstimateMins || 45} minutes</p>
            </div>
          </div>
        </div>
      </form>

      {/* UPI Pending Notice Modal */}
      <UpiPendingModal
        isOpen={isUpiModalOpen}
        onClose={() => {
          setIsUpiModalOpen(false);
          setPaymentMethod('COD');
        }}
      />
    </div>
  );
}
