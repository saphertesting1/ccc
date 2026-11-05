import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Lock, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  RefreshCw 
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabase.js';
import { api } from '../services/api.js';

export default function AdminResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isVerifying, setIsVerifying] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function initRecoverySession() {
      // 1. If Supabase is not configured, allow local testing mode
      if (!isSupabaseConfigured || !supabase) {
        if (mounted) {
          setHasValidSession(true);
          setIsVerifying(false);
        }
        return;
      }

      const client = supabase;

      try {
        // 2. Check for PKCE Authorization Code in query params (?code=...)
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        if (code) {
          const { data, error } = await client.auth.exchangeCodeForSession(code);
          if (!error && data?.session) {
            if (mounted) {
              setHasValidSession(true);
              setIsVerifying(false);
            }
            return;
          }
        }

        // 3. Check for implicit grant tokens in hash (#access_token=...&type=recovery)
        const hash = window.location.hash || '';
        if (hash.includes('access_token')) {
          const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data, error } = await client.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (!error && data?.session) {
              if (mounted) {
                setHasValidSession(true);
                setIsVerifying(false);
              }
              return;
            }
          }
        }

        // 4. Check for active session in client storage
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData?.session) {
          if (mounted) {
            setHasValidSession(true);
            setIsVerifying(false);
          }
          return;
        }

        // 5. Subscribe to auth state changes (e.g. PASSWORD_RECOVERY or SIGNED_IN)
        const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
            if (mounted) {
              setHasValidSession(true);
              setIsVerifying(false);
            }
          }
        });

        // 6. Fallback timeout for token detection
        setTimeout(async () => {
          if (mounted && isVerifying) {
            const { data: checkData } = await client.auth.getSession();
            if (checkData?.session) {
              setHasValidSession(true);
            } else {
              setHasValidSession(false);
              setVerificationError(
                'Password recovery link is invalid, expired, or has already been used. Please request a new recovery link from the admin login page.'
              );
            }
            setIsVerifying(false);
          }
        }, 1500);

        return () => {
          subscription.unsubscribe();
        };
      } catch (err: any) {
        if (mounted) {
          setHasValidSession(false);
          setVerificationError(
            err.message || 'Unable to establish secure password recovery session. Please request a new link.'
          );
          setIsVerifying(false);
        }
      }
    }

    initRecoverySession();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!newPassword || newPassword.length < 6) {
      setSubmitError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError('New password and confirm password do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.resetPasswordWithRecovery(newPassword);
      setIsSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to update password. Please try again or request a new link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F1] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
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
            <KeyRound className="w-5 h-5 text-[#D92332]" />
            <h3 className="font-bold text-sm text-[#38251F]">Set New Admin Password</h3>
          </div>

          {/* Verification Loading State */}
          {isVerifying ? (
            <div className="py-8 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-[#D92332] animate-spin mx-auto" />
              <p className="text-xs font-semibold text-stone-700">
                Verifying secure password recovery link...
              </p>
              <p className="text-[11px] text-stone-500">
                Establishing authenticated recovery session with Supabase.
              </p>
            </div>
          ) : isSuccess ? (
            /* Success State */
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-base text-[#38251F]">
                  Password Reset Successful
                </h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Your administrator password has been updated securely. You can now sign in to the portal with your new password.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/admin/login')}
                  className="w-full py-3 rounded-xl bg-[#D92332] hover:bg-[#b81d2a] text-white text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
                >
                  Proceed to Admin Sign-In
                </button>
              </div>
            </div>
          ) : !hasValidSession ? (
            /* Invalid or Expired Token State */
            <div className="space-y-4">
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-relaxed">
                  {verificationError || 'This password reset link is invalid or has expired.'}
                </span>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed">
                Password recovery links can only be used once and expire for security reasons. Please return to the login screen and request a fresh link.
              </p>

              <button
                type="button"
                onClick={() => navigate('/admin/login')}
                className="w-full py-3 rounded-xl bg-[#D92332] hover:bg-[#b81d2a] text-white text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
              >
                Back to Admin Login
              </button>
            </div>
          ) : (
            /* Active Reset Password Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                Create a strong new password for your administrator account.
              </p>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  New Security Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Enter at least 6 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 focus:outline-hidden"
                    title={showNewPassword ? 'Hide password' : 'Show password'}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 focus:outline-hidden"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
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
                {isSubmitting ? 'Updating Password...' : 'Save & Update Password'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/admin/login')}
                  className="text-xs font-semibold text-stone-600 hover:text-[#D92332] transition-colors"
                >
                  Cancel & Return to Admin Login
                </button>
              </div>
            </form>
          )}

          {/* Security Notice */}
          <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span>Secure Single-Use Link</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Only authentic recovery sessions authenticated by Supabase are authorized to modify administrator credentials.
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
