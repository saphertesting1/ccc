import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, 
  MapPin, 
  Phone, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  ShieldCheck, 
  Home, 
  Briefcase, 
  ArrowRight,
  ClipboardList,
  Save,
  X
} from 'lucide-react';

export interface SavedAddress {
  id: string;
  tag: 'Home' | 'Work' | 'Other';
  label: string;
  address: string;
  landmark?: string;
  isDefault: boolean;
}

export interface CustomerProfile {
  name: string;
  phone: string;
}

export default function AccountPage() {
  // Consumer Profile
  const [profile, setProfile] = useState<CustomerProfile>(() => {
    try {
      const saved = localStorage.getItem('ccc_customer_profile');
      return saved ? JSON.parse(saved) : { name: '', phone: '' };
    } catch {
      return { name: '', phone: '' };
    }
  });

  // Saved Addresses
  const [addresses, setAddresses] = useState<SavedAddress[]>(() => {
    try {
      const saved = localStorage.getItem('ccc_saved_addresses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(profile.name);
  const [profilePhone, setProfilePhone] = useState(profile.phone);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // Address Modal State
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Partial<SavedAddress> | null>(null);

  // Save profile to localStorage
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      name: profileName.trim(),
      phone: profilePhone.trim().replace(/[\s\-()]/g, '')
    };
    setProfile(updated);
    localStorage.setItem('ccc_customer_profile', JSON.stringify(updated));
    setIsEditingProfile(false);
    setProfileNotice('Profile information saved on this device!');
    setTimeout(() => setProfileNotice(null), 3000);
  };

  // Save addresses to localStorage
  const persistAddresses = (updated: SavedAddress[]) => {
    setAddresses(updated);
    localStorage.setItem('ccc_saved_addresses', JSON.stringify(updated));
  };

  const handleOpenNewAddress = () => {
    setEditingAddress({
      id: '',
      tag: 'Home',
      label: 'Home',
      address: '',
      landmark: '',
      isDefault: addresses.length === 0
    });
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr: SavedAddress) => {
    setEditingAddress({ ...addr });
    setIsAddressModalOpen(true);
  };

  const handleDeleteAddress = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this delivery address?')) return;
    const filtered = addresses.filter(a => a.id !== id);
    // If deleted address was default and other addresses remain, make first default
    if (filtered.length > 0 && !filtered.some(a => a.isDefault)) {
      filtered[0].isDefault = true;
    }
    persistAddresses(filtered);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddress || !editingAddress.address?.trim()) return;

    const id = editingAddress.id || `addr-${Date.now()}`;
    const newAddr: SavedAddress = {
      id,
      tag: editingAddress.tag || 'Home',
      label: editingAddress.label?.trim() || editingAddress.tag || 'Home',
      address: editingAddress.address.trim(),
      landmark: editingAddress.landmark?.trim() || '',
      isDefault: Boolean(editingAddress.isDefault)
    };

    let updatedList: SavedAddress[];
    if (newAddr.isDefault) {
      // Unset other defaults
      updatedList = addresses.map(a => ({ ...a, isDefault: false }));
    } else {
      updatedList = [...addresses];
    }

    const existingIndex = updatedList.findIndex(a => a.id === id);
    if (existingIndex >= 0) {
      updatedList[existingIndex] = newAddr;
    } else {
      updatedList.push(newAddr);
    }

    persistAddresses(updatedList);
    setIsAddressModalOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-28 md:pb-16">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#38251F]">
          My Account & Delivery Details
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          Save your contact phone and home addresses for 1-click ordering. No password or OTP required.
        </p>
      </div>

      {profileNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{profileNotice}</span>
        </div>
      )}

      {/* Guest Assurance Notice */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-amber-700" />
        </div>
        <div className="text-xs text-stone-700">
          <div className="font-bold text-[#38251F]">Instant Guest Account • Zero Login Required</div>
          <div>Your name, phone number, and delivery addresses are preserved locally on this device for effortless repeat ordering.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Personal Profile */}
        <div className="md:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#D92332]" />
                <h2 className="font-bold text-sm text-[#38251F]">Contact Profile</h2>
              </div>
              {!isEditingProfile && (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="text-xs font-bold text-[#D92332] hover:underline flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
              )}
            </div>

            {isEditingProfile ? (
              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Varma"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-semibold text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    Contact Mobile Number (10 Digits)
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9848012345"
                    value={profilePhone}
                    onChange={e => setProfilePhone(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-semibold text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileName(profile.name);
                      setProfilePhone(profile.phone);
                      setIsEditingProfile(false);
                    }}
                    className="px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold text-stone-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-[#D92332] hover:bg-[#b81d2a] text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Details
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Customer Name</span>
                  <span className="font-bold text-sm text-[#38251F]">
                    {profile.name || 'Not provided yet'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Mobile Number</span>
                  <span className="font-semibold text-stone-700 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    {profile.phone || 'Not provided yet'}
                  </span>
                </div>
                {!profile.name && (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="w-full mt-3 py-2 border border-dashed border-[#D92332] text-[#D92332] rounded-xl text-xs font-bold hover:bg-red-50/50 transition-colors"
                  >
                    + Add Name & Phone
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-2.5">
            <Link
              to="/orders"
              className="flex items-center justify-between p-3 rounded-xl bg-stone-50 hover:bg-amber-50/70 border border-stone-200/80 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-4 h-4 text-[#D92332]" />
                <span className="text-xs font-bold text-[#38251F]">My Order History</span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#D92332] transition-colors" />
            </Link>

            <Link
              to="/products"
              className="flex items-center justify-between p-3 rounded-xl bg-stone-50 hover:bg-amber-50/70 border border-stone-200/80 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Home className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-[#38251F]">Browse Farm Fresh Cuts</span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 transition-colors" />
            </Link>
          </div>
        </div>

        {/* Right Column: Saved Delivery Addresses */}
        <div className="md:col-span-7 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D92332]" />
                <h2 className="font-bold text-sm text-[#38251F]">Saved Delivery Addresses</h2>
              </div>
              <button
                onClick={handleOpenNewAddress}
                className="px-3 py-1.5 bg-[#D92332] hover:bg-[#b81d2a] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Address</span>
              </button>
            </div>

            {addresses.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500 border border-dashed border-stone-200 rounded-2xl space-y-2">
                <MapPin className="w-8 h-8 text-stone-300 mx-auto" />
                <p className="font-semibold text-stone-700">No saved addresses yet</p>
                <p className="text-[11px] text-stone-400 max-w-xs mx-auto">
                  Add your home or office address here so it auto-fills during checkout with 1 tap.
                </p>
                <button
                  onClick={handleOpenNewAddress}
                  className="px-4 py-2 bg-[#38251F] hover:bg-[#D92332] text-white text-xs font-bold rounded-xl transition-colors inline-block mt-2"
                >
                  + Add Your First Address
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map(addr => (
                  <div
                    key={addr.id}
                    className="p-4 rounded-2xl border border-stone-200 bg-stone-50/70 hover:bg-stone-50 transition-colors space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#38251F] text-xs px-2 py-0.5 rounded-md bg-stone-200/80">
                          {addr.label || addr.tag}
                        </span>
                        {addr.isDefault && (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                            Default
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditAddress(addr)}
                          className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="p-1 text-stone-400 hover:text-red-600 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-stone-800 font-medium leading-relaxed">
                      {addr.address}
                    </p>

                    {addr.landmark && (
                      <p className="text-[11px] text-stone-500">
                        Landmark: {addr.landmark}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Address Modal */}
      {isAddressModalOpen && editingAddress && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#FFF9F1] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-300 relative text-[#38251F] space-y-4">
            <button
              onClick={() => setIsAddressModalOpen(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-1 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-[#38251F]">
              {editingAddress.id ? 'Edit Delivery Address' : 'Add New Delivery Address'}
            </h3>

            <form onSubmit={handleSaveAddress} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  Address Label
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Home', 'Work', 'Other'] as const).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setEditingAddress({ ...editingAddress, tag, label: tag })}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        editingAddress.tag === tag
                          ? 'bg-[#38251F] text-amber-300 border-[#38251F]'
                          : 'bg-white text-stone-700 border-stone-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  Full Home / Office Address *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Flat/House No., Building Name, Street, Locality..."
                  value={editingAddress.address || ''}
                  onChange={e => setEditingAddress({ ...editingAddress, address: e.target.value })}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs font-medium text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  Nearby Landmark (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near Water Tank, Opposite Temple"
                  value={editingAddress.landmark || ''}
                  onChange={e => setEditingAddress({ ...editingAddress, landmark: e.target.value })}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs font-medium text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="defaultAddrCheck"
                  checked={editingAddress.isDefault || false}
                  onChange={e => setEditingAddress({ ...editingAddress, isDefault: e.target.checked })}
                  className="rounded text-[#D92332] focus:ring-[#D92332]"
                />
                <label htmlFor="defaultAddrCheck" className="text-xs font-medium text-stone-700 cursor-pointer">
                  Set as default delivery address
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-xl text-xs font-bold text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#D92332] hover:bg-[#b81d2a] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
