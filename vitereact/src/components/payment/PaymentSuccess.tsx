/**
 * PaymentSuccess - Success confirmation page component
 *
 * Display this after a successful payment to confirm the transaction.
 */

import React, { useEffect, useState } from 'react';

interface PaymentSuccessProps {
  sessionId?: string;
  onContinue?: () => void;
  continueUrl?: string;
  className?: string;
}

interface SessionDetails {
  customerEmail?: string;
  amountTotal?: number;
  currency?: string;
  paymentStatus?: string;
}

/**
 * Payment success confirmation component
 */
export const PaymentSuccess: React.FC<PaymentSuccessProps> = ({
  sessionId,
  onContinue,
  continueUrl = '/',
  className = '',
}) => {
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(!!sessionId);

  useEffect(() => {
    if (sessionId) {
      fetchSessionDetails();
    }
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    try {
      const response = await fetch(`/api/payments/session/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setSessionDetails(data);
      }
    } catch (error) {
      console.error('Failed to fetch session details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else {
      window.location.href = continueUrl;
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <svg className="animate-spin h-8 w-8 text-[#635BFF]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`max-w-md mx-auto text-center p-8 ${className}`}>
      {/* Success Icon */}
      <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Payment Successful!
      </h1>

      <p className="text-gray-600 mb-6">
        Thank you for your purchase. Your payment has been processed successfully.
      </p>

      {sessionDetails && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          {sessionDetails.amountTotal && sessionDetails.currency && (
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Amount</span>
              <span className="font-medium">
                {formatAmount(sessionDetails.amountTotal, sessionDetails.currency)}
              </span>
            </div>
          )}
          {sessionDetails.customerEmail && (
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Email</span>
              <span className="font-medium">{sessionDetails.customerEmail}</span>
            </div>
          )}
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Status</span>
            <span className="font-medium text-green-600">Paid</span>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500 mb-6">
        A confirmation email has been sent to your email address.
      </p>

      <button
        onClick={handleContinue}
        className="w-full py-3 px-4 bg-[#635BFF] hover:bg-[#5850e6] text-white font-medium rounded-lg transition-colors"
      >
        Continue
      </button>
    </div>
  );
};

export default PaymentSuccess;
