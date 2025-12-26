import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

interface FormData {
  password: string;
  confirm_password: string;
}

interface FormErrors {
  password: string | null;
  confirm_password: string | null;
  general: string | null;
}

interface PasswordStrength {
  score: number; // 0-4
  feedback: string;
  meets_requirements: boolean;
}

const UV_AUTH_ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract token from URL
  const [reset_token] = useState<string>(searchParams.get('token') || '');

  // Form state
  const [form_data, set_form_data] = useState<FormData>({
    password: '',
    confirm_password: '',
  });

  const [form_errors, set_form_errors] = useState<FormErrors>({
    password: null,
    confirm_password: null,
    general: null,
  });

  // Token validation state
  const [token_valid, set_token_valid] = useState<boolean | null>(null);

  // Submission state
  const [is_submitting, set_is_submitting] = useState<boolean>(false);
  const [reset_complete, set_reset_complete] = useState<boolean>(false);

  // Password strength state
  const [password_strength, set_password_strength] = useState<PasswordStrength>({
    score: 0,
    feedback: '',
    meets_requirements: false,
  });

  // Show/hide password toggle
  const [show_password, set_show_password] = useState<boolean>(false);

  // Validate token on mount
  useEffect(() => {
    if (!reset_token) {
      set_token_valid(false);
      set_form_errors((prev) => ({
        ...prev,
        general: 'No reset token provided. Please request a new password reset link.',
      }));
    } else {
      // Token will be validated on submission attempt
      // Set to null initially (unknown state)
      set_token_valid(null);
    }
  }, [reset_token]);

  // Calculate password strength in real-time
  useEffect(() => {
    if (!form_data.password) {
      set_password_strength({
        score: 0,
        feedback: '',
        meets_requirements: false,
      });
      return;
    }

    const password = form_data.password;
    let score = 0;
    const requirements: string[] = [];
    const failures: string[] = [];

    // Check length (minimum 8)
    if (password.length >= 8) {
      score += 1;
      requirements.push('8+ characters');
    } else {
      failures.push('Need 8+ characters');
    }

    // Check for uppercase
    if (/[A-Z]/.test(password)) {
      score += 1;
      requirements.push('uppercase letter');
    } else {
      failures.push('Need uppercase letter');
    }

    // Check for number
    if (/[0-9]/.test(password)) {
      score += 1;
      requirements.push('number');
    } else {
      failures.push('Need number');
    }

    // Check for special character
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
      requirements.push('special character');
    } else {
      failures.push('Need special character');
    }

    const meets_requirements = password.length >= 8;
    let feedback = '';

    if (score === 0) {
      feedback = 'Very weak';
    } else if (score === 1) {
      feedback = 'Weak';
    } else if (score === 2) {
      feedback = 'Fair';
    } else if (score === 3) {
      feedback = 'Good';
    } else {
      feedback = 'Strong';
    }

    if (failures.length > 0) {
      feedback += ` - ${failures.join(', ')}`;
    }

    set_password_strength({
      score,
      feedback,
      meets_requirements,
    });

    // Clear password error when user types
    if (form_errors.password) {
      set_form_errors((prev) => ({ ...prev, password: null }));
    }
  }, [form_data.password]);

  // Validate password match on confirm password change
  useEffect(() => {
    if (form_data.confirm_password && form_data.password !== form_data.confirm_password) {
      set_form_errors((prev) => ({
        ...prev,
        confirm_password: 'Passwords do not match',
      }));
    } else if (form_errors.confirm_password) {
      set_form_errors((prev) => ({ ...prev, confirm_password: null }));
    }
  }, [form_data.confirm_password, form_data.password]);

  const handle_password_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    set_form_data((prev) => ({ ...prev, password: e.target.value }));
  };

  const handle_confirm_password_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    set_form_data((prev) => ({ ...prev, confirm_password: e.target.value }));
  };

  const validate_form = (): boolean => {
    const errors: FormErrors = {
      password: null,
      confirm_password: null,
      general: null,
    };

    // Validate password
    if (!form_data.password) {
      errors.password = 'Password is required';
    } else if (form_data.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!password_strength.meets_requirements) {
      errors.password = 'Password does not meet minimum requirements';
    }

    // Validate confirm password
    if (!form_data.confirm_password) {
      errors.confirm_password = 'Please confirm your password';
    } else if (form_data.password !== form_data.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }

    set_form_errors(errors);

    return errors.password === null && errors.confirm_password === null;
  };

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    set_form_errors({
      password: null,
      confirm_password: null,
      general: null,
    });

    // Validate form
    if (!validate_form()) {
      return;
    }

    set_is_submitting(true);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      
      const response = await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        token: reset_token,
        password: form_data.password,
      });

      // Success
      set_reset_complete(true);
      set_token_valid(true);
      set_is_submitting(false);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      set_is_submitting(false);

      const error_message =
        error.response?.data?.message || error.message || 'Password reset failed';

      // Check if error is token-related
      if (
        error_message.includes('token') ||
        error_message.includes('expired') ||
        error_message.includes('Invalid')
      ) {
        set_token_valid(false);
        set_form_errors({
          password: null,
          confirm_password: null,
          general:
            'This reset link is invalid or has expired. Please request a new password reset.',
        });
      } else {
        set_form_errors((prev) => ({
          ...prev,
          general: error_message,
        }));
      }
    }
  };

  // Get strength meter color
  const get_strength_color = () => {
    if (password_strength.score === 0) return 'bg-gray-200';
    if (password_strength.score === 1) return 'bg-red-500';
    if (password_strength.score === 2) return 'bg-yellow-500';
    if (password_strength.score === 3) return 'bg-blue-500';
    return 'bg-green-500';
  };

  // Get strength meter width
  const get_strength_width = () => {
    return `${(password_strength.score / 4) * 100}%`;
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Reset Your Password</h2>
            <p className="mt-2 text-gray-600">
              Create a new password for your account
            </p>
          </div>

          {/* Success State */}
          {reset_complete && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <svg
                    className="h-8 w-8 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Password Reset Successfully!
                </h3>
                <p className="text-gray-600 mb-6">
                  Your password has been updated. You can now log in with your new password.
                </p>
                <p className="text-sm text-gray-500">
                  Redirecting to login page in 3 seconds...
                </p>
                <Link
                  to="/login"
                  className="mt-4 inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Login Now
                </Link>
              </div>
            </div>
          )}

          {/* Invalid Token State */}
          {!reset_complete && token_valid === false && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                  <svg
                    className="h-8 w-8 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Invalid Reset Link
                </h3>
                <p className="text-gray-600 mb-6">
                  {form_errors.general || 'This password reset link is invalid or has expired.'}
                </p>
                <Link
                  to="/forgot-password"
                  className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Request New Reset Link
                </Link>
              </div>
            </div>
          )}

          {/* Password Reset Form */}
          {!reset_complete && (token_valid === true || token_valid === null) && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
              <form onSubmit={handle_submit} className="space-y-6">
                {/* General Error Message */}
                {form_errors.general && (token_valid === true || token_valid === null) && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <p className="text-sm">{form_errors.general}</p>
                  </div>
                )}

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={show_password ? 'text' : 'password'}
                      required
                      value={form_data.password}
                      onChange={handle_password_change}
                      placeholder="Enter new password"
                      className={`block w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all ${
                        form_errors.password
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-gray-200 focus:border-blue-500'
                      }`}
                      disabled={is_submitting}
                    />
                    <button
                      type="button"
                      onClick={() => set_show_password(!show_password)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      tabIndex={-1}
                    >
                      {show_password ? (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {form_data.password && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">Password Strength:</span>
                        <span
                          className={`text-xs font-semibold ${
                            password_strength.score === 0
                              ? 'text-gray-500'
                              : password_strength.score === 1
                              ? 'text-red-600'
                              : password_strength.score === 2
                              ? 'text-yellow-600'
                              : password_strength.score === 3
                              ? 'text-blue-600'
                              : 'text-green-600'
                          }`}
                        >
                          {password_strength.feedback}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${get_strength_color()}`}
                          style={{ width: get_strength_width() }}
                        />
                      </div>
                      <p className="text-xs text-gray-600">
                        Min 8 chars. Recommended: uppercase, number, special character
                      </p>
                    </div>
                  )}

                  {/* Password Error */}
                  {form_errors.password && (
                    <p className="mt-2 text-sm text-red-600">{form_errors.password}</p>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label
                    htmlFor="confirm_password"
                    className="block text-sm font-medium text-gray-900 mb-2"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirm_password"
                    name="confirm_password"
                    type={show_password ? 'text' : 'password'}
                    required
                    value={form_data.confirm_password}
                    onChange={handle_confirm_password_change}
                    placeholder="Re-enter new password"
                    className={`block w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all ${
                      form_errors.confirm_password
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-gray-200 focus:border-blue-500'
                    }`}
                    disabled={is_submitting}
                  />

                  {/* Confirm Password Error */}
                  {form_errors.confirm_password && (
                    <p className="mt-2 text-sm text-red-600">{form_errors.confirm_password}</p>
                  )}

                  {/* Match Confirmation */}
                  {form_data.confirm_password &&
                    form_data.password === form_data.confirm_password && (
                      <p className="mt-2 text-sm text-green-600 flex items-center">
                        <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Passwords match
                      </p>
                    )}
                </div>

                {/* Submit Button */}
                <div>
                  <button
                    type="submit"
                    disabled={
                      is_submitting ||
                      !form_data.password ||
                      !form_data.confirm_password ||
                      !password_strength.meets_requirements ||
                      form_data.password !== form_data.confirm_password
                    }
                    className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-black bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {is_submitting ? (
                      <span className="flex items-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-5 w-5 text-black"
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
                        Resetting Password...
                      </span>
                    ) : (
                      'Reset Password'
                    )}
                  </button>
                </div>

                {/* Link to Login */}
                <div className="text-center">
                  <Link
                    to="/login"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
                  >
                    Back to Login
                  </Link>
                </div>
              </form>
            </div>
          )}

          {/* Help Text */}
          {!reset_complete && (token_valid === true || token_valid === null) && (
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Make sure your password is strong and unique. Don't reuse passwords from other
                accounts.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_AUTH_ResetPassword;