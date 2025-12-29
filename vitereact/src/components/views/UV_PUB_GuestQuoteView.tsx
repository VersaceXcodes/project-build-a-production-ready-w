import React from 'react';
import { useParams } from 'react-router-dom';

/**
 * UV_PUB_GuestQuoteView
 * 
 * View quote via magic link (no auth required)
 */
const UV_PUB_GuestQuoteView: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Your Quote</h1>
        <p className="text-gray-600 mb-4">
          Magic Link Token: <code className="bg-gray-100 px-2 py-1 rounded">{token}</code>
        </p>
        <p className="text-gray-600">
          This component will display the quote details and allow approval/rejection via magic link.
        </p>
      </div>
    </div>
  );
};

export default UV_PUB_GuestQuoteView;
