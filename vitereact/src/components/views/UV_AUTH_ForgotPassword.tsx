import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const UV_AUTH_ForgotPassword: React.FC = () => {
  // ===========================
  // LOCAL STATE
  // ===========================
  const [email_input, set_email_input] = useState('');
  const [email_error, set_email_error] = useState<string | null>(null);
  const [is_submitting, set_is_submitting] = useState(false);
  const [submission_complete, set_submission_complete] = useState(false);

  // ===========================
  // VALIDATION
  // ===========================
  const validate_email_format = (): boolean => {
    const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email_input.trim()) {
      set_email_error('Email is required');
      return false;
    }
    
    if (!email_regex.test(email_input)) {
      set_email_error('Please enter a valid email address');
      return false;
    }
    
    set_email_error(null);
    return true;
  };

  // ===========================
  // ACTIONS
  // ===========================
  const request_password_reset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    set_email_error(null);
    
    // Validate email format
    if (!validate_email_format()) {
      return;
    }
    
    // Start submission
    set_is_submitting(true);
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      
      await axios.post(
        `${API_BASE_URL}/api/auth/forgot-password`,
        { email: email_input.trim().toLowerCase() },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // CRITICAL: Always show success message regardless of response
      // This prevents user enumeration attacks
      set_submission_complete(true);
      set_is_submitting(false);
      
    } catch (error: any) {
      console.error('Password reset request error:', error);
      
      // Even on error, show success message for security
      // (Don't reveal whether email exists)
      set_submission_complete(true);
      set_is_submitting(false);
    }
  };

  const handle_email_blur = () => {
    if (email_input.trim()) {
      validate_email_format();
    }
  };

  const handle_email_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    set_email_input(e.target.value);
    // Clear error when user starts typing
    if (email_error) {
      set_email_error(null);
    }
  };

  // ===========================
  // RENDER
  // ===========================
  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          {/* Card Container */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-8 pt-8 pb-6">
              {/* Header Section */}
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 leading-tight">
                  Reset Your Password
                </h2>
                <p className="mt-3 text-base text-gray-600 leading-relaxed">
                  {submission_complete 
                    ? "Check your email for instructions"
                    : "Enter your email address and we'll send you a password reset link"
                  }
                </p>
              </div>

              {/* Success State */}
              {submission_complete ? (
                <div className="text-center space-y-6">
                  {/* Success Icon */}
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                      <svg 
                        className="w-10 h-10 text-green-600" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M5 13l4 4L19 7" 
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Success Message */}
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-green-700">
                      Check Your Email
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      If an account with that email exists, we've sent a password reset link. 
                      The link will expire in 1 hour.
                    </p>
                    <p className="text-sm text-gray-600">
                      Didn't receive the email? Check your spam folder or try again.
                    </p>
                  </div>

                  {/* Back to Login Button */}
                  <div className="pt-4">
                    <Link
                      to="/login"
                      className="w-full inline-block text-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
                    >
                      Back to Login
                    </Link>
                  </div>
                </div>
              ) : (
                /* Form State */
                <form onSubmit={request_password_reset} className="space-y-6">
                  {/* Email Input */}
                  <div>
                    <label 
                      htmlFor="email" 
                      className="block text-sm font-medium text-gray-900 mb-2"
                    >
                      Email Address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email_input}
                      onChange={handle_email_change}
                      onBlur={handle_email_blur}
                      placeholder="your.email@example.com"
                      className={`
                        relative block w-full px-4 py-3 
                        border-2 rounded-lg
                        ${email_error 
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-100' 
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                        }
                        placeholder-gray-400 text-gray-900
                        focus:outline-none focus:ring-4
                        transition-all duration-200
                        text-base
                      `}
                      style={{ fontSize: '16px' }} // Prevent iOS zoom
                      disabled={is_submitting}
                    />
                    
                    {/* Email Error Message */}
                    {email_error && (
                      <p 
                        className="mt-2 text-sm text-red-600 flex items-center"
                        role="alert"
                      >
                        <svg 
                          className="w-4 h-4 mr-1 flex-shrink-0" 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path 
                            fillRule="evenodd" 
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
                            clipRule="evenodd" 
                          />
                        </svg>
                        {email_error}
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div>
                    <button
                      type="submit"
                      disabled={is_submitting}
                      className="
                        w-full flex justify-center items-center
                        px-6 py-3
                        bg-blue-600 text-white font-medium rounded-lg
                        hover:bg-blue-700
                        focus:outline-none focus:ring-4 focus:ring-blue-100
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-all duration-200
                        shadow-lg hover:shadow-xl
                      "
                    >
                      {is_submitting ? (
                        <span className="flex items-center">
                          <svg 
                            className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" 
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
                            />
                            <path 
                              className="opacity-75" 
                              fill="currentColor" 
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Sending Reset Link...
                        </span>
                      ) : (
                        'Send Reset Link'
                      )}
                    </button>
                  </div>

                  {/* Helper Links */}
                  <div className="text-center space-y-3">
                    <Link
                      to="/login"
                      className="block text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      Remember your password? Log in
                    </Link>
                    
                    <Link
                      to="/register"
                      className="block text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Don't have an account? Sign up
                    </Link>
                  </div>
                </form>
              )}
            </div>

            {/* Security Note Footer */}
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center leading-relaxed">
                For your security, password reset links expire in 1 hour and can only be used once.
              </p>
            </div>
          </div>

          {/* Additional Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Need help? Contact us at{' '}
              <a 
                href="mailto:info@sultanstamp.com"
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                info@sultanstamp.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_AUTH_ForgotPassword;