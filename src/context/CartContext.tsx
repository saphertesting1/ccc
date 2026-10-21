import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, Product, WeightUnit } from '../types/index.js';
import { useShop } from './ShopContext.js';

interface CartContextType {
  cart: CartItem[];
  addItem: (product: Product, weight: WeightUnit, cutPreference: string, quantity?: number) => void;
  updateQuantity: (cartItemId: string, newQty: number) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
  totalItemsCount: number;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  freeDeliveryShortfall: number;
  isCartDrawerOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useShop();
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('ccc_guest_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('ccc_guest_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage:', e);
    }
  }, [cart]);

  const addItem = (product: Product, weight: WeightUnit, cutPreference: string, quantity = 1) => {
    const weightOpt = product.weights.find(w => w.weight === weight) || product.weights[0];
    const unitPrice = weightOpt ? weightOpt.price : 0;
    const cartItemId = `${product.id}_${weight}_${cutPreference.replace(/\s+/g, '-')}`;

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.cartItemId === cartItemId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          itemTotal: newQty * unitPrice
        };
        return updated;
      } else {
        const newItem: CartItem = {
          cartItemId,
          productId: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          weight,
          cutPreference,
          unitPrice,
          quantity,
          itemTotal: quantity * unitPrice
        };
        return [...prev, newItem];
      }
    });

    setIsCartDrawerOpen(true);
  };

  const updateQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(cartItemId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.cartItemId === cartItemId
          ? { ...item, quantity: newQty, itemTotal: newQty * item.unitPrice }
          : item
      )
    );
  };

  const removeItem = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);

  const freeDeliveryThreshold = settings?.freeDeliveryThreshold ?? 499;
  const standardDeliveryFee = settings?.deliveryFee ?? 30;

  const deliveryFee = subtotal === 0 ? 0 : subtotal >= freeDeliveryThreshold ? 0 : standardDeliveryFee;
  const totalAmount = subtotal + deliveryFee;
  const freeDeliveryShortfall = Math.max(0, freeDeliveryThreshold - subtotal);

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        totalItemsCount,
        subtotal,
        deliveryFee,
        totalAmount,
        freeDeliveryShortfall,
        isCartDrawerOpen,
        openCartDrawer: () => setIsCartDrawerOpen(true),
        closeCartDrawer: () => setIsCartDrawerOpen(false)
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
