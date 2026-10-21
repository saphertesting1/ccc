import React from 'react';
import { AlertCircle, Clock, ShieldCheck, X } from 'lucide-react';

interface UpiPendingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpiPendingModal: React.FC<UpiPendingModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FFF9F1] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-200 relative text-[#38251F]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1.5 rounded-full hover:bg-stone-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md inline-block">
              Integration Pending
            </span>
            <h3 className="text-lg font-bold text-[#38251F]">UPI Payment Notice</h3>
          </div>
        </div>

        <div className="space-y-3 text-sm text-stone-700 mb-6 bg-white p-4 rounded-xl border border-amber-100">
          <p className="font-medium text-[#38251F]">
            Instant UPI (Google Pay, PhonePe, Paytm, BHIM) is currently in banking gateway setup.
          </p>
          <ul className="space-y-2 text-xs text-stone-600 list-disc list-inside">
            <li>We do not accept unverified or simulated payments to protect customers.</li>
            <li>No fake merchant UPI IDs or unconfirmed transactions are generated.</li>
            <li>All online orders are currently fulfilled via <strong>Cash on Delivery (COD)</strong>.</li>
            <li>You only pay when you inspect and receive your fresh chicken at your doorstep!</li>
          </ul>
        </div>

        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-5 text-emerald-800 text-xs font-medium">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Cash on Delivery is 100% active and verified for all delivery addresses.</span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 px-4 bg-[#D92332] hover:bg-[#b81d2a] text-white font-semibold rounded-xl transition-all shadow-md active:scale-[0.98]"
        >
          Understood, Continue with Cash on Delivery
        </button>
      </div>
    </div>
  );
};
