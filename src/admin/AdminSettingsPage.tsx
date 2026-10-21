import { useState, useEffect } from 'react';
import { 
  Settings, 
  Store, 
  Clock, 
  Truck, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Save,
  Power
} from 'lucide-react';
import { useShop } from '../context/ShopContext.js';
import { api } from '../services/api.js';
import { ShopSettings } from '../types/index.js';

export default function AdminSettingsPage() {
  const { settings, refreshShopData } = useShop();
  const [formData, setFormData] = useState<Partial<ShopSettings>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData({ ...settings });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await api.updateSettings(formData);
      await refreshShopData();
      setSuccessMessage('Shop settings and delivery configurations updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-2xs">
        <h1 className="text-xl sm:text-2xl font-black text-[#38251F]">
          Shop Details & Operational Configuration
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">
          Configure operating hours, delivery charges, free delivery thresholds, and contact numbers.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store Open / Closed Status Master Switch */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-[#38251F] flex items-center gap-2">
            <Power className="w-4 h-4 text-[#D92332]" />
            <span>Store Master Switch</span>
          </h2>

          <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-200">
            <div>
              <div className="font-bold text-xs text-[#38251F]">
                Accept Online Orders
              </div>
              <div className="text-[11px] text-stone-500">
                When turned off, customers will see that the shop is closed and cannot place new orders.
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isOpen ?? true}
                onChange={e => setFormData({ ...formData, isOpen: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* Shop Contact & Address */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#38251F] flex items-center gap-2">
            <Store className="w-4 h-4 text-[#D92332]" />
            <span>Shop Identity & Customer Contact</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Shop Name
              </label>
              <input
                type="text"
                value={formData.shopName || ''}
                onChange={e => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Tagline
              </label>
              <input
                type="text"
                value={formData.tagline || ''}
                onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Call Phone Number
              </label>
              <input
                type="text"
                value={formData.shopPhone || ''}
                onChange={e => setFormData({ ...formData, shopPhone: e.target.value })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                WhatsApp Number (for direct order queries)
              </label>
              <input
                type="text"
                value={formData.shopWhatsApp || ''}
                onChange={e => setFormData({ ...formData, shopWhatsApp: e.target.value })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Shop Physical Address
            </label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Landmark
              </label>
              <input
                type="text"
                value={formData.landmark || ''}
                onChange={e => setFormData({ ...formData, landmark: e.target.value })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                City / Locality
              </label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium"
              />
            </div>
          </div>
        </div>

        {/* Operating Hours & Delivery Rules */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#38251F] flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>Delivery Fees & Operational Rules</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Opens At
              </label>
              <input
                type="text"
                value={formData.openTime || '07:00 AM'}
                onChange={e => setFormData({ ...formData, openTime: e.target.value })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Closes At
              </label>
              <input
                type="text"
                value={formData.closeTime || '09:00 PM'}
                onChange={e => setFormData({ ...formData, closeTime: e.target.value })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Delivery Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                value={formData.deliveryFee ?? 30}
                onChange={e => setFormData({ ...formData, deliveryFee: parseFloat(e.target.value) || 0 })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Free Delivery Above (₹)
              </label>
              <input
                type="number"
                min="0"
                value={formData.freeDeliveryThreshold ?? 499}
                onChange={e => setFormData({ ...formData, freeDeliveryThreshold: parseFloat(e.target.value) || 0 })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold text-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Minimum Order Amount (₹)
              </label>
              <input
                type="number"
                min="0"
                value={formData.minOrderAmount ?? 0}
                onChange={e => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  setFormData({ ...formData, minOrderAmount: isNaN(val) ? 0 : Math.max(0, val) });
                }}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Est. Delivery Time (Minutes)
              </label>
              <input
                type="number"
                min="10"
                value={formData.deliveryTimeEstimateMins ?? 45}
                onChange={e => setFormData({ ...formData, deliveryTimeEstimateMins: parseInt(e.target.value) || 45 })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Top Announcement Banner Message
            </label>
            <input
              type="text"
              value={formData.announcementBanner || ''}
              onChange={e => setFormData({ ...formData, announcementBanner: e.target.value })}
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium"
              placeholder="e.g. ⚡ Fast delivery in 45 minutes! 100% RO Water Cleaned Tender Chicken."
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 rounded-xl bg-[#D92332] hover:bg-[#b81d2a] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Updating...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
