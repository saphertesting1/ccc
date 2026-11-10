import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Category, Product, ShopSettings } from '../types/index.js';
import { api } from '../services/api.js';

interface ShopContextType {
  settings: ShopSettings | null;
  categories: Category[];
  products: Product[];
  isLoading: boolean;
  error: string | null;
  refreshShopData: (forceLoading?: boolean) => Promise<void>;
  updateLocalSettings: (settings: ShopSettings) => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedOnce = React.useRef(false);

  const refreshShopData = useCallback(async (forceLoading = false) => {
    try {
      if (forceLoading || !hasLoadedOnce.current) {
        setIsLoading(true);
      }
      setError(null);
      const [fetchedSettings, fetchedCategories, fetchedProducts] = await Promise.all([
        api.getShopSettings(),
        api.getCategories(),
        api.getProducts()
      ]);
      setSettings(fetchedSettings);
      setCategories(fetchedCategories);
      setProducts(fetchedProducts);
      hasLoadedOnce.current = true;
    } catch (err: any) {
      console.error('Failed to load shop data:', err);
      setError(err.message || 'Could not connect to shop backend');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshShopData().catch(() => {});

    // Cross-tab and in-tab synchronization handlers
    const handleSync = () => {
      refreshShopData(false).catch(() => {});
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ccc_shop_data_updated') {
        refreshShopData(false).catch(() => {});
      }
    };

    const handleFocus = () => {
      refreshShopData(false).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshShopData(false).catch(() => {});
      }
    };

    window.addEventListener('ccc_shop_data_updated', handleSync);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('ccc_shop_sync');
        bc.onmessage = () => {
          refreshShopData(false).catch(() => {});
        };
      } catch {
        // BroadcastChannel optional
      }
    }

    // Gentle 10s background sync to guarantee synchronization on mobile/web
    const timer = setInterval(() => {
      refreshShopData(false);
    }, 10000);

    return () => {
      window.removeEventListener('ccc_shop_data_updated', handleSync);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (bc) bc.close();
      clearInterval(timer);
    };
  }, [refreshShopData]);

  const updateLocalSettings = (newSettings: ShopSettings) => {
    setSettings(newSettings);
  };

  return (
    <ShopContext.Provider
      value={{
        settings,
        categories,
        products,
        isLoading,
        error,
        refreshShopData,
        updateLocalSettings
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop must be used within a ShopProvider');
  return context;
};
