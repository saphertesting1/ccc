import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Lock, 
  User, 
  AlertCircle, 
  ArrowLeft, 
  ShieldCheck, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Mail, 
  CheckCircle2 
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext.js';
import { api } from '../services/api.js';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password mode
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await login(username.trim(), password);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid admin credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setRecoverySubmitting(true);

    try {
      const res = await api.requestPasswordReset(recoveryEmail.trim());
      setSuccess(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to send recovery email. Please try again.');
    } finally {
      setRecoverySubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F1] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <Link to="/" className="inline-flex items-center gap-2 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-[#D92332] text-white flex items-center justify-center font-black text-2xl shadow-lg">
            CCC
          </div>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-black text-[#38251F] font-serif">
          Chandu Chicken Center
        </h2>
        <p className="text-xs text-stone-500 font-medium">
          Authorized Butcher & Shop Administration Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-3xl border border-stone-200/90 sm:px-10 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
            {isForgotPassword ? (
              <>
                <KeyRound className="w-5 h-5 text-[#D92332]" />
                <h3 className="font-bold text-sm text-[#38251F]">Reset Admin Password</h3>
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 text-[#D92332]" />
                <h3 className="font-bold text-sm text-[#38251F]">Admin Secure Sign-In</h3>
              </>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span className="leading-relaxed">{success}</span>
            </div>
          )}

          {!isForgotPassword ? (
            /* Standard Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Admin Email or Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. admin@gmail.com or admin"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  />
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-700">
                    Security Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter security password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  />
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 focus:outline-hidden"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError(null);
                      setSuccess(null);
                      if (username.includes('@')) {
                        setRecoveryEmail(username);
                      }
                    }}
                    className="text-xs font-semibold text-[#D92332] hover:underline focus:outline-hidden"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 rounded-xl text-xs sm:text-sm font-bold text-white transition-all shadow-md active:scale-95 ${
                  isSubmitting ? 'bg-stone-400 cursor-wait' : 'bg-[#D92332] hover:bg-[#b81d2a]'
                }`}
              >
                {isSubmitting ? 'Authenticating...' : 'Sign In to Admin Dashboard'}
              </button>
            </form>
          ) : (
            /* Forgot Password Flow */
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                Enter your registered administrator email address below. We will send you a secure link to reset your password.
              </p>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Registered Administrator Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="e.g. admin@example.com"
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  />
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <button
                type="submit"
                disabled={recoverySubmitting}
                className={`w-full py-3 rounded-xl text-xs sm:text-sm font-bold text-white transition-all shadow-md active:scale-95 ${
                  recoverySubmitting ? 'bg-stone-400 cursor-wait' : 'bg-[#D92332] hover:bg-[#b81d2a]'
                }`}
              >
                {recoverySubmitting ? 'Sending Recovery Link...' : 'Send Password Recovery Link'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-xs font-semibold text-stone-600 hover:text-[#D92332] transition-colors"
                >
                  ← Back to Admin Sign-In
                </button>
              </div>
            </form>
          )}

          {/* Security Notice */}
          <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span>Authorized Shop Manager Portal</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Only verified administrator accounts registered in Supabase Authentication and authorized in the database may access this portal.
            </p>
          </div>

          <div className="text-center pt-2 border-t border-stone-100">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-[#D92332] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Public Chicken Shop</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
