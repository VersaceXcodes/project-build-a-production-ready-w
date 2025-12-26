/**
 * PaymentForm - Embedded card payment form using Stripe Elements
 *
 * Use this for inline payment experiences without redirecting to Stripe Checkout.
 * Requires a PaymentIntent client_secret from your backend.
 */

import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

interface PaymentFormProps {
  amount: number;
  currency?: string;
  onSuccess?: (paymentIntent: any) => void;
  onError?: (error: string) => void;
  returnUrl?: string;
  submitButtonText?: string;
  className?: string;
}

/**
 * Embedded payment form with card input
 * Must be wrapped in PaymentProvider with clientSecret
 */
export const PaymentForm: React.FC<PaymentFormProps> = ({
  amount,
  currency = 'usd',
  onSuccess,
  onError,
  returnUrl = `${window.location.origin}/payment/complete`,
  submitButtonText,
  className = '',
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
      redirect: 'if_required',
    });

    if (error) {
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setMessage(error.message || 'Payment failed');
      } else {
        setMessage('An unexpected error occurred.');
      }
      onError?.(error.message || 'Payment failed');
      setIsProcessing(false);
    } else if (paymentIntent) {
      if (paymentIntent.status === 'succeeded') {
        setMessage('Payment successful!');
        onSuccess?.(paymentIntent);
      } else if (paymentIntent.status === 'processing') {
        setMessage('Payment is processing...');
      } else if (paymentIntent.status === 'requires_action') {
        // 3D Secure or other authentication required
        // Stripe will handle the redirect automatically
      }
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      <button
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className={`
          w-full py-3 px-4
          bg-[#635BFF] hover:bg-[#5850e6]
          text-white font-medium rounded-lg
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center
        `}
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </>
        ) : (
          submitButtonText || `Pay ${formatAmount(amount, currency)}`
        )}
      </button>

      {message && (
        <div className={`text-sm text-center ${
          message.includes('successful') ? 'text-green-600' : 'text-red-600'
        }`}>
          {message}
        </div>
      )}
    </form>
  );
};

export default PaymentForm;
