import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Stripe publishable key (should be in env vars)
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Order {
  id: string;
  quote_id: string;
  customer_id: string;
  tier_id: string;
  status: string;
  total_subtotal: number;
  tax_amount: number;
  total_amount: number;
  deposit_pct: number;
  deposit_amount: number;
  created_at: string;
  updated_at: string;
}

interface Booking {
  id: string;
  quote_id: string;
  customer_id: string;
  start_at: string;
  end_at: string;
  status: string;
  is_emergency: boolean;
  urgent_fee_pct: number;
  created_at: string;
  updated_at: string;
}

interface Service {
  id: string;
  name: string;
}

interface TierPackage {
  id: string;
  name: string;
}

interface OrderDetailResponse {
  order: Order;
  booking: Booking | null;
  service: Service;
  tier: TierPackage;
}

interface PaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
}

interface PaymentRecordResponse {
  id: string;
  order_id: string;
  amount: number;
  status: string;
}

// ===========================
// STRIPE PAYMENT FORM (NESTED COMPONENT)
// ===========================

const StripePaymentForm: React.FC<{
  depositAmount: number;
  orderId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}> = ({ depositAmount, orderId, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  // CRITICAL: Individual selectors
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const showToast = useAppStore(state => state.show_toast);

  const createPaymentIntentMutation = useMutation<PaymentIntentResponse, Error, void>({
    mutationFn: async () => {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/payments/stripe/create-intent`,
        {
          order_id: orderId,
          amount: depositAmount,
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      onError('Stripe has not loaded. Please try again.');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError('Card element not found');
      return;
    }

    setIsProcessing(true);
    onError(''); // Clear previous errors

    try {
      // Create payment intent
      const { client_secret } = await createPaymentIntentMutation.mutateAsync();

      // Confirm card payment
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        client_secret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (stripeError) {
        onError(stripeError.message || 'Payment failed');
        showToast({
          type: 'error',
          message: stripeError.message || 'Payment failed',
          duration: 5000,
        });
        setIsProcessing(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        showToast({
          type: 'success',
          message: 'Payment successful! Your order is confirmed.',
          duration: 5000,
        });
        onSuccess();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Payment failed';
      onError(errorMessage);
      showToast({
        type: 'error',
        message: errorMessage,
        duration: 5000,
      });
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6 focus-within:border-blue-500 transition-colors">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#000000',
                '::placeholder': {
                  color: '#9CA3AF',
                },
              },
              invalid: {
                color: '#DC2626',
              },
            },
            hidePostalCode: false,
          }}
        />
      </div>

      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span>Secured by Stripe - Your payment information is encrypted</span>
      </div>

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-yellow-400 text-black font-semibold py-4 px-6 rounded-lg hover:bg-yellow-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing Payment...
          </span>
        ) : (
          `Pay €${Number(depositAmount || 0).toFixed(2)}`
        )}
      </button>

      <p className="text-sm text-gray-600 text-center">
        You will be charged €{Number(depositAmount || 0).toFixed(2)} today. Balance due before delivery.
      </p>
    </form>
  );
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_CUST_DepositPayment: React.FC = () => {
  const { order_id } = useParams<{ order_id: string }>();
  const navigate = useNavigate();

  // CRITICAL: Individual selectors (NO object destructuring)
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);

  // Local state
  const [paymentMethod, setPaymentMethod] = useState<'STRIPE' | 'CHECK'>('STRIPE');
  const [paymentReference, setPaymentReference] = useState('');
  const [hasConfirmedManual, setHasConfirmedManual] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showOrderSummary, setShowOrderSummary] = useState(true);

  // ===========================
  // FETCH ORDER DETAILS
  // ===========================

  const {
    data: orderData,
    isLoading: isLoadingOrder,
    error: orderError,
  } = useQuery<OrderDetailResponse, Error>({
    queryKey: ['order-detail', order_id],
    queryFn: async () => {
      if (!order_id) throw new Error('Order ID is required');

      const { data } = await axios.get<OrderDetailResponse>(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${order_id}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      return data;
    },
    enabled: !!order_id && !!authToken,
    staleTime: 60000, // 1 minute
    retry: 1,
  });

  // ===========================
  // MANUAL PAYMENT MUTATION
  // ===========================

  const recordManualPaymentMutation = useMutation<PaymentRecordResponse, Error, { reference: string }>({
    mutationFn: async ({ reference }) => {
      if (!order_id || !orderData?.order) throw new Error('Order not found');

      const { data } = await axios.post<PaymentRecordResponse>(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${order_id}/payments`,
        {
          amount: orderData.order.deposit_amount,
          method: 'CHECK',
          transaction_ref: reference || null,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return data;
    },
    onSuccess: () => {
      showToast({
        type: 'success',
        message: 'Thank you. We\'ll verify your payment within 1 business day.',
        duration: 5000,
      });

      // Navigate to order detail
      navigate(`/app/orders/${order_id}`);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to record payment';
      setPaymentError(errorMessage);
      showToast({
        type: 'error',
        message: errorMessage,
        duration: 5000,
      });
    },
  });

  // ===========================
  // HANDLERS
  // ===========================

  const handleManualPaymentSubmit = () => {
    if (!hasConfirmedManual) {
      setPaymentError('Please confirm that you have made the payment');
      return;
    }

    recordManualPaymentMutation.mutate({ reference: paymentReference });
  };

  const handleStripeSuccess = () => {
    navigate(`/app/orders/${order_id}`);
  };

  const handleStripeError = (error: string) => {
    setPaymentError(error);
  };

  // ===========================
  // CALCULATED VALUES
  // ===========================

  const order = orderData?.order;
  const booking = orderData?.booking;
  const service = orderData?.service;
  const tier = orderData?.tier;

  const emergencyFee = booking?.is_emergency 
    ? Number(order?.total_subtotal || 0) * Number(booking.urgent_fee_pct || 0) / 100
    : 0;

  const subtotalWithFee = Number(order?.total_subtotal || 0) + emergencyFee;
  const taxAmount = Number(order?.tax_amount || 0);
  const totalAmount = Number(order?.total_amount || 0) + emergencyFee;
  const depositAmount = Number(order?.deposit_amount || 0) + (emergencyFee * (Number(order?.deposit_pct || 50) / 100));
  const balanceAmount = totalAmount - depositAmount;

  // Bank details (hardcoded per requirements, could be from settings)
  const bankDetails = {
    bankName: 'AIB Bank',
    accountNumber: '12345678',
    iban: 'IE29AIBK93115212345678',
    bic: 'AIBKIE2D',
    reference: `ORD-${order_id?.slice(-8) || ''}`,
  };

  // ===========================
  // LOADING & ERROR STATES
  // ===========================

  if (isLoadingOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-gray-700 font-medium">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (orderError || !orderData || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">We couldn't find the order you're trying to pay for.</p>
          <button
            onClick={() => navigate('/app/orders')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200"
          >
            View All Orders
          </button>
        </div>
      </div>
    );
  }

  // Authorization check
  if (order.customer_id !== currentUser?.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don't have permission to view this order.</p>
          <button
            onClick={() => navigate('/app')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate(`/app/orders/${order_id}`)}
              className="text-gray-600 hover:text-gray-900 flex items-center mb-4 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Order
            </button>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Complete Your Deposit</h1>
            <p className="text-gray-700 text-lg">Secure your booking with a deposit payment</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Summary (Left Column on Desktop) */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                {/* Mobile: Collapsible Header */}
                <button
                  onClick={() => setShowOrderSummary(!showOrderSummary)}
                  className="lg:hidden w-full px-6 py-4 flex items-center justify-between bg-gray-50 border-b border-gray-200"
                >
                  <h2 className="text-xl font-bold text-gray-900">Order Summary</h2>
                  <svg
                    className={`w-6 h-6 text-gray-600 transition-transform ${showOrderSummary ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Desktop: Always Visible Header */}
                <div className="hidden lg:block px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">Order Summary</h2>
                </div>

                {/* Summary Content */}
                <div className={`${showOrderSummary ? 'block' : 'hidden'} lg:block px-6 py-6 space-y-4`}>
                  <div>
                    <p className="text-sm text-gray-600">Service</p>
                    <p className="text-lg font-semibold text-gray-900">{service?.name}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Tier</p>
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                      {tier?.name}
                    </div>
                  </div>

                  {booking && (
                    <div>
                      <p className="text-sm text-gray-600">Booking Date</p>
                      <p className="text-base font-medium text-gray-900">
                        {new Date(booking.start_at).toLocaleDateString('en-IE', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(booking.start_at).toLocaleTimeString('en-IE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' - '}
                        {new Date(booking.end_at).toLocaleTimeString('en-IE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  )}

                  {booking?.is_emergency && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-yellow-800">Emergency Booking</p>
                          <p className="text-xs text-yellow-700 mt-1">
                            +{Number(booking.urgent_fee_pct || 0)}% urgent fee applied
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pricing Breakdown */}
                  <div className="border-t border-gray-200 pt-4 space-y-2">
                    <div className="flex justify-between text-gray-700">
                      <span>Subtotal</span>
                      <span>€{Number(order.total_subtotal || 0).toFixed(2)}</span>
                    </div>

                    {emergencyFee > 0 && (
                      <div className="flex justify-between text-yellow-700 font-medium">
                        <span>Emergency Fee (+{Number(booking?.urgent_fee_pct || 0)}%)</span>
                        <span>€{emergencyFee.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-gray-700">
                      <span>Tax (23%)</span>
                      <span>€{taxAmount.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-300">
                      <span>Total Amount</span>
                      <span>€{totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-lg font-semibold text-blue-700 pt-2">
                      <span>Deposit Required (50%)</span>
                      <span>€{depositAmount.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-gray-600">
                      <span>Balance Due</span>
                      <span>€{balanceAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <p className="text-xs text-blue-800">
                      Balance of €{balanceAmount.toFixed(2)} is due before delivery or installation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Section (Right Column on Desktop) */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-6 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900">Payment Method</h2>
                  <p className="text-gray-600 mt-1">Choose how you'd like to pay your deposit</p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Payment Method Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => {
                        setPaymentMethod('STRIPE');
                        setPaymentError(null);
                      }}
                      className={`relative border-2 rounded-lg p-6 text-left transition-all duration-200 ${
                        paymentMethod === 'STRIPE'
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {paymentMethod === 'STRIPE' && (
                        <div className="absolute top-4 right-4">
                          <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center mb-2">
                        <svg className="w-6 h-6 text-gray-700 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <span className="font-semibold text-gray-900">Pay Online with Card</span>
                      </div>
                      <p className="text-sm text-gray-600">Secure payment via Stripe</p>
                    </button>

                    <button
                      onClick={() => {
                        setPaymentMethod('CHECK');
                        setPaymentError(null);
                      }}
                      className={`relative border-2 rounded-lg p-6 text-left transition-all duration-200 ${
                        paymentMethod === 'CHECK'
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {paymentMethod === 'CHECK' && (
                        <div className="absolute top-4 right-4">
                          <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center mb-2">
                        <svg className="w-6 h-6 text-gray-700 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                        </svg>
                        <span className="font-semibold text-gray-900">Manual Payment</span>
                      </div>
                      <p className="text-sm text-gray-600">Bank transfer or cash</p>
                    </button>
                  </div>

                  {/* Error Display */}
                  {paymentError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-red-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-red-800">{paymentError}</p>
                      </div>
                    </div>
                  )}

                  {/* Payment Forms */}
                  {paymentMethod === 'STRIPE' ? (
                    <div className="space-y-6">
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Card Payment</h3>
                        <Elements stripe={stripePromise}>
                          <StripePaymentForm
                            depositAmount={depositAmount}
                            orderId={order_id!}
                            onSuccess={handleStripeSuccess}
                            onError={handleStripeError}
                          />
                        </Elements>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Transfer Details</h3>
                        
                        <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 space-y-4">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Bank Name</p>
                            <p className="text-base text-gray-900 font-mono">{bankDetails.bankName}</p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-700">Account Number</p>
                            <p className="text-base text-gray-900 font-mono">{bankDetails.accountNumber}</p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-700">IBAN</p>
                            <p className="text-base text-gray-900 font-mono">{bankDetails.iban}</p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-700">BIC/SWIFT</p>
                            <p className="text-base text-gray-900 font-mono">{bankDetails.bic}</p>
                          </div>
                          
                          <div className="pt-4 border-t border-gray-300">
                            <p className="text-sm font-medium text-gray-700 mb-2">Payment Reference (IMPORTANT)</p>
                            <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-3">
                              <p className="text-lg text-gray-900 font-mono font-bold">{bankDetails.reference}</p>
                            </div>
                            <p className="text-xs text-gray-600 mt-2">
                              Include this reference in your transfer so we can match your payment
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-blue-900 mb-2">Instructions</h4>
                          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                            <li>Make a payment of €{depositAmount.toFixed(2)} to the account above</li>
                            <li>Include the payment reference "{bankDetails.reference}" in the transaction notes</li>
                            <li>Click "I've Made the Payment" below after completing the transfer</li>
                            <li>We'll confirm receipt within 1 business day and start your project</li>
                          </ol>
                        </div>

                        {/* Optional Payment Reference Input */}
                        <div className="mt-6">
                          <label htmlFor="payment-ref" className="block text-sm font-medium text-gray-700 mb-2">
                            Your Payment Reference (Optional)
                          </label>
                          <input
                            type="text"
                            id="payment-ref"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Enter your bank's transaction ID"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          />
                          <p className="text-xs text-gray-600 mt-1">
                            This helps us verify your payment faster
                          </p>
                        </div>

                        {/* Confirmation Checkbox */}
                        <div className="mt-6 flex items-start">
                          <input
                            type="checkbox"
                            id="manual-confirm"
                            checked={hasConfirmedManual}
                            onChange={(e) => {
                              setHasConfirmedManual(e.target.checked);
                              setPaymentError(null);
                            }}
                            className="mt-1 h-5 w-5 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400"
                          />
                          <label htmlFor="manual-confirm" className="ml-3 text-sm text-gray-700">
                            I confirm that I have made a bank transfer of €{depositAmount.toFixed(2)} 
                            to the account above with the reference "{bankDetails.reference}"
                          </label>
                        </div>

                        {/* Submit Button */}
                        <button
                          onClick={handleManualPaymentSubmit}
                          disabled={!hasConfirmedManual || recordManualPaymentMutation.isPending}
                          className="w-full bg-yellow-400 text-black font-semibold py-4 px-6 rounded-lg hover:bg-yellow-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl mt-6"
                        >
                          {recordManualPaymentMutation.isPending ? (
                            <span className="flex items-center justify-center">
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Recording Payment...
                            </span>
                          ) : (
                            "I've Made the Payment"
                          )}
                        </button>

                        <p className="text-xs text-gray-600 text-center mt-4">
                          After submitting, your order status will update to "Awaiting Deposit Confirmation". 
                          We'll verify and start your project within 1 business day.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center space-x-2 text-gray-600 text-sm">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Your payment information is secure and encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_CUST_DepositPayment;