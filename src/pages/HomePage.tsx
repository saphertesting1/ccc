import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  Phone, 
  MessageCircle, 
  CheckCircle2, 
  Droplets,
  Truck,
  Flame
} from 'lucide-react';
import { useShop } from '../context/ShopContext.js';
import ProductCard from '../components/ProductCard.js';

export default function HomePage() {
  const { products, settings, isLoading, refreshShopData } = useShop();

  useEffect(() => {
    refreshShopData();
  }, [refreshShopData]);

  const featuredProducts = products.filter(p => p.isFeatured && p.isAvailable);

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Banner Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#38251F] via-[#4d332a] to-[#251713] text-white">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D92332_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D92332]/30 border border-[#D92332] text-amber-200 text-xs font-bold tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-[#D92332]" />
                <span>CHANDU CHICKEN CENTER • DAILY FRESH FARM POULTRY</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight font-serif text-white leading-tight">
                Tender, Farm-Fresh Chicken <br />
                <span className="text-[#D92332]">Delivered in 45 Mins</span>
              </h1>

              <p className="text-stone-300 text-sm sm:text-base max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
                100% Halal certified, washed with RO purified water, and carved by master butchers directly upon your order. No frozen meat, no chemical preservatives.
              </p>

              {/* Guarantees Pills */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2 text-xs">
                <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 px-3 py-1.5 rounded-lg text-emerald-400 font-medium">
                  <ShieldCheck className="w-4 h-4" /> 100% Halal & Clean
                </div>
                <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 px-3 py-1.5 rounded-lg text-cyan-300 font-medium">
                  <Droplets className="w-4 h-4" /> RO Water Washed
                </div>
                <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 px-3 py-1.5 rounded-lg text-amber-300 font-medium">
                  <Clock className="w-4 h-4" /> Carved Fresh on Order
                </div>
                <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 px-3 py-1.5 rounded-lg text-white font-medium">
                  <Truck className="w-4 h-4 text-[#D92332]" /> Pay on Delivery (COD)
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-4">
                <Link
                  to="/products"
                  className="w-full sm:w-auto px-7 py-3.5 bg-[#D92332] hover:bg-[#b81d2a] text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 text-sm"
                >
                  <span>Order Fresh Chicken Cuts</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/track-order"
                  className="w-full sm:w-auto px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/20 transition-all text-sm flex items-center justify-center"
                >
                  Track Existing Order
                </Link>
              </div>
            </div>

            {/* Right Hero Image Showcase */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-sm rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 aspect-4/3 group">
                <img
                  src="https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80"
                  alt="Fresh Raw Chicken Cuts at Chandu Chicken Center"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-5 text-white">
                  <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
                    Today's Fresh Batch
                  </span>
                  <h3 className="text-lg font-bold">Standard Curry Cut & Biryani Cuts</h3>
                  <p className="text-xs text-stone-300">Cleaned & ready to cook with zero wastage</p>
                </div>
              </div>

              {/* Floating Badge */}
              <div className="absolute -bottom-4 -left-2 sm:left-4 bg-[#FFF9F1] text-[#38251F] p-3 rounded-2xl shadow-xl border border-amber-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  ⚡ 45m
                </div>
                <div>
                  <div className="text-xs font-extrabold text-[#38251F]">Superfast Delivery</div>
                  <div className="text-[11px] text-stone-500">To your home address</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Featured / Bestseller Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-[#D92332] flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-[#38251F]">
                  Today's Fresh Cuts
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded-full">
                  Featured ({featuredProducts.length > 0 ? featuredProducts.length : products.length})
                </span>
              </div>
              <p className="text-xs text-stone-500">Choose weight (250g, 500g, 1kg) and butcher cut style</p>
            </div>
          </div>
          <Link
            to="/products"
            className="text-xs font-bold text-[#D92332] hover:underline flex items-center gap-1"
          >
            <span>All Products ({products.length})</span> <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="bg-white rounded-2xl h-80 animate-pulse border border-stone-200" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(featuredProducts.length > 0 ? featuredProducts : products).map(prod => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </div>

            {/* Clear View All CTA beneath the grid */}
            <div className="text-center pt-2">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-stone-50 text-[#D92332] font-bold text-xs sm:text-sm rounded-xl border border-stone-200 shadow-xs hover:border-[#D92332] transition-all"
              >
                <span>View Full Menu ({products.length} Fresh Cuts & Products)</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Why Choose Chandu Chicken Center */}
      <section className="bg-[#FFF9F1] border-y border-stone-200/80 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#D92332]">
              The Chandu Chicken Promise
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#38251F] mt-1">
              Why Our Chicken Tastes Noticeably Fresher
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 mt-2">
              Unlike frozen supermarket packets or roadside open-air stalls, we follow stringent butchery hygiene standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-[#D92332] flex items-center justify-center font-bold">
                1
              </div>
              <h3 className="font-bold text-sm text-[#38251F]">Farm-Raised Broilers</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Procured directly from biosecure farms, raised on nutrient grains without growth hormones.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
                2
              </div>
              <h3 className="font-bold text-sm text-[#38251F]">RO Water Cleaned</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Every bird is thoroughly washed with multi-stage RO purified water, removing blood clots and residue.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                3
              </div>
              <h3 className="font-bold text-sm text-[#38251F]">Carved to Your Dish</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Custom cut options for traditional curries, slow dum biryani, crispy lollipops, or boneless fillets.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                4
              </div>
              <h3 className="font-bold text-sm text-[#38251F]">Inspected & Weighed Net</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                You pay for exact net meat weight after feather plucking and gutting. No hidden wastage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WhatsApp / Direct Call Order Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-[#D92332] to-[#b81d2a] rounded-3xl p-6 sm:p-10 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full text-white inline-block">
              Need Custom Butchering or Bulk Quantity?
            </span>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-black">
              Call Chandu Chicken Center Directly
            </h3>
            <p className="text-xs sm:text-sm text-red-100 max-w-lg">
              Have special cooking instructions or need 5kg+ for family gatherings, weddings, or catering? We carve on demand!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <a
              href={`tel:${settings?.shopPhone || '+919848022338'}`}
              className="w-full sm:w-auto px-6 py-3.5 bg-white text-[#D92332] font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:bg-stone-50 transition-all"
            >
              <Phone className="w-4 h-4" />
              <span>Call {settings?.shopPhone || '+91 98480 22338'}</span>
            </a>
            <a
              href={`https://wa.me/${(settings?.shopWhatsApp || '919848022338').replace(/\D/g, '')}?text=Hi%20Chandu%20Chicken%20Center,%20I%20want%20to%20order%20chicken`}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
