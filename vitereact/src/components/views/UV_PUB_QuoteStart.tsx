import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { FileText, LogIn, UserPlus, ArrowRight, CheckCircle2 } from 'lucide-react';

/**
 * UV_PUB_QuoteStart
 * 
 * Landing page for quote flow with three paths:
 * 1. Continue as Guest (PRIMARY - no account required)
 * 2. Log in (existing customer)
 * 3. Create account (optional)
 */
const UV_PUB_QuoteStart: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);

  // If user is already authenticated, redirect directly to quote wizard
  React.useEffect(() => {
    if (isAuthenticated && currentUser?.role === 'CUSTOMER') {
      navigate('/app/quotes/new');
    }
  }, [isAuthenticated, currentUser, navigate]);

  const handleGuestQuote = () => {
    navigate('/quote/guest/new');
  };

  const handleLogin = () => {
    navigate('/login?returnTo=/app/quotes/new');
  };

  const handleRegister = () => {
    navigate('/register?returnTo=/app/quotes/new');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Get a Quote
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose how you'd like to proceed with your quote request
          </p>
        </div>

        {/* Options Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Option 1: Guest (PRIMARY) */}
          <div className="relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
              <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                RECOMMENDED
              </span>
            </div>
            <button
              onClick={handleGuestQuote}
              className="w-full bg-white rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 border-4 border-green-500 group hover:scale-105"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                  <ArrowRight className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Continue as Guest
                </h3>
                <p className="text-gray-600 mb-6 text-sm">
                  Get a quote instantly without creating an account
                </p>
                <ul className="text-left space-y-2 mb-6">
                  <li className="flex items-start text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>No password required</span>
                  </li>
                  <li className="flex items-start text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Quick and easy</span>
                  </li>
                  <li className="flex items-start text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Email link to track quote</span>
                  </li>
                </ul>
                <div className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold group-hover:bg-green-700 transition-colors">
                  Start Now
                </div>
              </div>
            </button>
          </div>

          {/* Option 2: Login (SECONDARY) */}
          <button
            onClick={handleLogin}
            className="w-full bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border-2 border-gray-200 hover:border-blue-500 group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <LogIn className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Log In
              </h3>
              <p className="text-gray-600 mb-6 text-sm">
                Existing customer? Access your account
              </p>
              <ul className="text-left space-y-2 mb-6">
                <li className="flex items-start text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>View all quotes</span>
                </li>
                <li className="flex items-start text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Track orders</span>
                </li>
                <li className="flex items-start text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Manage bookings</span>
                </li>
              </ul>
              <div className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold group-hover:bg-blue-700 transition-colors">
                Log In
              </div>
            </div>
          </button>

          {/* Option 3: Create Account (TERTIARY) */}
          <button
            onClick={handleRegister}
            className="w-full bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border-2 border-gray-200 hover:border-purple-500 group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                <UserPlus className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Create Account
              </h3>
              <p className="text-gray-600 mb-6 text-sm">
                New customer? Set up an account
              </p>
              <ul className="text-left space-y-2 mb-6">
                <li className="flex items-start text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Save preferences</span>
                </li>
                <li className="flex items-start text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Faster future quotes</span>
                </li>
                <li className="flex items-start text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Order history</span>
                </li>
              </ul>
              <div className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold group-hover:bg-purple-700 transition-colors">
                Sign Up
              </div>
            </div>
          </button>
        </div>

        {/* Helper Text */}
        <div className="text-center">
          <p className="text-sm text-gray-500 max-w-2xl mx-auto">
            <span className="font-semibold">Note:</span> Accounts are only required to manage orders after approval. 
            You can get a quote as a guest and create an account later if you decide to proceed.
          </p>
        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <Link 
            to="/" 
            className="text-blue-600 hover:text-blue-700 font-medium text-sm inline-flex items-center"
          >
            <ArrowRight className="w-4 h-4 mr-1 rotate-180" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UV_PUB_QuoteStart;
