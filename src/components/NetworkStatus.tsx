import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-[#38251F] text-amber-200 text-xs sm:text-sm px-4 py-2 flex items-center justify-center gap-2 text-center sticky top-0 z-50">
      <WifiOff className="w-4 h-4 shrink-0 text-amber-400 animate-pulse" />
      <span>No internet connection detected. Please check your network to place orders.</span>
    </div>
  );
}
