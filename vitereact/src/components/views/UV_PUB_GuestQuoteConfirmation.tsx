import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Mail, FileText } from 'lucide-react';

/**
 * UV_PUB_GuestQuoteConfirmation
 * 
 * Confirmation screen shown after guest submits a quote
 */
const UV_PUB_GuestQuoteConfirmation: React.FC = () => {
  const { quoteId } = useParams<{ quoteId: string }>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
          Quote Request Received!
        </h1>

        <p className="text-lg text-gray-600 text-center mb-8">
          Thank you for your quote request. We've received your information and will respond within 24 hours.
        </p>

        {/* Quote ID */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Quote Reference Number</p>
                <p className="text-xl font-mono font-bold text-gray-900">{quoteId}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Boxes */}
        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg">
            <Mail className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Check Your Email</h3>
              <p className="text-sm text-gray-600">
                We've sent you an email with a secure link to view and approve your quote. 
                No account required!
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg">
            <CheckCircle2 className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">What Happens Next?</h3>
              <p className="text-sm text-gray-600">
                Our team will review your request and provide a detailed quote. 
                You'll be able to approve it directly from the email link.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            to="/"
            className="flex-1 bg-blue-600 text-white text-center py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </Link>
          <Link
            to="/services"
            className="flex-1 bg-white text-blue-600 text-center py-3 px-6 rounded-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-colors"
          >
            Browse Services
          </Link>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-gray-500 text-center mt-8">
          Account creation is only required if you approve the quote and need to book a service or make a payment.
        </p>
      </div>
    </div>
  );
};

export default UV_PUB_GuestQuoteConfirmation;
