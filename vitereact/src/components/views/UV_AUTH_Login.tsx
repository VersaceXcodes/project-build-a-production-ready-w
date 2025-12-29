import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import sultanstampLogo from '@/assets/sultanstamp_logo.jpeg';

const UV_AUTH_Login: React.FC = () => {
  // ===========================
  // URL PARAMETERS
  // ===========================
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const returnToParam = searchParams.get('returnTo');
  const roleParam = searchParams.get('role');

  // ===========================
  // GLOBAL STATE ACCESS (Individual Selectors - CRITICAL)
  // ===========================
  
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const authError = useAppStore(state => state.authentication_state.error_message);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const loginUser = useAppStore(state => state.login_user);
  const clearAuthError = useAppStore(state => state.clear_auth_error);

  // ===========================
  // LOCAL COMPONENT STATE
  // ===========================
  
  const [form_data, set_form_data] = useState({
    email: '',
    password: '',
    role: (roleParam?.toUpperCase() as 'CUSTOMER' | 'STAFF' | 'ADMIN') || 'CUSTOMER',
  });

  const [form_errors, set_form_errors] = useState<{
    email: string | null;
    password: string | null;
    role: string | null;
    general: string | null;
  }>({
    email: null,
    password: null,
    role: null,
    general: null,
  });

  const [return_to_path, set_return_to_path] = useState<string>(returnToParam || '/app');
  const [selected_role, set_selected_role] = useState<'CUSTOMER' | 'STAFF' | 'ADMIN'>(
    (roleParam?.toUpperCase() as 'CUSTOMER' | 'STAFF' | 'ADMIN') || 'CUSTOMER'
  );
  const [remember_me, set_remember_me] = useState(false);
  const [password_visible, set_password_visible] = useState(false);
  const [is_locked_out, set_is_locked_out] = useState(false);
  const [lockout_remaining_seconds, set_lockout_remaining_seconds] = useState(0);

  // ===========================
  // RATE LIMITING HELPERS
  // ===========================

  const LOCKOUT_KEY = 'login_lockout_until';
  const ATTEMPTS_KEY = 'login_failed_attempts';
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  const check_lockout_status = () => {
    const lockout_until = localStorage.getItem(LOCKOUT_KEY);
    if (!lockout_until) return false;

    const now = Date.now();
    const unlock_time = parseInt(lockout_until);

    if (now < unlock_time) {
      const remaining = Math.ceil((unlock_time - now) / 1000);
      set_lockout_remaining_seconds(remaining);
      set_is_locked_out(true);
      return true;
    } else {
      // Lockout expired
      localStorage.removeItem(LOCKOUT_KEY);
      localStorage.removeItem(ATTEMPTS_KEY);
      set_is_locked_out(false);
      return false;
    }
  };

  const record_failed_attempt = () => {
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0');
    const new_attempts = attempts + 1;
    localStorage.setItem(ATTEMPTS_KEY, new_attempts.toString());

    if (new_attempts >= MAX_ATTEMPTS) {
      const unlock_time = Date.now() + LOCKOUT_DURATION_MS;
      localStorage.setItem(LOCKOUT_KEY, unlock_time.toString());
      set_is_locked_out(true);
      set_lockout_remaining_seconds(Math.ceil(LOCKOUT_DURATION_MS / 1000));
    }

    return new_attempts;
  };

  const clear_failed_attempts = () => {
    localStorage.removeItem(ATTEMPTS_KEY);
    localStorage.removeItem(LOCKOUT_KEY);
    set_is_locked_out(false);
  };

  // ===========================
  // EFFECTS
  // ===========================

  // Check lockout status on mount
  useEffect(() => {
    check_lockout_status();
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (is_locked_out && lockout_remaining_seconds > 0) {
      const timer = setInterval(() => {
        const still_locked = check_lockout_status();
        if (!still_locked) {
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [is_locked_out, lockout_remaining_seconds]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const default_redirect = get_default_redirect(currentUser.role);
      navigate(return_to_path || default_redirect, { replace: true });
    }
  }, [isAuthenticated, currentUser, return_to_path, navigate]);

  // Update return_to_path when URL param changes
  useEffect(() => {
    if (returnToParam) {
      set_return_to_path(returnToParam);
    }
  }, [returnToParam]);

  // Sync form_data.role with selected_role
  useEffect(() => {
    set_form_data(prev => ({ ...prev, role: selected_role }));
  }, [selected_role]);

  // ===========================
  // HELPER FUNCTIONS
  // ===========================

  const get_default_redirect = (role: string): string => {
    switch (role) {
      case 'CUSTOMER':
        return '/app';
      case 'STAFF':
        return '/staff';
      case 'ADMIN':
        return '/admin';
      default:
        return '/';
    }
  };

  const validate_email = (email: string): boolean => {
    const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email_regex.test(email);
  };

  const validate_form = (): boolean => {
    const errors: typeof form_errors = {
      email: null,
      password: null,
      role: null,
      general: null,
    };

    if (!form_data.email) {
      errors.email = 'Email is required';
    } else if (!validate_email(form_data.email)) {
      errors.email = 'Invalid email format';
    }

    if (!form_data.password) {
      errors.password = 'Password is required';
    }

    if (!form_data.role) {
      errors.role = 'Please select a role';
    }

    set_form_errors(errors);
    return !errors.email && !errors.password && !errors.role;
  };

  // ===========================
  // EVENT HANDLERS
  // ===========================

  const handle_form_field_change = (field: keyof typeof form_data, value: string) => {
    set_form_data(prev => ({ ...prev, [field]: value }));
    // Clear field error when user types
    set_form_errors(prev => ({ ...prev, [field]: null }));
  };

  const handle_role_change = (new_role: 'CUSTOMER' | 'STAFF' | 'ADMIN') => {
    set_selected_role(new_role);
    set_form_data(prev => ({ ...prev, role: new_role }));
    
    // Update URL with role param
    const new_params = new URLSearchParams(searchParams);
    new_params.set('role', new_role);
    navigate(`/login?${new_params.toString()}`, { replace: true });
  };

  const toggle_password_visibility = () => {
    set_password_visible(prev => !prev);
  };

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous auth error
    clearAuthError();
    set_form_errors(prev => ({ ...prev, general: null }));

    // Check lockout status
    if (check_lockout_status()) {
      set_form_errors(prev => ({
        ...prev,
        general: `Account locked due to too many failed attempts. Please try again in ${Math.ceil(lockout_remaining_seconds / 60)} minutes.`,
      }));
      return;
    }

    // Validate form
    if (!validate_form()) {
      return;
    }

    try {
      // Call global store login action
      await loginUser(form_data.email, form_data.password, form_data.role);
      
      // Success - clear failed attempts
      clear_failed_attempts();

      // Navigation handled by useEffect watching isAuthenticated
    } catch (error: any) {
      // Error handled by store, but we track failed attempts
      const attempts = record_failed_attempt();
      
      if (attempts >= MAX_ATTEMPTS) {
        set_form_errors(prev => ({
          ...prev,
          general: 'Too many failed attempts. Account locked for 15 minutes.',
        }));
      } else {
        const remaining = MAX_ATTEMPTS - attempts;
        set_form_errors(prev => ({
          ...prev,
          general: `${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before account lock.`,
        }));
      }
    }
  };

  const navigate_to_register = () => {
    const params = new URLSearchParams();
    if (return_to_path) {
      params.set('returnTo', return_to_path);
    }
    navigate(`/register?${params.toString()}`);
  };

  const navigate_to_forgot_password = () => {
    navigate('/forgot-password');
  };

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          {/* Card Container */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-8 pb-6 bg-gradient-to-r from-gray-900 to-black">
              <div className="flex justify-center mb-4">
                <img src={sultanstampLogo} alt="SultanStamp" className="h-16 w-auto" />
              </div>
              <h2 className="text-center text-3xl font-bold text-white">
                Welcome Back
              </h2>
              <p className="mt-2 text-center text-sm text-gray-300">
                Sign in to access your SultanStamp account
              </p>
            </div>

            {/* Form Section */}
            <div className="px-8 py-8">
              <form onSubmit={handle_submit} className="space-y-6">
                {/* Role Selector */}
                <div>
                  <label htmlFor="role" className="block text-sm font-semibold text-gray-900 mb-2">
                    I am a:
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={selected_role}
                    onChange={(e) => handle_role_change(e.target.value as 'CUSTOMER' | 'STAFF' | 'ADMIN')}
                    className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all"
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="STAFF">Staff</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={form_data.email}
                    onChange={(e) => handle_form_field_change('email', e.target.value)}
                    placeholder="your.email@example.com"
                    className={`block w-full px-4 py-3 border-2 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none transition-all ${
                      form_errors.email
                        ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                        : 'border-gray-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100'
                    }`}
                  />
                  {form_errors.email && (
                    <p className="mt-2 text-sm text-red-600" role="alert">
                      {form_errors.email}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={password_visible ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={form_data.password}
                      onChange={(e) => handle_form_field_change('password', e.target.value)}
                      placeholder="Enter your password"
                      className={`block w-full px-4 py-3 pr-12 border-2 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none transition-all ${
                        form_errors.password
                          ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                          : 'border-gray-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={toggle_password_visibility}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={password_visible ? 'Hide password' : 'Show password'}
                    >
                      {password_visible ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {form_errors.password && (
                    <p className="mt-2 text-sm text-red-600" role="alert">
                      {form_errors.password}
                    </p>
                  )}
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remember_me}
                      onChange={(e) => set_remember_me(e.target.checked)}
                      className="w-4 h-4 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400 focus:ring-2"
                    />
                    <span className="ml-2 text-sm text-gray-700">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={navigate_to_forgot_password}
                    className="text-sm font-medium text-gray-900 hover:text-yellow-600 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* General Error (from API or lockout) */}
                {(authError || form_errors.general) && (
                  <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg" role="alert">
                    <p className="text-sm font-medium">
                      {authError || form_errors.general}
                    </p>
                  </div>
                )}

                {/* Lockout Warning */}
                {is_locked_out && (
                  <div className="bg-orange-50 border-2 border-orange-200 text-orange-700 px-4 py-3 rounded-lg" role="alert">
                    <p className="text-sm font-medium">
                      Account locked for {Math.floor(lockout_remaining_seconds / 60)} minutes {lockout_remaining_seconds % 60} seconds due to multiple failed login attempts.
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || is_locked_out}
                  className="w-full flex justify-center items-center px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 focus:outline-none focus:ring-4 focus:ring-yellow-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-yellow-400"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-black"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5 mr-2" />
                      Log In
                    </>
                  )}
                </button>

                {/* Staff/Admin Note */}
                {(selected_role === 'STAFF' || selected_role === 'ADMIN') && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500">
                      Staff and Admin accounts are created by administrators. Contact your admin if you need access.
                    </p>
                  </div>
                )}
              </form>

              {/* New Customer Registration CTA */}
              {selected_role === 'CUSTOMER' && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-center text-sm text-gray-600 mb-4">New to SultanStamp?</p>
                  <button
                    type="button"
                    onClick={navigate_to_register}
                    className="w-full flex justify-center items-center px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all duration-200"
                  >
                    Create Account
                  </button>

                  {/* Value props for new users */}
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Free quotes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Order tracking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Proof approval</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Secure payments</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
              <div className="text-center">
                <Link
                  to="/"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Home
                </Link>
              </div>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>256-bit SSL</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>Trusted Service</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_AUTH_Login;