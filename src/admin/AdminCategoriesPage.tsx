import { useState } from 'react';
import { Plus, Edit, Trash2, X, AlertCircle } from 'lucide-react';
import { useShop } from '../context/ShopContext.js';
import { api } from '../services/api.js';
import { Category } from '../types/index.js';

export default function AdminCategoriesPage() {
  const { categories, refreshShopData } = useShop();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingCategory({
      id: '',
      name: '',
      slug: '',
      description: '',
      imageUrl: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80',
      displayOrder: categories.length + 1
    });
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory({ ...cat });
    setError(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await api.deleteCategory(id);
      await refreshShopData();
    } catch (e: any) {
      alert(e.message || 'Failed to delete category');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.name) {
      setError('Category name is required.');
      return;
    }

    try {
      setIsSaving(true);
      await api.saveCategory(editingCategory);
      setIsModalOpen(false);
      await refreshShopData();
    } catch (e: any) {
      setError(e.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200/80 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#38251F]">
            Poultry Categories
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Organize customer catalog by cuts, cooking methods, or specialty desi poultry.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-[#D92332] hover:bg-[#b81d2a] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => (
          <div
            key={cat.id}
            className="bg-white p-5 rounded-3xl border border-stone-200 shadow-2xs flex flex-col justify-between space-y-4"
          >
            <div className="flex gap-4 items-center">
              <img
                src={cat.imageUrl}
                alt={cat.name}
                className="w-16 h-16 rounded-2xl object-cover bg-stone-100 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                  Order #{cat.displayOrder}
                </span>
                <h3 className="font-bold text-sm text-[#38251F] truncate mt-0.5">
                  {cat.name}
                </h3>
                <p className="text-[11px] text-stone-500 line-clamp-2 mt-0.5">
                  {cat.description}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                onClick={() => openEditModal(cat)}
                className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => handleDelete(cat.id)}
                className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#FFF9F1] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-300 relative text-[#38251F] space-y-4">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-1 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-[#38251F]">
              {editingCategory.id ? 'Edit Category' : 'Create Category'}
            </h3>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingCategory.name || ''}
                  onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs"
                  placeholder="e.g. Biryani & Curry Cuts"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editingCategory.description || ''}
                  onChange={e => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Image URL
                </label>
                <input
                  type="text"
                  value={editingCategory.imageUrl || ''}
                  onChange={e => setEditingCategory({ ...editingCategory, imageUrl: e.target.value })}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={editingCategory.displayOrder || 1}
                  onChange={e => setEditingCategory({ ...editingCategory, displayOrder: parseInt(e.target.value) || 1 })}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-xl text-xs font-bold text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#D92332] text-white rounded-xl text-xs font-bold shadow-md"
                >
                  {isSaving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
