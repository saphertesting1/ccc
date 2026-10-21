import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ShieldCheck, 
  Droplets, 
  Clock, 
  Check, 
  AlertCircle,
  ChefHat
} from 'lucide-react';
import { Product, WeightUnit } from '../types/index.js';
import { api } from '../services/api.js';
import { useCart } from '../context/CartContext.js';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedWeight, setSelectedWeight] = useState<WeightUnit>('500g');
  const [selectedCut, setSelectedCut] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [addedNotice, setAddedNotice] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      if (!id) return;
      try {
        setIsLoading(true);
        const data = await api.getProductById(id);
        setProduct(data);
        const defaultW = data.weights.find(w => w.inStock)?.weight || data.weights[0]?.weight || '500g';
        setSelectedWeight(defaultW);
        setSelectedCut(data.cutOptions[0] || 'Standard Cut');
      } catch (err: any) {
        setError(err.message || 'Product not found');
      } finally {
        setIsLoading(false);
      }
    }
    loadProduct();
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center items-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-[#D92332] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 text-[#D92332] flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#38251F]">Product Not Found</h2>
        <p className="text-xs text-stone-500">The requested chicken cut could not be retrieved from the catalog.</p>
        <button
          onClick={() => navigate('/products')}
          className="px-5 py-2.5 bg-[#D92332] text-white text-xs font-bold rounded-xl"
        >
          Return to Fresh Cuts
        </button>
      </div>
    );
  }

  const currentWeightOpt = product.weights.find(w => w.weight === selectedWeight) || product.weights[0];
  const unitPrice = currentWeightOpt ? currentWeightOpt.price : 0;
  const totalPrice = unitPrice * quantity;
  const isOutOfStock = !product.isAvailable || (currentWeightOpt && !currentWeightOpt.inStock);

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addItem(product, selectedWeight, selectedCut, quantity);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb & Back */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-[#D92332] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Cuts</span>
      </button>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: Image Gallery */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative aspect-4/3 w-full rounded-3xl overflow-hidden bg-stone-100 border border-stone-200 shadow-md">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80';
              }}
            />
            {product.badge && (
              <span className="absolute top-4 left-4 bg-[#D92332] text-white text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-md">
                {product.badge}
              </span>
            )}
            {isOutOfStock && (
              <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
                <span className="bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Sold Out for Today
                </span>
              </div>
            )}
          </div>

          {/* Hygiene Badges Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-2xl border border-stone-200 text-center space-y-1">
              <ShieldCheck className="w-5 h-5 text-emerald-600 mx-auto" />
              <div className="text-[11px] font-bold text-[#38251F]">100% Halal</div>
              <div className="text-[9px] text-stone-500">Sharia compliant</div>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-stone-200 text-center space-y-1">
              <Droplets className="w-5 h-5 text-cyan-600 mx-auto" />
              <div className="text-[11px] font-bold text-[#38251F]">RO Washed</div>
              <div className="text-[9px] text-stone-500">No raw smell</div>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-stone-200 text-center space-y-1">
              <Clock className="w-5 h-5 text-amber-600 mx-auto" />
              <div className="text-[11px] font-bold text-[#38251F]">45m Delivery</div>
              <div className="text-[9px] text-stone-500">Fresh from knife</div>
            </div>
          </div>
        </div>

        {/* Right Column: Configuration & Add to Cart */}
        <div className="lg:col-span-6 space-y-6">
          <div>
            {product.categoryName && (
              <span className="text-xs font-bold text-[#D92332] uppercase tracking-wider">
                {product.categoryName}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-black text-[#38251F] mt-1">
              {product.name}
            </h1>
            <p className="text-stone-600 text-sm mt-3 leading-relaxed">
              {product.description}
            </p>
            {product.netWeightDescription && (
              <p className="text-xs text-emerald-700 font-medium mt-2 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{product.netWeightDescription}</span>
              </p>
            )}
          </div>

          {/* Weight Selection (250g, 500g, 1kg) */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-stone-700">
              <span>Choose Weight Pack:</span>
              <span className="text-[#D92332] font-extrabold">{selectedWeight} (₹{unitPrice})</span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {product.weights.map(w => {
                const isSelected = selectedWeight === w.weight;
                return (
                  <button
                    key={w.weight}
                    type="button"
                    disabled={!w.inStock || !product.isAvailable}
                    onClick={() => setSelectedWeight(w.weight)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-[#38251F] text-amber-300 border-[#38251F] shadow-sm'
                        : w.inStock
                        ? 'bg-stone-50 text-stone-800 border-stone-200 hover:border-stone-400'
                        : 'bg-stone-100 text-stone-400 border-stone-100 line-through cursor-not-allowed'
                    }`}
                  >
                    <div className="text-sm font-extrabold">{w.weight}</div>
                    <div className="text-xs font-semibold mt-0.5 opacity-90">₹{w.price}</div>
                    {!w.inStock && (
                      <div className="text-[9px] text-red-500 font-bold mt-1">Sold out</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Butcher Cutting Style Preference */}
          {product.cutOptions && product.cutOptions.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-2">
              <label className="block text-xs font-bold text-stone-700">
                Custom Butchering Style:
              </label>
              <div className="space-y-2">
                {product.cutOptions.map(cut => {
                  const isCutSelected = selectedCut === cut;
                  return (
                    <label
                      key={cut}
                      onClick={() => setSelectedCut(cut)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all text-xs font-medium ${
                        isCutSelected
                          ? 'bg-red-50/60 border-[#D92332] text-[#38251F] font-bold'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <span>{cut}</span>
                      <input
                        type="radio"
                        name="cutOption"
                        value={cut}
                        checked={isCutSelected}
                        onChange={() => setSelectedCut(cut)}
                        className="text-[#D92332] focus:ring-[#D92332]"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity Stepper & Add to Cart Action */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-stone-500 block">Total Price:</span>
                <span className="text-2xl font-black text-[#D92332]">₹{totalPrice}</span>
              </div>

              {/* Quantity selector */}
              <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-bold text-stone-700 hover:text-red-600 shadow-2xs"
                  aria-label="Decrease"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-bold text-sm text-[#38251F]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-bold text-stone-700 hover:text-emerald-600 shadow-2xs"
                  aria-label="Increase"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={isOutOfStock}
              onClick={handleAddToCart}
              className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98] ${
                isOutOfStock
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  : addedNotice
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#D92332] hover:bg-[#b81d2a] text-white'
              }`}
            >
              {addedNotice ? (
                <>
                  <Check className="w-4 h-4" /> Added to Fresh Cart!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" /> Add {quantity} × {selectedWeight} to Cart • ₹{totalPrice}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cooking & Recipe Tips Section */}
      <section className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-[#D92332]">
          <ChefHat className="w-5 h-5" />
          <h3 className="font-bold text-base text-[#38251F]">
            Butcher's Cooking Recommendation
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
          Because Chandu Chicken Center delivers completely fresh meat (not refrigerated for days), the chicken releases natural juices quickly. 
          For curries, cook on medium flame with a spoonful of cold-pressed oil and roasted spices. Marinate with crushed ginger-garlic paste and salt for 15 minutes before cooking for maximum tenderness.
        </p>
      </section>
    </div>
  );
}
