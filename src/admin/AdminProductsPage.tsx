import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Upload, 
  Check, 
  X, 
  AlertCircle, 
  Search, 
  Sparkles,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { Product, WeightUnit, WeightOption } from '../types/index.js';
import { api } from '../services/api.js';
import { useShop } from '../context/ShopContext.js';

const CANONICAL_WEIGHTS: WeightUnit[] = ['250g', '500g', '1kg'];

export default function AdminProductsPage() {
  const { categories, refreshShopData } = useShop();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);

  // Weight pack prices and stock states for the modal
  const [priceInputs, setPriceInputs] = useState<Record<WeightUnit, string>>({
    '250g': '',
    '500g': '',
    '1kg': ''
  });
  const [stockStates, setStockStates] = useState<Record<WeightUnit, boolean>>({
    '250g': true,
    '500g': true,
    '1kg': true
  });

  // In-app delete confirmation state
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAdminProducts(searchQuery);
      setProducts(data);
    } catch (e: any) {
      console.error('Failed to load admin products:', e);
      setActionError(e.message || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [searchQuery]);

  const handleToggleProductStock = async (product: Product) => {
    try {
      setActionError(null);
      await api.toggleProductStock(product.id, !product.isAvailable);
      await loadProducts();
      await refreshShopData();
      setActionSuccess(`Stock status updated for ${product.name}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (e: any) {
      setActionError(e.message || 'Failed to update stock');
    }
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      setIsDeleting(true);
      setActionError(null);
      await api.deleteProduct(productToDelete.id);
      setProductToDelete(null);
      await loadProducts();
      await refreshShopData();
      setActionSuccess('Product removed successfully. Historical order records remain intact.');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (e: any) {
      setProductToDelete(null);
      setActionError(e.message || 'Failed to delete product from database');
      await loadProducts();
    } finally {
      setIsDeleting(false);
    }
  };

  const openCreateModal = () => {
    const defaultCategory = categories[0]?.id || 'cat-fresh-cuts';
    setEditingProduct({
      id: '',
      name: '',
      categoryId: defaultCategory,
      description: '',
      imageUrl: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80',
      badge: 'Farm Fresh',
      cutOptions: ['Curry Cut', 'Biryani Cut', 'Small Pieces'],
      weights: [
        { weight: '250g', price: 65, inStock: true },
        { weight: '500g', price: 125, inStock: true },
        { weight: '1kg', price: 240, inStock: true }
      ],
      isAvailable: true,
      isFeatured: false,
      netWeightDescription: 'Cleaned net meat weight'
    });
    setPriceInputs({
      '250g': '65',
      '500g': '125',
      '1kg': '240'
    });
    setStockStates({
      '250g': true,
      '500g': true,
      '1kg': true
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    const initialPrices: Record<WeightUnit, string> = { '250g': '', '500g': '', '1kg': '' };
    const initialStocks: Record<WeightUnit, boolean> = { '250g': true, '500g': true, '1kg': true };

    const weightsList = Array.isArray(p.weights) ? p.weights : [];
    CANONICAL_WEIGHTS.forEach(w => {
      const found = weightsList.find(item => item.weight === w);
      if (found) {
        initialPrices[w] = typeof found.price === 'number' && found.price > 0 
          ? String(found.price) 
          : (found.price !== undefined && found.price !== null && String(found.price) !== '0' ? String(found.price) : '');
        initialStocks[w] = found.inStock !== false;
      } else {
        initialPrices[w] = '';
        initialStocks[w] = true;
      }
    });

    setEditingProduct({ ...p });
    setPriceInputs(initialPrices);
    setStockStates(initialStocks);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    try {
      setImageUploadLoading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string;
          const uploadedUrl = await api.uploadImage(base64, file.type, file.name);
          setEditingProduct(prev => prev ? { ...prev, imageUrl: uploadedUrl } : null);
        } catch (err: any) {
          alert(err.message || 'Image upload failed');
        } finally {
          setImageUploadLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setImageUploadLoading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setErrorMessage(null);

    const name = editingProduct.name?.trim();
    if (!name) {
      setErrorMessage('Please enter a product name.');
      return;
    }

    // Assemble configured weights: only include weights where a valid price has been entered
    const configuredWeights: WeightOption[] = [];

    for (const w of CANONICAL_WEIGHTS) {
      const priceStr = priceInputs[w]?.trim();
      if (priceStr && priceStr !== '') {
        const numPrice = parseInt(priceStr, 10);
        if (isNaN(numPrice) || numPrice <= 0) {
          setErrorMessage(`Please enter a valid price in rupees (greater than ₹0) for the ${w} pack, or leave the box empty if not offered.`);
          return;
        }
        configuredWeights.push({
          weight: w,
          price: numPrice,
          inStock: stockStates[w] !== false
        });
      }
    }

    if (configuredWeights.length === 0) {
      setErrorMessage('Please configure a valid selling price for at least one weight pack (250g, 500g, or 1kg).');
      return;
    }

    try {
      setSaveLoading(true);
      await api.saveProduct({
        ...editingProduct,
        name,
        weights: configuredWeights
      });
      setIsModalOpen(false);
      await loadProducts();
      await refreshShopData();
      setActionSuccess(`Product "${name}" saved successfully with ${configuredWeights.length} weight option(s).`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save product to database');
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePriceChange = (weight: WeightUnit, val: string) => {
    // Keep raw string allowing empty string or whole numbers
    const cleanDigits = val.replace(/[^0-9]/g, '');
    setPriceInputs(prev => ({
      ...prev,
      [weight]: cleanDigits
    }));
  };

  const handleWeightStockToggle = (weight: WeightUnit) => {
    setStockStates(prev => ({
      ...prev,
      [weight]: !prev[weight]
    }));
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#38251F]">
            Product Management
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Add, edit, change prices, update photos, and toggle stock availability across web and mobile.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/categories"
            className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <Layers className="w-4 h-4 text-amber-700" />
            <span>Manage Categories</span>
          </Link>

          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-[#D92332] hover:bg-[#b81d2a] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="relative">
          <input
            type="text"
            placeholder="Search products by cut name, category, or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
          />
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Products Table (Desktop & Tablet) / Mobile Cards View */}
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-2xs overflow-hidden">
        {/* Mobile View (< md) */}
        <div className="md:hidden divide-y divide-stone-100">
          {isLoading ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D92332]" />
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs px-4">
              No products found. Click "Add Product" to add a new fresh poultry cut.
            </div>
          ) : (
            products.map(p => (
              <div key={p.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-16 h-16 rounded-xl object-cover bg-stone-100 shrink-0 border border-stone-200"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#38251F] text-sm truncate">{p.name}</div>
                    <div className="text-[11px] text-stone-500 font-medium">{p.categoryName || p.categoryId}</div>
                    {p.badge && (
                      <span className="inline-block mt-1 text-[10px] font-bold text-[#D92332] bg-red-50 px-1.5 py-0.5 rounded">
                        {p.badge}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {p.weights.map(w => (
                    <span
                      key={w.weight}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        w.inStock
                          ? 'bg-stone-100 text-[#38251F] border border-stone-200'
                          : 'bg-red-50 text-red-500 line-through border border-red-100'
                      }`}
                    >
                      {w.weight}: ₹{w.price}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                  <button
                    onClick={() => handleToggleProductStock(p)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                      p.isAvailable
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {p.isAvailable ? '● Available' : '○ Unavailable'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(p)}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-lg flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setProductToDelete(p)}
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Product</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Weights & Prices</th>
                <th className="py-3.5 px-4">Availability</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400">
                    No products found. Click "Add Product" to create one.
                  </td>
                </tr>
              ) : (
                products.map(p => (
                  <tr key={p.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-12 h-12 rounded-xl object-cover bg-stone-100 shrink-0 border border-stone-200"
                        />
                        <div>
                          <div className="font-bold text-[#38251F] text-sm flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {p.isFeatured && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 shrink-0" title="Featured on Homepage">
                                Home
                              </span>
                            )}
                          </div>
                          {p.badge && (
                            <span className="text-[10px] font-bold text-[#D92332] bg-red-50 px-1.5 py-0.5 rounded">
                              {p.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-stone-700">
                      {p.categoryName || p.categoryId}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {p.weights.map(w => (
                          <span
                            key={w.weight}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              w.inStock
                                ? 'bg-stone-100 text-[#38251F] border border-stone-200'
                                : 'bg-red-50 text-red-500 line-through border border-red-100'
                            }`}
                          >
                            {w.weight}: ₹{w.price}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleProductStock(p)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                          p.isAvailable
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {p.isAvailable ? 'In Stock (Available)' : 'Unavailable (Sold Out)'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                        title="Edit Product"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setProductToDelete(p)}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Add / Edit Product Modal */}
      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#FFF9F1] rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-stone-300 relative text-[#38251F] my-6 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="text-lg font-black text-[#38251F]">
                {editingProduct.id ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              {/* 1. Product Name */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full p-3 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-hidden focus:border-[#D92332]"
                  placeholder="e.g. Fresh Chicken Curry Cut (Skinless)"
                />
              </div>

              {/* Category (Preserved for backend integration) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Category
                </label>
                <select
                  value={editingProduct.categoryId || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#D92332]"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* 2. Product Photo */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-3">
                <label className="block text-xs font-bold text-stone-700">
                  Product Photo <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                    <img
                      src={editingProduct.imageUrl || ''}
                      alt="Product preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <input
                      type="text"
                      placeholder="Image URL or upload a file..."
                      value={editingProduct.imageUrl || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                      className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                    />
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{imageUploadLoading ? 'Uploading...' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* 3. Available Weights or Units & 4. Price for each weight */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700">
                    Available Weights & Prices (₹ INR) <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[11px] text-stone-500">
                    Enter selling price in Indian Rupees and toggle stock status for each pack size.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {CANONICAL_WEIGHTS.map(weight => {
                    const priceVal = priceInputs[weight] ?? '';
                    const inStock = stockStates[weight] !== false;

                    return (
                      <div key={weight} className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                        <div className="flex items-center justify-between font-bold text-stone-800 text-xs">
                          <span>{weight} Pack</span>
                          <button
                            type="button"
                            onClick={() => handleWeightStockToggle(weight)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              inStock ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-red-100 text-red-800 hover:bg-red-200'
                            }`}
                          >
                            {inStock ? 'In Stock' : 'Out of Stock'}
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">₹</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0"
                            value={priceVal}
                            onChange={e => handlePriceChange(weight, e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-[#D92332] focus:outline-hidden focus:border-[#D92332] focus:ring-1 focus:ring-[#D92332]"
                          />
                        </div>
                        <div className="text-[10px] text-stone-400 text-right">
                          {priceVal && parseInt(priceVal, 10) > 0 ? (
                            <span className="text-emerald-700 font-semibold">₹{parseInt(priceVal, 10)} / pack</span>
                          ) : (
                            <span>Leave empty if not offered</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. Product Availability */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-stone-800">Product Availability</div>
                  <div className="text-[11px] text-stone-500">
                    {editingProduct.isAvailable
                      ? 'Available: Visible to customers for online order.'
                      : 'Unavailable: Hidden from customer catalog without deleting history.'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingProduct({ ...editingProduct, isAvailable: !editingProduct.isAvailable })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    editingProduct.isAvailable
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}
                >
                  {editingProduct.isAvailable ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Active</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span>Deactivated</span>
                    </>
                  )}
                </button>
              </div>

              {/* 6. Feature on Homepage Toggle */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-stone-800">Feature on Homepage</div>
                  <div className="text-[11px] text-stone-500">
                    {editingProduct.isFeatured
                      ? 'Featured: Displayed on the homepage "Today\'s Fresh Cuts" showcase.'
                      : 'Standard: Displayed in the full product catalog only.'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingProduct({ ...editingProduct, isFeatured: !editingProduct.isFeatured })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    editingProduct.isFeatured
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-stone-100 text-stone-600 border border-stone-200 hover:bg-stone-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>{editingProduct.isFeatured ? 'Featured on Home' : 'Standard Catalog'}</span>
                </button>
              </div>

              {/* Description & Badge (Optional clean fields) */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Product Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={editingProduct.description || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#D92332]"
                    placeholder="e.g. Tender cuts suitable for curries and dum biryani..."
                  />
                </div>
              </div>

              {/* Action Buttons: Save Changes & Cancel */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-6 py-2.5 rounded-xl bg-[#D92332] hover:bg-[#b81d2a] text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {saveLoading ? 'Saving Changes...' : editingProduct.id ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#FFF9F1] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-300 relative text-[#38251F] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#38251F]">Delete Chicken Product</h3>
                <p className="text-xs text-stone-500">This action will remove the item from the live shop catalog.</p>
              </div>
            </div>

            <p className="text-xs text-stone-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
              Are you sure you want to remove <strong>"{productToDelete.name}"</strong>? Past customer orders and historical reports referencing this cut will remain completely safe.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 border border-stone-300 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteProduct}
                className="px-5 py-2 bg-[#D92332] hover:bg-[#b81d2a] text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
