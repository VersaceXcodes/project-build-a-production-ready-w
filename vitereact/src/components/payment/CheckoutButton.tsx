/**
 * CheckoutButton - Simple one-click purchase button
 *
 * Creates a Stripe Checkout session and redirects to Stripe's hosted checkout.
 * Use this for simple product purchases without custom forms.
 */

import React, { useState } from 'react';

interface CheckoutButtonProps {
  priceId: string;
  productName?: string;
  mode?: 'payment' | 'subscription';
  quantity?: number;
  successUrl?: string;
  cancelUrl?: string;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

/**
 * One-click checkout button that redirects to Stripe Checkout
 */
export const CheckoutButton: React.FC<CheckoutButtonProps> = ({
  priceId,
  productName,
  mode = 'payment',
  quantity = 1,
  successUrl = `${window.location.origin}/payment/success`,
  cancelUrl = `${window.location.origin}/payment/cancel`,
  className = '',
  children,
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          mode,
          quantity,
          successUrl,
          cancelUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setIsLoading(false);
    }
  };

  const defaultStyles = `
    inline-flex items-center justify-center px-6 py-3
    bg-[#635BFF] hover:bg-[#5850e6]
    text-white font-medium rounded-lg
    transition-colors duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={disabled || isLoading}
        className={className || defaultStyles}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </>
        ) : (
          children || `Buy ${productName || 'Now'}`
        )}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default CheckoutButton;
