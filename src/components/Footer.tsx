import { Link } from 'react-router-dom';
import { Phone, MessageCircle, MapPin, Clock, ShieldCheck, Lock, Truck } from 'lucide-react';
import { useShop } from '../context/ShopContext.js';

export default function Footer() {
  const { settings } = useShop();

  return (
    <footer className="bg-[#38251F] text-stone-300 pt-14 pb-20 md:pb-12 border-t-4 border-[#D92332]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Shop Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D92332] text-white flex items-center justify-center font-black text-lg">
                CCC
              </div>
              <span className="text-xl font-black text-white tracking-wide font-serif">
                Chandu Chicken Center
              </span>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed">
              Serving the neighborhood with farm-fresh, antibiotic-residue-free tender chicken. Cleaned with purified RO water and carved to your cooking preference.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-black/20 p-2.5 rounded-lg border border-white/5">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>100% Halal Certified • Fresh Daily Birds</span>
            </div>
          </div>

          {/* Contact & Hours */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-base uppercase tracking-wider font-sans">
              Shop & Hours
            </h4>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2.5 text-stone-300">
                <MapPin className="w-4 h-4 text-[#D92332] shrink-0 mt-1" />
                <span>
                  {settings?.address || 'Shop No. 4, Main Road, Market Junction, Near RTC Bus Stand'}
                  <br />
                  <span className="text-xs text-stone-400">{settings?.landmark}</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-stone-300">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Open All 7 Days: {settings?.openTime || '7:00 AM'} – {settings?.closeTime || '9:00 PM'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-stone-300">
                <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Fast Home Delivery within ~45 mins</span>
              </div>
            </div>
          </div>

          {/* Quick Help & Order Info */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-base uppercase tracking-wider font-sans">
              Customer Support
            </h4>
            <div className="space-y-2.5 text-sm">
              <a
                href={`tel:${settings?.shopPhone || '+919848022338'}`}
                className="flex items-center gap-2.5 text-stone-300 hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4 text-[#D92332]" />
                <span>Call Shop: {settings?.shopPhone || '+91 98480 22338'}</span>
              </a>
              <a
                href={`https://wa.me/${(settings?.shopWhatsApp || '919848022338').replace(/\D/g, '')}?text=Hi%20Chandu%20Chicken%20Center,%20I%20have%20an%20order%20query`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Order Support</span>
              </a>
              <Link
                to="/track-order"
                className="block text-stone-300 hover:text-white transition-colors"
              >
                Track Live Order Status
              </Link>
              <div className="text-xs text-stone-400 pt-2 border-t border-stone-700">
                Payment: <strong>Cash on Delivery (COD)</strong> accepted. UPI integration in progress.
              </div>
            </div>
          </div>

          {/* Admin & Shop Management Portal */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-base uppercase tracking-wider font-sans">
              Shop Administration
            </h4>
            <p className="text-xs text-stone-400">
              Authorized butcher and shop managers can manage live stock, update prices, and process incoming orders.
            </p>
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D92332] hover:bg-[#b81d2a] text-white text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Lock className="w-4 h-4" />
              <span>Admin Portal Login</span>
            </Link>
          </div>
        </div>

        <div className="pt-8 border-t border-stone-700 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <p>© {new Date().getFullYear()} Chandu Chicken Center. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/products" className="hover:text-stone-300">Fresh Chicken</Link>
            <span>•</span>
            <Link to="/track-order" className="hover:text-stone-300">Track Order</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
