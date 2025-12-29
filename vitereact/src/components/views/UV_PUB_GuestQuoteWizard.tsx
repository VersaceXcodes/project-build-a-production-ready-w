import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * UV_PUB_GuestQuoteWizard
 * 
 * Simplified quote wizard for guest users (no authentication required)
 * Will mirror UV_CUST_QuoteWizard but without auth checks
 */
const UV_PUB_GuestQuoteWizard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Guest Quote Wizard (Coming Soon)</h1>
        <p className="text-gray-600 mb-4">
          This component will provide a guest-friendly quote flow without requiring login.
        </p>
        <button
          onClick={() => navigate('/quote/start')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          Back to Quote Start
        </button>
      </div>
    </div>
  );
};

export default UV_PUB_GuestQuoteWizard;
