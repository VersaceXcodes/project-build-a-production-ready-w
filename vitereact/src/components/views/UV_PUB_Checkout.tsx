import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// ===========================
// STRIPE SETUP
// ===========================

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// ===========================
// TYPE DEFINITIONS
// ===========================

interface CartItem {
  id: string;
  product_name: string;
  variant_label: string | null;
  total_price: number | string;
  thumbnail_url: string | null;
}

interface CartResponse {
  cart: { id: string };
  items: CartItem[];
  subtotal: number;
}

interface PrepareCheckoutData {
  cart_id: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  shipping_address?: string;
}

interface PrepareCheckoutResponse {
  order_id: string;
  client_secret: string;
  payment_intent_id: string;
  total_amount: number;
  invoice_number: string;
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchCart = async (guestId: string | null, authToken: string | null): Promise<CartResponse> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const headers: Record<string, string> = {};
  if (guestId) headers['x-guest-id'] = guestId;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  const response = await axios.get<CartResponse>(`${API_BASE_URL}/api/cart`, { headers });
  return response.data;
};

const prepareCheckout = async (
  data: PrepareCheckoutData,
  guestId: string | null,
  authToken: string | null
): Promise<PrepareCheckoutResponse> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (guestId) headers['x-guest-id'] = guestId;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  const response = await axios.post(`${API_BASE_URL}/api/checkout/prepare`, data, { headers });
  return response.data;
};

const finalizeCheckout = async (
  orderId: string,
  paymentIntentId: string,
  guestId: string | null,
  authToken: string | null
): Promise<{ order_id: string; status: string; invoice_number: string; total_amount: number }> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (guestId) headers['x-guest-id'] = guestId;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  const response = await axios.post(`${API_BASE_URL}/api/checkout/finalize`, {
    order_id: orderId,
    payment_intent_id: paymentIntentId
  }, { headers });
  return response.data;
};

// ===========================
// STRIPE PAYMENT FORM
// ===========================

interface StripeCheckoutFormProps {
  formData: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  cartId: string;
  total: number;
  guestId: string | null;
  authToken: string | null;
  onSuccess: (orderId: string) => void;
  onError: (error: string) => void;
  onValidationError: (errors: Record<string, string>) => void;
  isLoggedIn: boolean;
}

const StripeCheckoutForm: React.FC<StripeCheckoutFormProps> = ({
  formData,
  cartId,
  total,
  guestId,
  authToken,
  onSuccess,
  onError,
  onValidationError,
  isLoggedIn
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const handleCardChange = (event: any) => {
    setCardComplete(event.complete);
    if (event.error) {
      setCardError(event.error.message);
    } else {
      setCardError(null);
    }
  };

  // Validate form before payment
  const validateFormData = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!isLoggedIn) {
      if (!formData.name.trim()) errors.name = 'Name is required';
      if (!formData.email.trim()) errors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = 'Invalid email address';
      }
    }
    
    if (!formData.address.trim()) errors.address = 'Shipping address is required';
    
    if (Object.keys(errors).length > 0) {
      onValidationError(errors);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form first
    if (!validateFormData()) {
      return;
    }

    if (!stripe || !elements) {
      onError('Stripe has not loaded. Please refresh the page and try again.');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError('Card element not found. Please refresh the page.');
      return;
    }

    if (!cardComplete) {
      onError('Please complete your card details.');
      return;
    }

    setIsProcessing(true);
    onError(''); // Clear previous errors

    try {
      // STAGE 1: Prepare checkout - creates order with PENDING_PAYMENT status
      const checkoutData: PrepareCheckoutData = {
        cart_id: cartId,
        shipping_address: formData.address,
      };

      if (!isLoggedIn) {
        checkoutData.guest_name = formData.name;
        checkoutData.guest_email = formData.email;
        checkoutData.guest_phone = formData.phone || undefined;
      }

      const prepareResponse = await prepareCheckout(checkoutData, guestId, authToken);
      const { order_id, client_secret, payment_intent_id } = prepareResponse;

      // STAGE 2: Confirm card payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        client_secret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: formData.name,
              email: formData.email,
              phone: formData.phone || undefined,
            },
          },
        }
      );

      if (stripeError) {
        // Payment failed - order remains in PENDING_PAYMENT status
        onError(stripeError.message || 'Payment failed. Please try again.');
        setIsProcessing(false);
        return;
      }

      if (paymentIntent?.status !== 'succeeded') {
        onError('Payment was not successful. Please try again.');
        setIsProcessing(false);
        return;
      }

      // STAGE 3: Finalize order after successful payment
      await finalizeCheckout(order_id, payment_intent_id, guestId, authToken);

      // Clear guest cart ID on success
      if (!authToken) {
        localStorage.removeItem('guest_cart_id');
      }

      // Success! Navigate to confirmation
      onSuccess(order_id);
    } catch (err: any) {
      console.error('Checkout payment error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Payment failed. Please try again.';
      onError(errorMessage);
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Card Element */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Card Details</h2>
        
        <div className={`bg-gray-50 border-2 rounded-lg p-4 transition-colors ${cardError ? 'border-red-500' : cardComplete ? 'border-green-500' : 'border-gray-200'}`}>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#1f2937',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  '::placeholder': {
                    color: '#9ca3af',
                  },
                },
                invalid: {
                  color: '#dc2626',
                },
              },
              hidePostalCode: false,
            }}
            onChange={handleCardChange}
          />
        </div>
        
        {cardError && (
          <p className="text-red-500 text-sm mt-2">{cardError}</p>
        )}
        
        <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>Secured by Stripe - Your payment information is encrypted</span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || isProcessing || !cardComplete}
        className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-black font-bold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing Payment...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Pay ${total.toFixed(2)}
          </>
        )}
      </button>

      <p className="text-xs text-gray-500 text-center mt-4">
        By placing this order, you agree to our Terms and Conditions.
      </p>
    </form>
  );
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_Checkout: React.FC = () => {
  const navigate = useNavigate();
  
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const userProfile = useAppStore(state => state.authentication_state.user_profile);
  const show_toast = useAppStore(state => state.show_toast);
  
  const [guestId] = useState<string | null>(() => localStorage.getItem('guest_cart_id'));
  const [paymentError, setPaymentError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Pre-fill form for logged-in users
  useEffect(() => {
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        name: currentUser.name || '',
        email: currentUser.email || '',
      }));
    }
    if (userProfile && 'phone' in userProfile) {
      setFormData(prev => ({
        ...prev,
        phone: userProfile.phone || '',
        address: userProfile.address || '',
      }));
    }
  }, [currentUser, userProfile]);

  // ===========================
  // DATA FETCHING
  // ===========================

  const { data, isLoading, error } = useQuery({
    queryKey: ['cart', guestId, authToken],
    queryFn: () => fetchCart(guestId, authToken),
    staleTime: 30000,
  });

  const cart = data?.cart;
  const items = data?.items || [];
  const subtotal = data?.subtotal || 0;

  // Redirect if cart is empty
  useEffect(() => {
    if (!isLoading && items.length === 0) {
      show_toast({
        type: 'warning',
        message: 'Your cart is empty',
        duration: 3000,
      });
      navigate('/cart');
    }
  }, [isLoading, items.length, navigate, show_toast]);

  // Calculate totals
  const taxRate = 0.23;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // ===========================
  // FORM HANDLING
  // ===========================

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
    // Clear payment error when form changes
    if (paymentError) {
      setPaymentError(null);
    }
  };

  const handleValidationError = (errors: Record<string, string>) => {
    setFormErrors(errors);
  };

  const handlePaymentSuccess = (orderId: string) => {
    show_toast({
      type: 'success',
      message: 'Payment successful! Your order is confirmed.',
      duration: 5000,
    });
    navigate(`/order-confirmation/${orderId}`);
  };

  const handlePaymentError = (error: string) => {
    setPaymentError(error);
    if (error) {
      show_toast({
        type: 'error',
        message: error,
        duration: 5000,
      });
    }
  };

  // ===========================
  // RENDER
  // ===========================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl p-6 h-96"></div>
              <div className="bg-white rounded-xl p-6 h-64"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/cart" className="text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
        </div>

        {/* Payment Error Banner */}
        {paymentError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-red-800">Payment Failed</p>
              <p className="text-red-700 text-sm mt-1">{paymentError}</p>
              <p className="text-red-600 text-sm mt-2">Please check your card details and try again.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Form */}
          <div className="space-y-6">
            {/* Contact Information */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
              
              {!authToken && (
                <p className="text-sm text-gray-600 mb-4">
                  Already have an account?{' '}
                  <Link to="/login" className="text-yellow-600 hover:underline font-medium">
                    Log in
                  </Link>
                </p>
              )}
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={!!authToken}
                    className={`w-full px-4 py-3 rounded-lg border-2 ${
                      formErrors.name ? 'border-red-500' : 'border-gray-200'
                    } focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 focus:outline-none transition-all disabled:bg-gray-100`}
                    placeholder="John Doe"
                  />
                  {formErrors.name && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={!!authToken}
                    className={`w-full px-4 py-3 rounded-lg border-2 ${
                      formErrors.email ? 'border-red-500' : 'border-gray-200'
                    } focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 focus:outline-none transition-all disabled:bg-gray-100`}
                    placeholder="john@example.com"
                  />
                  {formErrors.email && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 focus:outline-none transition-all"
                    placeholder="+353 1 234 5678"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h2>
              
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Address *
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className={`w-full px-4 py-3 rounded-lg border-2 ${
                    formErrors.address ? 'border-red-500' : 'border-gray-200'
                  } focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 focus:outline-none transition-all resize-none`}
                  placeholder="123 Main Street, Dublin, D01 AB12, Ireland"
                />
                {formErrors.address && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.address}</p>
                )}
              </div>
            </div>

            {/* Stripe Payment Form */}
            {cart && (
              <Elements stripe={stripePromise}>
                <StripeCheckoutForm
                  formData={formData}
                  cartId={cart.id}
                  total={total}
                  guestId={guestId}
                  authToken={authToken}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  onValidationError={handleValidationError}
                  isLoggedIn={!!authToken}
                />
              </Elements>
            )}
          </div>

          {/* Right: Order Summary */}
          <div>
            <div className="bg-white rounded-xl p-6 shadow-sm sticky top-28">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              
              {/* Items */}
              <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {item.thumbnail_url ? (
                        <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.product_name}</p>
                      {item.variant_label && (
                        <p className="text-xs text-gray-500">{item.variant_label}</p>
                      )}
                      <p className="text-sm font-semibold text-gray-900 mt-1">${Number(item.total_price).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>VAT (23%)</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery</span>
                  <span className="text-green-600">FREE</span>
                </div>
                <div className="border-t pt-3 flex justify-between text-xl font-bold text-gray-900">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">STRIPE</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Secure Payment</p>
                    <p className="text-xs text-gray-500">Your card will be charged ${total.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UV_PUB_Checkout;
