import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import sultanstampLogo from '@/assets/sultanstamp_logo.jpeg';

const UV_AUTH_Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // CRITICAL: Individual Zustand selectors (no object destructuring)
  const isAuthLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const authError = useAppStore(state => state.authentication_state.error_message);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const registerUser = useAppStore(state => state.register_user);
  const clearAuthError = useAppStore(state => state.clear_auth_error);
  const showToast = useAppStore(state => state.show_toast);

  // Local state variables
  const [form_data, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '',
    company_name: '',
    address: '',
    terms_agreed: false,
  });

  const [form_errors, setFormErrors] = useState<{
    name: string | null;
    email: string | null;
    password: string | null;
    confirm_password: string | null;
    phone: string | null;
    company_name: string | null;
    address: string | null;
    terms: string | null;
    general: string | null;
  }>({
    name: null,
    email: null,
    password: null,
    confirm_password: null,
    phone: null,
    company_name: null,
    address: null,
    terms: null,
    general: null,
  });

  const [password_strength, setPasswordStrength] = useState({
    score: 0,
    feedback: 'Enter a password',
    has_uppercase: false,
    has_lowercase: false,
    has_number: false,
    has_symbol: false,
    min_length: false,
  });

  const [is_submitting, setIsSubmitting] = useState(false);

  const [email_available, setEmailAvailable] = useState<{
    is_checking: boolean;
    is_available: boolean | null;
  }>({
    is_checking: false,
    is_available: null,
  });

  const [return_to_path, setReturnToPath] = useState<string | null>(null);
  const [show_password, setShowPassword] = useState(false);
  const [show_confirm_password, setShowConfirmPassword] = useState(false);

  // Parse URL params on mount (return_to, pre-fill email/name from guest quote)
  useEffect(() => {
    const return_to = searchParams.get('return_to');
    setReturnToPath(return_to);
    
    // Pre-fill from URL params (from guest quote conversion)
    const prefillEmail = searchParams.get('email');
    const prefillName = searchParams.get('name');
    const quoteId = searchParams.get('quote');
    
    if (prefillEmail || prefillName) {
      setFormData(prev => ({
        ...prev,
        email: prefillEmail || prev.email,
        name: prefillName || prev.name,
      }));
    }
    
    // Store quote ID for linking after registration
    if (quoteId) {
      sessionStorage.setItem('pending_quote_link', quoteId);
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(return_to_path || '/app');
    }
  }, [isAuthenticated, navigate, return_to_path]);

  // Clear auth error on unmount
  useEffect(() => {
    return () => {
      clearAuthError();
    };
  }, [clearAuthError]);

  // Password strength calculator
  const calculate_password_strength = (password: string) => {
    const has_uppercase = /[A-Z]/.test(password);
    const has_lowercase = /[a-z]/.test(password);
    const has_number = /[0-9]/.test(password);
    const has_symbol = /[^A-Za-z0-9]/.test(password);
    const min_length = password.length >= 8;

    const criteria_met = [
      has_uppercase,
      has_lowercase,
      has_number,
      has_symbol,
      min_length,
    ].filter(Boolean).length;

    let score = 0;
    let feedback = 'Enter a password';

    if (password.length > 0) {
      score = criteria_met;
      if (score <= 2) feedback = 'Weak';
      else if (score <= 3) feedback = 'Medium';
      else feedback = 'Strong';
    }

    setPasswordStrength({
      score,
      feedback,
      has_uppercase,
      has_lowercase,
      has_number,
      has_symbol,
      min_length,
    });
  };

  // Email availability check using dedicated endpoint
  const check_email_availability = async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailAvailable({ is_checking: false, is_available: null });
      return;
    }

    setEmailAvailable({ is_checking: true, is_available: null });

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

      const response = await fetch(`${API_BASE_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.available) {
          setEmailAvailable({ is_checking: false, is_available: true });
          setFormErrors((prev) => ({ ...prev, email: null }));
        } else {
          setEmailAvailable({ is_checking: false, is_available: false });
          setFormErrors((prev) => ({
            ...prev,
            email: 'Email already registered',
          }));
        }
      } else {
        // Error checking, don't block registration
        setEmailAvailable({ is_checking: false, is_available: null });
      }
    } catch (error) {
      // Network error or other issue - don't block registration
      setEmailAvailable({ is_checking: false, is_available: null });
    }
  };

  // Debounced email check
  useEffect(() => {
    if (form_data.email && form_data.email.includes('@')) {
      const timeout = setTimeout(() => {
        check_email_availability(form_data.email);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [form_data.email]);

  // Form field update handler
  const update_form_field = (field: keyof typeof form_data, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Clear field error on change
    setFormErrors((prev) => ({ ...prev, [field]: null }));
    
    // Update password strength if password field
    if (field === 'password') {
      calculate_password_strength(value as string);
    }
    
    // Clear email availability if email changes
    if (field === 'email') {
      setEmailAvailable({ is_checking: false, is_available: null });
    }
  };

  // Validate individual field
  const validate_field = (field: keyof typeof form_data): string | null => {
    const value = form_data[field];

    switch (field) {
      case 'name':
        if (!value || (value as string).trim().length === 0) {
          return 'Name is required';
        }
        if ((value as string).trim().length > 255) {
          return 'Name must be less than 255 characters';
        }
        return null;

      case 'email':
        if (!value || (value as string).trim().length === 0) {
          return 'Email is required';
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string)) {
          return 'Invalid email format';
        }
        if (email_available.is_available === false) {
          return 'Email already registered';
        }
        return null;

      case 'password':
        if (!value || (value as string).length === 0) {
          return 'Password is required';
        }
        if ((value as string).length < 8) {
          return 'Password must be at least 8 characters';
        }
        if (!password_strength.has_uppercase) {
          return 'Password must include uppercase letter';
        }
        if (!password_strength.has_number) {
          return 'Password must include number';
        }
        if (!password_strength.has_symbol) {
          return 'Password must include symbol';
        }
        return null;

      case 'confirm_password':
        if (!value || (value as string).length === 0) {
          return 'Please confirm your password';
        }
        if (value !== form_data.password) {
          return 'Passwords do not match';
        }
        return null;

      case 'terms_agreed':
        if (!value) {
          return 'You must agree to the Terms of Service';
        }
        return null;

      default:
        return null;
    }
  };

  // Handle field blur (validate on blur)
  const handle_field_blur = (field: keyof typeof form_data) => {
    const error = validate_field(field);
    setFormErrors((prev) => ({ ...prev, [field]: error }));
  };

  // Validate entire form
  const validate_form = (): boolean => {
    const errors: any = {};
    
    errors.name = validate_field('name');
    errors.email = validate_field('email');
    errors.password = validate_field('password');
    errors.confirm_password = validate_field('confirm_password');
    errors.terms = validate_field('terms_agreed');

    setFormErrors((prev) => ({ ...prev, ...errors }));

    return Object.values(errors).every((error) => error === null);
  };

  // Handle form submission
  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();

    // Client-side validation
    if (!validate_form()) {
      showToast({
        type: 'error',
        message: 'Please fix form errors before submitting',
        duration: 5000,
      });
      return;
    }

    // Check email availability one last time
    if (email_available.is_available === false) {
      setFormErrors((prev) => ({
        ...prev,
        email: 'Email already registered',
        general: 'Please use a different email address',
      }));
      return;
    }

    setIsSubmitting(true);

    try {
      // Call global register_user function
      await registerUser({
        name: form_data.name.trim(),
        email: form_data.email.toLowerCase().trim(),
        password: form_data.password,
        phone: form_data.phone.trim() || undefined,
        company_name: form_data.company_name.trim() || undefined,
        address: form_data.address.trim() || undefined,
      });

      // Success - global state updated, user authenticated
      showToast({
        type: 'success',
        message: 'Account created successfully! Welcome to SultanStamp.',
        duration: 5000,
      });

      // Navigate to return path or dashboard
      navigate(return_to_path || '/app');
    } catch (error: any) {
      setIsSubmitting(false);
      
      // Error already in global state, but set local error too
      setFormErrors((prev) => ({
        ...prev,
        general: error.message || 'Registration failed. Please try again.',
      }));

      showToast({
        type: 'error',
        message: error.message || 'Registration failed',
        duration: 5000,
      });
    }
  };

  // Password strength color and width
  const get_strength_color = () => {
    if (password_strength.score === 0) return 'bg-gray-300';
    if (password_strength.score <= 2) return 'bg-red-500';
    if (password_strength.score <= 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const get_strength_width = () => {
    return `${(password_strength.score / 5) * 100}%`;
  };

  return (
    <>
      {/* Header with logo */}
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="bg-white border-b-2 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center">
            <Link to="/" className="flex items-center">
              <img src={sultanstampLogo} alt="SultanStamp" className="h-10 sm:h-12 w-auto" />
            </Link>
          </div>
        </div>

        {/* Registration form */}
        <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">
            {/* Header section */}
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                Create Your SultanStamp Account
              </h2>
              <p className="text-base sm:text-lg text-gray-600">
                Join us to get quotes and track your orders
              </p>
            </div>

            {/* Card wrapper */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8">
              {/* Global error message */}
              {(authError || form_errors.general) && (
                <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700 font-medium">
                    {authError || form_errors.general}
                  </p>
                </div>
              )}

              {/* Registration form */}
              <form onSubmit={handle_submit} className="space-y-6">
                {/* Name field */}
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-900 mb-2">
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={form_data.name}
                    onChange={(e) => update_form_field('name', e.target.value)}
                    onBlur={() => handle_field_blur('name')}
                    placeholder="John Doe"
                    className={`w-full px-4 py-3 border-2 rounded-lg text-base focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all ${
                      form_errors.name
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-gray-200 focus:border-black'
                    }`}
                  />
                  {form_errors.name && (
                    <p className="mt-2 text-sm text-red-600">{form_errors.name}</p>
                  )}
                </div>

                {/* Email field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                    Email Address <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={form_data.email}
                      onChange={(e) => update_form_field('email', e.target.value)}
                      onBlur={() => handle_field_blur('email')}
                      placeholder="john@example.com"
                      className={`w-full px-4 py-3 border-2 rounded-lg text-base focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all ${
                        form_errors.email
                          ? 'border-red-500 focus:border-red-500'
                          : email_available.is_available === true
                          ? 'border-green-500 focus:border-green-500'
                          : 'border-gray-200 focus:border-black'
                      }`}
                    />
                    {email_available.is_checking && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    )}
                    {email_available.is_available === true && !email_available.is_checking && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {form_errors.email && (
                    <p className="mt-2 text-sm text-red-600">{form_errors.email}</p>
                  )}
                  {email_available.is_available === true && !form_errors.email && (
                    <p className="mt-2 text-sm text-green-600">✓ Email available</p>
                  )}
                </div>

                {/* Password field */}
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
                    Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={show_password ? 'text' : 'password'}
                      required
                      value={form_data.password}
                      onChange={(e) => update_form_field('password', e.target.value)}
                      onBlur={() => handle_field_blur('password')}
                      placeholder="Enter strong password"
                      className={`w-full px-4 py-3 pr-12 border-2 rounded-lg text-base focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all ${
                        form_errors.password
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-gray-200 focus:border-black'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!show_password)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {show_password ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Password strength meter */}
                  {form_data.password && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">Password Strength:</span>
                        <span className={`text-xs font-semibold ${
                          password_strength.score <= 2 ? 'text-red-600' :
                          password_strength.score <= 3 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {password_strength.feedback}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${get_strength_color()}`}
                          style={{ width: get_strength_width() }}
                        ></div>
                      </div>
                      
                      {/* Requirements checklist */}
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className={`flex items-center text-xs ${password_strength.min_length ? 'text-green-600' : 'text-gray-500'}`}>
                          <span className="mr-1">{password_strength.min_length ? '✓' : '○'}</span>
                          8+ characters
                        </div>
                        <div className={`flex items-center text-xs ${password_strength.has_uppercase ? 'text-green-600' : 'text-gray-500'}`}>
                          <span className="mr-1">{password_strength.has_uppercase ? '✓' : '○'}</span>
                          Uppercase
                        </div>
                        <div className={`flex items-center text-xs ${password_strength.has_number ? 'text-green-600' : 'text-gray-500'}`}>
                          <span className="mr-1">{password_strength.has_number ? '✓' : '○'}</span>
                          Number
                        </div>
                        <div className={`flex items-center text-xs ${password_strength.has_symbol ? 'text-green-600' : 'text-gray-500'}`}>
                          <span className="mr-1">{password_strength.has_symbol ? '✓' : '○'}</span>
                          Symbol
                        </div>
                      </div>
                    </div>
                  )}

                  {form_errors.password && (
                    <p className="mt-2 text-sm text-red-600">{form_errors.password}</p>
                  )}
                </div>

                {/* Confirm password field */}
                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-semibold text-gray-900 mb-2">
                    Confirm Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="confirm_password"
                      name="confirm_password"
                      type={show_confirm_password ? 'text' : 'password'}
                      required
                      value={form_data.confirm_password}
                      onChange={(e) => update_form_field('confirm_password', e.target.value)}
                      onBlur={() => handle_field_blur('confirm_password')}
                      placeholder="Re-enter password"
                      className={`w-full px-4 py-3 pr-12 border-2 rounded-lg text-base focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all ${
                        form_errors.confirm_password
                          ? 'border-red-500 focus:border-red-500'
                          : form_data.confirm_password && form_data.confirm_password === form_data.password
                          ? 'border-green-500 focus:border-green-500'
                          : 'border-gray-200 focus:border-black'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!show_confirm_password)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {show_confirm_password ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {form_errors.confirm_password && (
                    <p className="mt-2 text-sm text-red-600">{form_errors.confirm_password}</p>
                  )}
                  {!form_errors.confirm_password && form_data.confirm_password && form_data.confirm_password === form_data.password && (
                    <p className="mt-2 text-sm text-green-600 flex items-center">
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Passwords match
                    </p>
                  )}
                </div>

                {/* Phone field (optional) */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-900 mb-2">
                    Phone Number <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form_data.phone}
                    onChange={(e) => update_form_field('phone', e.target.value)}
                    placeholder="+353 87 470 0356"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:ring-4 focus:ring-yellow-100 focus:border-black transition-all"
                  />
                </div>

                {/* Company name field (optional) */}
                <div>
                  <label htmlFor="company_name" className="block text-sm font-semibold text-gray-900 mb-2">
                    Company Name <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <input
                    id="company_name"
                    name="company_name"
                    type="text"
                    value={form_data.company_name}
                    onChange={(e) => update_form_field('company_name', e.target.value)}
                    placeholder="Your Company Ltd."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:ring-4 focus:ring-yellow-100 focus:border-black transition-all"
                  />
                </div>

                {/* Address field (optional) */}
                <div>
                  <label htmlFor="address" className="block text-sm font-semibold text-gray-900 mb-2">
                    Address <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows={3}
                    value={form_data.address}
                    onChange={(e) => update_form_field('address', e.target.value)}
                    placeholder="Street address, city, postal code"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:ring-4 focus:ring-yellow-100 focus:border-black transition-all resize-vertical"
                  />
                </div>

                {/* Terms agreement checkbox */}
                <div>
                  <div className="flex items-start">
                    <input
                      id="terms_agreed"
                      name="terms_agreed"
                      type="checkbox"
                      checked={form_data.terms_agreed}
                      onChange={(e) => update_form_field('terms_agreed', e.target.checked)}
                      onBlur={() => handle_field_blur('terms_agreed')}
                      className={`mt-1 h-5 w-5 rounded border-2 text-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all ${
                        form_errors.terms ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    <label htmlFor="terms_agreed" className="ml-3 text-sm text-gray-700">
                      I agree to the{' '}
                      <Link to="/policies" target="_blank" className="text-black font-semibold hover:text-gray-700 underline">
                        Terms of Service
                      </Link>{' '}
                      <span className="text-red-600">*</span>
                    </label>
                  </div>
                  {form_errors.terms && (
                    <p className="mt-2 text-sm text-red-600">{form_errors.terms}</p>
                  )}
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={is_submitting || isAuthLoading || email_available.is_checking}
                    className="w-full flex justify-center items-center px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {is_submitting || isAuthLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </div>

                {/* Login link */}
                <div className="text-center pt-2">
                  <p className="text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link
                      to={`/login${return_to_path ? `?return_to=${encodeURIComponent(return_to_path)}` : ''}`}
                      className="text-black font-semibold hover:text-gray-700 underline"
                    >
                      Log in
                    </Link>
                  </p>
                </div>
              </form>
            </div>

            {/* Helper text */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                By creating an account, you can request quotes, track orders, and manage your projects.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_AUTH_Register;