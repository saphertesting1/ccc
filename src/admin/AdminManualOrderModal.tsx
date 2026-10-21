import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  Phone, 
  MapPin, 
  User, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Sparkles,
  Receipt
} from 'lucide-react';
import { Product, WeightUnit, PaymentMethod, PaymentStatus, OrderStatus, Order } from '../types/index.js';
import { api } from '../services/api.js';

interface AdminManualOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (order: Order) => void;
}

interface DraftOrderItem {
  id: string;
  productId: string;
  productName: string;
  weight: WeightUnit;
  cutPreference: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

const COMMON_CUT_PREFERENCES = [
  'Standard Curry Cut (12-16 pcs/kg)',
  'Large Biryani Cut (8-10 pcs/kg)',
  'Small Curry Cut (16-20 pcs/kg)',
  'Boneless Cubes',
  'Whole Cleaned Chicken',
  'Skinless Cut',
  'With Skin Cut'
];

export default function AdminManualOrderModal({ isOpen, onClose, onOrderCreated }: AdminManualOrderModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Customer Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderType, setOrderType] = useState<'Walk-in' | 'Phone Order' | 'Home Delivery'>('Walk-in');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [notes, setNotes] = useState('');

  // Payment & Status State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Paid');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('Accepted');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);

  // Item Draft Picker State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedWeight, setSelectedWeight] = useState<WeightUnit>('1kg');
  const [selectedCut, setSelectedCut] = useState<string>(COMMON_CUT_PREFERENCES[0]);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);

  // Added Items List
  const [items, setItems] = useState<DraftOrderItem[]>([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    async function loadCatalog() {
      try {
        setIsLoadingProducts(true);
        const prods = await api.getAdminProducts();
        setProducts(prods);
        if (prods.length > 0) {
          const first = prods[0];
          setSelectedProductId(first.id);
          const weightOpt = first.weights[0];
          if (weightOpt) {
            setSelectedWeight(weightOpt.weight);
            setUnitPrice(weightOpt.price);
          }
        }
      } catch (err) {
        console.error('Failed to load products for manual order modal:', err);
      } finally {
        setIsLoadingProducts(false);
      }
    }
    loadCatalog();
  }, [isOpen]);

  // When selected product or weight changes, update unitPrice default
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find(p => p.id === productId);
    if (prod) {
      const weightOpt = prod.weights.find(w => w.weight === selectedWeight) || prod.weights[0];
      if (weightOpt) {
        setSelectedWeight(weightOpt.weight);
        setUnitPrice(weightOpt.price);
      }
    }
  };

  const handleWeightChange = (weight: WeightUnit) => {
    setSelectedWeight(weight);
    const prod = products.find(p => p.id === selectedProductId);
    if (prod) {
      const weightOpt = prod.weights.find(w => w.weight === weight);
      if (weightOpt) {
        setUnitPrice(weightOpt.price);
      }
    }
  };

  // Add Item to Order
  const handleAddItem = () => {
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    if (quantity < 1) {
      setErrorMessage('Quantity must be at least 1');
      return;
    }

    const newItem: DraftOrderItem = {
      id: `${Date.now()}_${Math.random()}`,
      productId: prod.id,
      productName: prod.name,
      weight: selectedWeight,
      cutPreference: selectedCut,
      unitPrice: Math.max(0, unitPrice),
      quantity,
      subtotal: Math.max(0, unitPrice) * quantity
    };

    setItems(prev => [...prev, newItem]);
    setErrorMessage(null);

    // Reset quantity
    setQuantity(1);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Calculate Order Totals
  const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0);
  const totalAmount = Math.max(0, subtotal + Math.max(0, Number(deliveryFee) || 0) - Math.max(0, Number(discount) || 0));

  // Submit Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Customer name is required (e.g. Ramesh / Walk-in Customer).');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Please add at least one chicken product item to the order.');
      return;
    }

    if (orderType === 'Home Delivery' && !address.trim()) {
      setErrorMessage('Delivery address is required for Home Delivery orders.');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        customer: {
          name: name.trim(),
          phone: phone.trim() || 'Counter Walk-in',
          address: orderType === 'Home Delivery' ? address.trim() : 'In-store Counter / Walk-in',
          landmark: landmark.trim(),
          notes: notes.trim()
        },
        items: items.map(item => ({
          productId: item.productId,
          weight: item.weight,
          cutPreference: item.cutPreference,
          unitPrice: item.unitPrice,
          quantity: item.quantity
        })),
        orderType,
        paymentMethod,
        paymentStatus,
        orderStatus,
        deliveryFee: Math.max(0, Number(deliveryFee) || 0),
        discount: Math.max(0, Number(discount) || 0)
      };

      const createdOrder = await api.createAdminManualOrder(payload);
      onOrderCreated(createdOrder);
      onClose();
    } catch (err: any) {
      console.error('Error creating manual order:', err);
      setErrorMessage(err.message || 'Failed to create manual order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#FFF9F1] rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-stone-300 relative text-[#38251F] my-6 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-[#D92332] flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#38251F]">Create Manual Order</h2>
              <p className="text-xs text-stone-500">Record in-store walk-in, counter sale, or telephone order</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-full hover:bg-stone-200 transition-colors"
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

        <form onSubmit={handleSubmitOrder} className="space-y-5">
          {/* 1. Order Type / Channel */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700">Order Channel / Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Walk-in', 'Phone Order', 'Home Delivery'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setOrderType(type);
                    if (type === 'Walk-in') {
                      setDeliveryFee(0);
                      setPaymentStatus('Paid');
                    } else if (type === 'Home Delivery') {
                      setDeliveryFee(30);
                    }
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    orderType === type
                      ? 'bg-[#38251F] text-white border-[#38251F] shadow-xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Customer Information */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-3">
            <h3 className="text-xs font-black uppercase text-stone-500 tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Customer Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh / Walk-in Customer"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#D92332]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9848012345"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#D92332]"
                />
              </div>
            </div>

            {orderType === 'Home Delivery' && (
              <div className="space-y-2 pt-1">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Delivery Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="House/Flat No, Street, Colony..."
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#D92332]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Landmark</label>
                  <input
                    type="text"
                    placeholder="e.g. Opposite Rythu Bazar"
                    value={landmark}
                    onChange={e => setLandmark(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Butcher / Kitchen Notes</label>
              <input
                type="text"
                placeholder="e.g. Small pieces, less bone, roast gently..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium"
              />
            </div>
          </div>

          {/* 3. Items Selection / Builder */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-3">
            <h3 className="text-xs font-black uppercase text-stone-500 tracking-wider flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Add Fresh Poultry Items</span>
            </h3>

            {isLoadingProducts ? (
              <div className="py-4 text-center text-xs text-stone-400">Loading catalog items...</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  {/* Product Dropdown */}
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Product</label>
                    <select
                      value={selectedProductId}
                      onChange={e => handleProductChange(e.target.value)}
                      className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#D92332]"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Weight Variant */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Weight</label>
                    <select
                      value={selectedWeight}
                      onChange={e => handleWeightChange(e.target.value as WeightUnit)}
                      className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#D92332]"
                    >
                      {(['250g', '500g', '1kg'] as WeightUnit[]).map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>

                  {/* Price Rate */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Rate (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={unitPrice}
                      onChange={e => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-[#D92332]"
                    />
                  </div>

                  {/* Qty */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-center"
                    />
                  </div>
                </div>

                {/* Cut Preference selection */}
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex-1 w-full">
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Butcher Cut Style</label>
                    <select
                      value={selectedCut}
                      onChange={e => setSelectedCut(e.target.value)}
                      className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium"
                    >
                      {COMMON_CUT_PREFERENCES.map(cut => (
                        <option key={cut} value={cut}>{cut}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-auto self-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full sm:w-auto px-4 py-2 bg-[#D92332] hover:bg-[#b81d2a] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Items List */}
            {items.length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3 space-y-2">
                <div className="text-[11px] font-bold text-stone-500 uppercase">Items in this Order ({items.length})</div>
                <div className="divide-y divide-stone-100 max-h-40 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-[#38251F]">{item.productName}</div>
                        <div className="text-[11px] text-stone-500">
                          {item.weight} • {item.cutPreference} • ₹{item.unitPrice} × {item.quantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-[#D92332]">₹{item.subtotal}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-stone-400 hover:text-red-600 p-1 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Payment & Totals */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-3">
            <h3 className="text-xs font-black uppercase text-stone-500 tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payment & Financials</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700"
                >
                  <option value="Cash">Cash (Counter)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="COD">Cash on Delivery</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700"
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Initial Order Status</label>
                <select
                  value={orderStatus}
                  onChange={e => setOrderStatus(e.target.value as OrderStatus)}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700"
                >
                  <option value="Accepted">Accepted</option>
                  <option value="Preparing">Preparing</option>
                  <option value="Delivered">Delivered / Handed Over</option>
                  <option value="New">New</option>
                </select>
              </div>
            </div>

            {/* Financial Adjustments */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-stone-100">
              <div>
                <span className="block text-[11px] text-stone-500">Subtotal</span>
                <span className="text-sm font-bold text-[#38251F]">₹{subtotal}</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-0.5">Delivery Fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={deliveryFee}
                  onChange={e => setDeliveryFee(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full p-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-0.5">Discount (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full p-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-emerald-700"
                />
              </div>

              <div>
                <span className="block text-[11px] font-bold text-stone-700">Total Bill</span>
                <span className="text-base font-black text-[#D92332]">₹{totalAmount}</span>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="px-6 py-2.5 rounded-xl bg-[#D92332] hover:bg-[#b81d2a] text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Recording Order...' : 'Create & Record Order'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
