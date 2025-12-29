import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  AlertCircle,
  Loader2,
  Mail,
  Phone,
  Building2,
  Calendar,
  DollarSign,
  Package,
  Shield
} from 'lucide-react';

/**
 * UV_PUB_GuestQuoteView
 * 
 * View and manage quote via magic link (no auth required)
 * Guest can view quote details, see finalized price, and approve/reject
 */
const UV_PUB_GuestQuoteView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);

  // Fetch quote data using magic link token
  const { data, isLoading, error, isError } = useQuery({
    queryKey: ['guest-quote', token],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/guest/quotes/${token}`);
      return response.data;
    },
    retry: false,
    staleTime: 30 * 1000
  });

  // Mutation to update quote status
  const updateStatusMutation = useMutation({
    mutationFn: async (status: 'APPROVED' | 'REJECTED') => {
      const response = await axios.patch(`${API_BASE_URL}/api/guest/quotes/${token}/status`, { status });
      return response.data;
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['guest-quote', token] });
      setShowApproveModal(false);
      setShowRejectModal(false);
      
      setNotification({
        type: 'success',
        message: variables === 'APPROVED' 
          ? 'Quote approved! Check your email for next steps.' 
          : 'Quote rejected. We appreciate your consideration.'
      });
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (error: any) => {
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update quote status'
      });
      setTimeout(() => setNotification(null), 5000);
    }
  });

  // Get status badge styles and info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return { 
          color: 'bg-blue-100 text-blue-800', 
          icon: Clock,
          label: 'Pending Review',
          description: 'Our team is reviewing your quote request'
        };
      case 'IN_REVIEW':
        return { 
          color: 'bg-yellow-100 text-yellow-800', 
          icon: Clock,
          label: 'In Review',
          description: 'We are preparing your quote'
        };
      case 'APPROVED':
        return { 
          color: 'bg-green-100 text-green-800', 
          icon: CheckCircle2,
          label: 'Approved',
          description: 'You have approved this quote'
        };
      case 'REJECTED':
        return { 
          color: 'bg-red-100 text-red-800', 
          icon: XCircle,
          label: 'Rejected',
          description: 'This quote has been declined'
        };
      case 'QUOTE_FINALIZED':
        return { 
          color: 'bg-purple-100 text-purple-800', 
          icon: DollarSign,
          label: 'Quote Ready',
          description: 'Your quote is ready for approval'
        };
      default:
        return { 
          color: 'bg-gray-100 text-gray-800', 
          icon: FileText,
          label: status,
          description: ''
        };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your quote...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    const errorMessage = (error as any)?.response?.status === 410 
      ? 'This link has expired'
      : (error as any)?.response?.status === 404
      ? 'Invalid or expired link'
      : 'Unable to load quote';
      
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Not Valid</h1>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <p className="text-sm text-gray-500 mb-6">
            If you believe this is an error, please contact us or request a new quote.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/quote/start"
              className="flex-1 bg-blue-600 text-white text-center py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              New Quote
            </Link>
            <Link
              to="/contact"
              className="flex-1 bg-white text-blue-600 text-center py-3 px-6 rounded-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { quote, service, tier, quote_answers } = data;
  const statusInfo = getStatusInfo(quote.status);
  const StatusIcon = statusInfo.icon;
  
  // Check if quote can be approved/rejected
  const canTakeAction = quote.status === 'QUOTE_FINALIZED' || quote.status === 'SUBMITTED' || quote.status === 'IN_REVIEW';
  const hasFinalPrice = quote.final_subtotal !== null;

  return (
    <>
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-600 text-white' :
          notification.type === 'error' ? 'bg-red-600 text-white' :
          'bg-blue-600 text-white'
        }`}>
          <div className="flex items-center space-x-3">
            {notification.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
            {notification.type === 'error' && <XCircle className="w-5 h-5" />}
            <p className="font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <Link to="/" className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Link>
            <div className="flex items-center justify-between mt-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Your Quote</h1>
                <p className="text-gray-600 mt-1">Reference: <span className="font-mono">{quote.id.slice(0, 8).toUpperCase()}</span></p>
              </div>
              <div className={`flex items-center px-4 py-2 rounded-full ${statusInfo.color}`}>
                <StatusIcon className="w-5 h-5 mr-2" />
                <span className="font-medium">{statusInfo.label}</span>
              </div>
            </div>
          </div>

          {/* Status Banner */}
          {statusInfo.description && (
            <div className={`mb-6 p-4 rounded-lg ${
              quote.status === 'APPROVED' ? 'bg-green-50 border border-green-200' :
              quote.status === 'REJECTED' ? 'bg-red-50 border border-red-200' :
              quote.status === 'QUOTE_FINALIZED' ? 'bg-purple-50 border border-purple-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
            <div className="flex items-start">
              <StatusIcon className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${
                quote.status === 'APPROVED' ? 'text-green-600' :
                quote.status === 'REJECTED' ? 'text-red-600' :
                quote.status === 'QUOTE_FINALIZED' ? 'text-purple-600' :
                'text-blue-600'
              }`} />
              <div>
                <p className={`font-medium ${
                  quote.status === 'APPROVED' ? 'text-green-900' :
                  quote.status === 'REJECTED' ? 'text-red-900' :
                  quote.status === 'QUOTE_FINALIZED' ? 'text-purple-900' :
                  'text-blue-900'
                }`}>{statusInfo.description}</p>
                {quote.status === 'APPROVED' && (
                  <p className="text-sm text-green-700 mt-1">
                    To proceed with booking and payment, you'll need to create an account.
                  </p>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            
            {/* Left Column - Quote Details */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Service & Tier Card */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-blue-600" />
                  Service Details
                </h2>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-500">Service</p>
                      <p className="text-lg font-semibold text-gray-900">{service?.name || 'N/A'}</p>
                      {service?.description && (
                        <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm text-gray-500">Service Level</p>
                    <p className="text-lg font-semibold text-gray-900">{tier?.name || 'N/A'}</p>
                    {tier?.description && (
                      <p className="text-sm text-gray-600 mt-1">{tier.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Project Details Card */}
              {quote_answers && quote_answers.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-blue-600" />
                    Project Specifications
                  </h2>
                  
                  <dl className="space-y-3">
                    {quote_answers.map((answer: any) => (
                      <div key={answer.id} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                        <dt className="text-gray-600 capitalize">{answer.option_key.replace(/_/g, ' ')}</dt>
                        <dd className="text-gray-900 font-medium">{answer.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Notes */}
              {quote.notes && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Notes</h2>
                  <p className="text-gray-600">{quote.notes}</p>
                </div>
              )}
            </div>

            {/* Right Column - Pricing & Actions */}
            <div className="space-y-6">
              
              {/* Pricing Card */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                  Pricing
                </h2>
                
                {hasFinalPrice ? (
                  <div className="space-y-3">
                    <div className="text-center py-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-700 mb-1">Final Quote Price</p>
                      <p className="text-3xl font-bold text-green-900">${Number(quote.final_subtotal).toFixed(2)}</p>
                      <p className="text-xs text-green-600 mt-1">+ applicable taxes</p>
                    </div>
                    {quote.estimate_subtotal && (
                      <p className="text-sm text-gray-500 text-center">
                        Original estimate: ${Number(quote.estimate_subtotal).toFixed(2)}
                      </p>
                    )}
                  </div>
                ) : quote.estimate_subtotal ? (
                  <div className="space-y-3">
                    <div className="text-center py-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700 mb-1">Estimated Price</p>
                      <p className="text-3xl font-bold text-blue-900">${Number(quote.estimate_subtotal).toFixed(2)}</p>
                      <p className="text-xs text-blue-600 mt-1">Final price pending review</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Price</p>
                    <p className="text-xl font-semibold text-gray-900">Pending Review</p>
                    <p className="text-xs text-gray-500 mt-1">We'll provide pricing within 24 hours</p>
                  </div>
                )}
              </div>

              {/* Contact Info Card */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Information</h2>
                
                <div className="space-y-3">
                  <div className="flex items-center text-gray-600">
                    <Mail className="w-4 h-4 mr-3 text-gray-400" />
                    <span>{quote.guest_email}</span>
                  </div>
                  {quote.guest_phone && (
                    <div className="flex items-center text-gray-600">
                      <Phone className="w-4 h-4 mr-3 text-gray-400" />
                      <span>{quote.guest_phone}</span>
                    </div>
                  )}
                  {quote.guest_company_name && (
                    <div className="flex items-center text-gray-600">
                      <Building2 className="w-4 h-4 mr-3 text-gray-400" />
                      <span>{quote.guest_company_name}</span>
                    </div>
                  )}
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                    <span>Submitted {new Date(quote.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {canTakeAction && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Take Action</h2>
                  
                  {hasFinalPrice ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => setShowApproveModal(true)}
                        disabled={updateStatusMutation.isPending}
                        className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Accept Quote
                      </button>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={updateStatusMutation.isPending}
                        className="w-full bg-white text-red-600 py-3 px-4 rounded-lg font-semibold border-2 border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        <XCircle className="w-5 h-5 mr-2" />
                        Decline Quote
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-yellow-50 rounded-lg">
                      <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                      <p className="text-sm text-yellow-800">
                        We're finalizing your quote. You'll be able to approve or decline once pricing is confirmed.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Already Actioned */}
              {(quote.status === 'APPROVED' || quote.status === 'REJECTED') && (
                <div className={`bg-white rounded-xl shadow-sm p-6 border-2 ${
                  quote.status === 'APPROVED' ? 'border-green-200' : 'border-red-200'
                }`}>
                  {quote.status === 'APPROVED' ? (
                    <div className="text-center">
                      <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
                      <h3 className="font-semibold text-green-900 mb-2">Quote Approved</h3>
                      <p className="text-sm text-green-700 mb-4">
                        Create an account to continue with booking and payment.
                      </p>
                      <Link
                        to={`/register?email=${encodeURIComponent(quote.guest_email)}&name=${encodeURIComponent(quote.guest_name)}&quote=${quote.id}`}
                        className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors inline-flex items-center justify-center"
                      >
                        Create Account to Continue
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center">
                      <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
                      <h3 className="font-semibold text-red-900 mb-2">Quote Declined</h3>
                      <p className="text-sm text-red-700 mb-4">
                        Thank you for considering us. Feel free to request a new quote anytime.
                      </p>
                      <Link
                        to="/quote/start"
                        className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors inline-flex items-center justify-center"
                      >
                        Request New Quote
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Security Note */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start">
                  <Shield className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-600">
                      This is a secure link unique to your quote. Do not share it with others.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Accept Quote?</h2>
              <p className="text-gray-600">
                By accepting, you agree to the quoted price of <strong>${Number(quote.final_subtotal).toFixed(2)}</strong>.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                You'll need to create an account to proceed with booking and payment.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowApproveModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatusMutation.mutate('APPROVED')}
                disabled={updateStatusMutation.isPending}
                className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Accept Quote'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Decline Quote?</h2>
              <p className="text-gray-600">
                Are you sure you want to decline this quote? You can always request a new quote later.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatusMutation.mutate('REJECTED')}
                disabled={updateStatusMutation.isPending}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Decline Quote'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_PUB_GuestQuoteView;
