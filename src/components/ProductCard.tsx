import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, Check, AlertCircle } from 'lucide-react';
import { Product, WeightUnit } from '../types/index.js';
import { useCart } from '../context/CartContext.js';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { cart, addItem, updateQuantity } = useCart();

  // Find default weight
  const defaultWeight = product.weights.find(w => w.inStock)?.weight || product.weights[0]?.weight || '500g';
  const [selectedWeight, setSelectedWeight] = useState<WeightUnit>(defaultWeight);
  const [selectedCut, setSelectedCut] = useState<string>(product.cutOptions[0] || 'Standard Cut');
  const [justAdded, setJustAdded] = useState(false);

  const currentWeightOpt = product.weights.find(w => w.weight === selectedWeight) || product.weights[0];
  const price = currentWeightOpt ? currentWeightOpt.price : 0;
  const isOutOfStock = !product.isAvailable || (currentWeightOpt && !currentWeightOpt.inStock);

  // Check if this exact variation is in the cart
  const cartItemId = `${product.id}_${selectedWeight}_${selectedCut.replace(/\s+/g, '-')}`;
  const existingCartItem = cart.find(item => item.cartItemId === cartItemId);

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addItem(product, selectedWeight, selectedCut, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col group">
      {/* Product Image & Badges */}
      <div className="relative aspect-4/3 w-full bg-stone-100 overflow-hidden">
        <Link to={`/products/${product.id}`} className="block w-full h-full">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80';
            }}
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
          {product.badge && (
            <span className="bg-[#D92332] text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
              {product.badge}
            </span>
          )}
          {product.categoryName && (
            <span className="bg-[#38251F]/80 backdrop-blur-xs text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
              {product.categoryName}
            </span>
          )}
        </div>

        {/* Stock Status Badge */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-2xs flex items-center justify-center p-2">
            <span className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Sold Out for Today
            </span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <Link to={`/products/${product.id}`}>
            <h3 className="font-bold text-[#38251F] text-base hover:text-[#D92332] transition-colors line-clamp-1 mb-1">
              {product.name}
            </h3>
          </Link>
          <p className="text-xs text-stone-500 line-clamp-2 mb-3 leading-relaxed">
            {product.description}
          </p>

          {/* Weight Variant Selector (250g, 500g, 1kg) */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 mb-1.5">
              <span>Select Pack Weight:</span>
              <span className="text-[#38251F] font-semibold">{selectedWeight}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {product.weights.map(w => {
                const isSelected = selectedWeight === w.weight;
                return (
                  <button
                    key={w.weight}
                    type="button"
                    disabled={!w.inStock || !product.isAvailable}
                    onClick={() => setSelectedWeight(w.weight)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center border ${
                      isSelected
                        ? 'bg-[#38251F] text-amber-300 border-[#38251F] shadow-xs'
                        : w.inStock
                        ? 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-400'
                        : 'bg-stone-100 text-stone-400 border-stone-100 line-through cursor-not-allowed'
                    }`}
                  >
                    <span>{w.weight}</span>
                    <span className="block text-[10px] font-normal opacity-90">₹{w.price}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cut Preference Selector */}
          {product.cutOptions && product.cutOptions.length > 0 && (
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-stone-500 mb-1">
                Butcher Cut Style:
              </label>
              <select
                value={selectedCut}
                onChange={e => setSelectedCut(e.target.value)}
                className="w-full text-xs font-medium bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 focus:outline-hidden focus:border-[#D92332]"
              >
                {product.cutOptions.map(cut => (
                  <option key={cut} value={cut}>
                    {cut}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Pricing & Add to Cart */}
        <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-[#D92332]">₹{price}</span>
              <span className="text-[11px] text-stone-400 font-medium">/{selectedWeight}</span>
            </div>
            {product.netWeightDescription && (
              <span className="text-[10px] text-emerald-700 block font-medium">
                Cleaned net weight
              </span>
            )}
          </div>

          <div>
            {existingCartItem ? (
              <div className="flex items-center gap-1.5 bg-[#38251F] text-white rounded-xl p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => updateQuantity(existingCartItem.cartItemId, existingCartItem.quantity - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-stone-700 hover:bg-[#D92332] text-white transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-bold px-2 text-amber-300">
                  {existingCartItem.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(existingCartItem.cartItemId, existingCartItem.quantity + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-stone-700 hover:bg-[#D92332] text-white transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleAddToCart}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                  isOutOfStock
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    : justAdded
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#D92332] text-white hover:bg-[#b81d2a]'
                }`}
              >
                {justAdded ? (
                  <>
                    <Check className="w-4 h-4" /> Added
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Add to Cart
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
