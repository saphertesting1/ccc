import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, AlertCircle, X, Sparkles, RefreshCw } from 'lucide-react';
import { useShop } from '../context/ShopContext.js';
import ProductCard from '../components/ProductCard.js';

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { products, isLoading, refreshShopData } = useShop();

  const searchParam = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState<string>(searchParam);
  const [inStockOnly, setInStockOnly] = useState(false);

  // Revalidate fresh catalog on mount
  useEffect(() => {
    refreshShopData();
  }, [refreshShopData]);

  useEffect(() => {
    setSearchInput(searchParams.get('search') || '');
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      newParams.set('search', searchInput.trim());
    } else {
      newParams.delete('search');
    }
    setSearchParams(newParams);
  };

  const clearSearch = () => {
    setSearchInput('');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    setSearchParams(newParams);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Search filter
      if (searchInput.trim()) {
        const q = searchInput.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      // Stock filter
      if (inStockOnly && !p.isAvailable) {
        return false;
      }
      return true;
    });
  }, [products, searchInput, inStockOnly]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1 text-xs font-bold text-[#D92332] uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Farm Fresh Poultry Menu</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#38251F]">
            Fresh Chicken Products
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Browse our fresh daily poultry cuts. Select customized pack weights (250g, 500g, 1kg) and butcher cut styles.
          </p>
        </div>

        <button
          onClick={() => refreshShopData(true)}
          className="self-start sm:self-auto px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
          title="Refresh products from store"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & In-Stock Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <input
            type="text"
            placeholder="Search chicken cuts, biryani cuts, boneless, breast, legs..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-16 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332] transition-colors"
          />
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#D92332] hover:bg-[#b81d2a] text-white text-xs font-bold rounded-lg transition-colors"
          >
            Go
          </button>
        </form>

        {/* Quick In-Stock Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-700 select-none bg-stone-50 px-3.5 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-100 transition-colors">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={e => setInStockOnly(e.target.checked)}
              className="rounded text-[#D92332] focus:ring-[#D92332]"
            />
            <span>In Stock Only</span>
          </label>
        </div>
      </div>

      {/* Available Products Count Bar */}
      <div className="flex items-center justify-between text-xs text-stone-500 font-medium px-1">
        <span>Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}</span>
        {inStockOnly && <span className="text-emerald-700 font-semibold">• Showing only available cuts</span>}
      </div>

      {/* Product Grid */}
      {isLoading && products.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="bg-white rounded-2xl h-84 animate-pulse border border-stone-200" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-50 text-[#D92332] flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#38251F]">No chicken products found</h3>
          <p className="text-xs text-stone-500">
            {searchInput ? `No products match "${searchInput}". Try another search term.` : 'No products currently available.'}
          </p>
          <button
            onClick={() => {
              clearSearch();
              setInStockOnly(false);
            }}
            className="px-4 py-2 bg-[#D92332] text-white text-xs font-bold rounded-xl hover:bg-[#b81d2a] transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
