/**
 * PaymentProvider - Stripe Elements wrapper for the application
 *
 * Wraps the app with Stripe's Elements provider to enable payment components.
 * Requires VITE_STRIPE_PUBLISHABLE_KEY in environment variables.
 */

import React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Initialize Stripe with publishable key from environment
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

interface PaymentProviderProps {
  children: React.ReactNode;
  clientSecret?: string;
}

/**
 * Wraps children with Stripe Elements provider
 * If no publishable key is configured, children are rendered without Stripe context
 */
export const PaymentProvider: React.FC<PaymentProviderProps> = ({
  children,
  clientSecret,
}) => {
  if (!stripePromise) {
    console.warn('Stripe publishable key not configured. Payment features will be disabled.');
    return <>{children}</>;
  }

  const options = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: 'stripe' as const,
          variables: {
            colorPrimary: '#635BFF',
            colorBackground: '#ffffff',
            colorText: '#30313d',
            colorDanger: '#df1b41',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '8px',
          },
        },
      }
    : undefined;

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
};

export default PaymentProvider;
