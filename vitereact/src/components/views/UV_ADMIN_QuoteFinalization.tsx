import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Quote {
  id: string;
  customer_id: string;
  service_id: string;
  tier_id: string;
  status: 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  estimate_subtotal: number | null;
  final_subtotal: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface QuoteAnswer {
  id: string;
  quote_id: string;
  option_key: string;
  value: string;
  created_at: string;
}

interface Service {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  requires_booking: boolean;
  requires_proof: boolean;
  is_top_seller: boolean;
  is_active: boolean;
  slot_duration_hours: number;
  created_at: string;
  updated_at: string;
}

interface TierPackage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Upload {
  id: string;
  owner_user_id: string;
  quote_id: string | null;
  order_id: string | null;
  file_url: string;
  file_type: string;
  file_name: string;
  file_size_bytes: number;
  dpi_warning: boolean;
  created_at: string;
}

interface MessageThread {
  id: string;
  quote_id: string | null;
  order_id: string | null;
  created_at: string;
}

interface QuoteDetailsResponse {
  quote: Quote;
  service: Service;
  tier: TierPackage;
  quote_answers: QuoteAnswer[];
  uploads: Upload[];
  message_thread: MessageThread | null;
}

interface FinalizeQuotePayload {
  final_subtotal: number;
  notes: string | null;
}

interface SendMessagePayload {
  body: string;
}

// ===========================
// API FUNCTIONS
// ===========================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const fetchQuoteDetails = async (quote_id: string, auth_token: string): Promise<QuoteDetailsResponse> => {
  const response = await axios.get(`${API_BASE_URL}/api/quotes/${quote_id}`, {
    headers: { Authorization: `Bearer ${auth_token}` }
  });
  return response.data;
};

const fetchCustomerInfo = async (customer_id: string, auth_token: string): Promise<Customer> => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/users?search=${customer_id}`, {
    headers: { Authorization: `Bearer ${auth_token}` }
  });
  // Find the specific user from the list
  const user = response.data.users?.find((u: any) => u.user?.id === customer_id);
  return user?.user || null;
};

const finalizeQuote = async (quote_id: string, payload: FinalizeQuotePayload, auth_token: string) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/admin/quotes/${quote_id}/finalize`,
    payload,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
  return response.data;
};

const sendInfoRequestMessage = async (thread_id: string, payload: SendMessagePayload, auth_token: string) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/message-threads/${thread_id}/messages`,
    payload,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
  return response.data;
};

// ===========================
// UTILITY FUNCTIONS
// ===========================

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const parseQuoteAnswerValue = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_ADMIN_QuoteFinalization: React.FC = () => {
  const { quote_id } = useParams<{ quote_id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // CRITICAL: Individual selectors only
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const show_toast = useAppStore(state => state.show_toast);

  // Local state for pricing form
  const [pricing_form, set_pricing_form] = useState({
    final_subtotal: null as number | null,
    tax_rate: 0.23,
    tax_amount: 0,
    total_amount: 0,
    notes: ''
  });

  const [info_request_message, set_info_request_message] = useState('');
  const [show_success_state, set_show_success_state] = useState(false);
  const [show_info_request_form, set_show_info_request_form] = useState(false);

  // Fetch quote details
  const {
    data: quote_data,
    isLoading: is_loading_quote,
    error: quote_error
  } = useQuery({
    queryKey: ['quote-details', quote_id],
    queryFn: () => fetchQuoteDetails(quote_id!, auth_token!),
    enabled: !!quote_id && !!auth_token,
    staleTime: 30000,
    refetchOnWindowFocus: false
  });

  // Fetch customer info separately
  const {
    data: customer_info,
    isLoading: is_loading_customer
  } = useQuery({
    queryKey: ['customer-info', quote_data?.quote.customer_id],
    queryFn: () => fetchCustomerInfo(quote_data!.quote.customer_id, auth_token!),
    enabled: !!quote_data?.quote.customer_id && !!auth_token,
    staleTime: 60000
  });

  // Finalize quote mutation
  const finalize_mutation = useMutation({
    mutationFn: (payload: FinalizeQuotePayload) => finalizeQuote(quote_id!, payload, auth_token!),
    onSuccess: (data) => {
      show_toast({
        type: 'success',
        message: 'Quote finalized successfully! Customer has been notified.',
        duration: 5000
      });
      queryClient.invalidateQueries({ queryKey: ['quote-details', quote_id] });
      set_show_success_state(true);
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to finalize quote',
        duration: 5000
      });
    }
  });

  // Send info request mutation
  const info_request_mutation = useMutation({
    mutationFn: (payload: SendMessagePayload) => 
      sendInfoRequestMessage(quote_data!.message_thread!.id, payload, auth_token!),
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Information request sent to customer',
        duration: 5000
      });
      set_info_request_message('');
      set_show_info_request_form(false);
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to send message',
        duration: 5000
      });
    }
  });

  // Auto-fill pricing form with estimate when quote data loads
  useEffect(() => {
    if (quote_data?.quote && pricing_form.final_subtotal === null) {
      const estimate = Number(quote_data.quote.estimate_subtotal || quote_data.quote.final_subtotal || 0);
      const tax_amount = estimate * pricing_form.tax_rate;
      const total_amount = estimate + tax_amount;

      set_pricing_form(prev => ({
        ...prev,
        final_subtotal: estimate,
        tax_amount: Number((tax_amount || 0).toFixed(2)),
        total_amount: Number((total_amount || 0).toFixed(2)),
        notes: quote_data.quote.notes || ''
      }));
    }
  }, [quote_data]);

  // Recalculate tax and total when final_subtotal changes
  const update_final_subtotal = (value: string) => {
    const subtotal = parseFloat(value) || 0;
    const tax_amount = subtotal * pricing_form.tax_rate;
    const total_amount = subtotal + tax_amount;

    set_pricing_form(prev => ({
      ...prev,
      final_subtotal: subtotal,
      tax_amount: Number((tax_amount || 0).toFixed(2)),
      total_amount: Number((total_amount || 0).toFixed(2))
    }));
  };

  const handle_finalize_quote = () => {
    if (!pricing_form.final_subtotal || pricing_form.final_subtotal <= 0) {
      show_toast({
        type: 'error',
        message: 'Please enter a valid final price',
        duration: 5000
      });
      return;
    }

    finalize_mutation.mutate({
      final_subtotal: pricing_form.final_subtotal,
      notes: pricing_form.notes || null
    });
  };

  const handle_send_info_request = () => {
    if (!info_request_message.trim()) {
      show_toast({
        type: 'error',
        message: 'Please enter a message',
        duration: 3000
      });
      return;
    }

    if (!quote_data?.message_thread) {
      show_toast({
        type: 'error',
        message: 'No message thread found for this quote',
        duration: 3000
      });
      return;
    }

    info_request_mutation.mutate({ body: info_request_message });
  };

  const download_file = (file: Upload) => {
    window.open(`${API_BASE_URL}${file.file_url}`, '_blank');
  };

  // Status badge colors
  const get_status_color = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'bg-gray-200 text-gray-800';
      case 'IN_REVIEW': return 'bg-yellow-200 text-yellow-800';
      case 'APPROVED': return 'bg-green-200 text-green-800';
      case 'REJECTED': return 'bg-red-200 text-red-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  if (is_loading_quote || is_loading_customer) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <svg className="animate-spin h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600 text-lg">Loading quote details...</p>
          </div>
        </div>
      </>
    );
  }

  if (quote_error) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Error Loading Quote</h3>
            <p className="text-gray-600 text-center mb-6">
              {(quote_error as any)?.response?.data?.message || 'Quote not found or access denied'}
            </p>
            <Link
              to="/admin/quotes"
              className="w-full inline-flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Quotes
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!quote_data) {
    return null;
  }

  const { quote, quote_answers, service, tier, uploads, message_thread } = quote_data;

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  to="/admin/quotes"
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Back to Quotes"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Quote Review & Finalization
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Quote ID: {quote.id.substring(0, 8)}... • Submitted {formatDate(quote.created_at)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${get_status_color(quote.status)}`}>
                  {quote.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Success State */}
        {show_success_state && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-8 text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Quote Finalized Successfully!</h2>
              <p className="text-gray-600 mb-6">
                The customer has been notified and can now proceed to book their appointment.
              </p>
              <div className="flex items-center justify-center space-x-4">
                <Link
                  to="/admin/quotes"
                  className="px-6 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Back to Quotes
                </Link>
                <Link
                  to={`/admin/orders?customer=${customer_info?.email}`}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  View Customer's Orders
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {!show_success_state && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Quote Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Customer Information */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
                  </div>
                  <div className="p-6">
                    {is_loading_customer ? (
                      <div className="flex items-center justify-center py-8">
                        <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : customer_info ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Customer Name</p>
                          <p className="text-base font-semibold text-gray-900">{customer_info.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Email</p>
                          <a 
                            href={`mailto:${customer_info.email}`}
                            className="text-base font-medium text-blue-600 hover:text-blue-800"
                          >
                            {customer_info.email}
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">Customer information not available</p>
                    )}
                  </div>
                </div>

                {/* Service & Tier Details */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Service & Tier Selection</h2>
                  </div>
                  <div className="p-6 space-y-6">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Service</p>
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <p className="text-xl font-bold text-gray-900">{service.name}</p>
                          {service.description && (
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{service.description}</p>
                          )}
                        </div>
                        {service.requires_booking && (
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            Requires Booking
                          </span>
                        )}
                        {service.requires_proof && (
                          <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                            Requires Proof
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                      <p className="text-sm text-gray-500 mb-2">Selected Tier</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-gray-900">{tier.name}</p>
                          {tier.description && (
                            <p className="text-sm text-gray-600 mt-1">{tier.description}</p>
                          )}
                        </div>
                        <span className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 text-sm font-bold rounded-lg">
                          {tier.name} Tier
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Project Details */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Project Specifications</h2>
                  </div>
                  <div className="p-6">
                    {quote_answers.length > 0 ? (
                      <dl className="space-y-4">
                        {quote_answers.map((answer) => {
                          const parsed_value = parseQuoteAnswerValue(answer.value);
                          const display_value = typeof parsed_value === 'object' 
                            ? JSON.stringify(parsed_value, null, 2)
                            : String(parsed_value);

                          return (
                            <div key={answer.id} className="flex flex-col space-y-1">
                              <dt className="text-sm font-medium text-gray-500 capitalize">
                                {answer.option_key.replace(/_/g, ' ')}
                              </dt>
                              <dd className="text-base text-gray-900 font-semibold">
                                {display_value}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    ) : (
                      <p className="text-gray-500 italic">No project specifications provided</p>
                    )}
                  </div>
                </div>

                {/* Uploaded Files */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Customer Files ({uploads.length})</h2>
                  </div>
                  <div className="p-6">
                    {uploads.length > 0 ? (
                      <div className="space-y-3">
                        {uploads.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="flex-shrink-0">
                                {file.file_type.startsWith('image/') ? (
                                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <p className="text-xs text-gray-500">{formatFileSize(file.file_size_bytes)}</p>
                                  <span className="text-gray-400">•</span>
                                  <p className="text-xs text-gray-500 uppercase">{file.file_type.split('/')[1]}</p>
                                  {file.dpi_warning && (
                                    <>
                                      <span className="text-gray-400">•</span>
                                      <span className="inline-flex items-center text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                                        ⚠ DPI Warning
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => download_file(file)}
                              className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                            >
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-gray-500">No files uploaded by customer</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Pricing & Actions */}
              <div className="lg:col-span-1 space-y-6">
                {/* Pricing Form */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden sticky top-6">
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-400 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Finalize Pricing</h2>
                  </div>
                  <div className="p-6 space-y-6">
                    {/* Estimate Reference */}
                    {quote.estimate_subtotal && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-xs text-blue-700 font-medium mb-1">ESTIMATED SUBTOTAL</p>
                        <p className="text-2xl font-bold text-blue-900">
                          €{Number(quote.estimate_subtotal || 0).toFixed(2)}
                        </p>
                      </div>
                    )}

                    {/* Final Subtotal Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Final Subtotal (Before Tax) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">€</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pricing_form.final_subtotal || ''}
                          onChange={(e) => update_final_subtotal(e.target.value)}
                          className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-lg font-semibold transition-all"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Tax Rate Display */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Tax Rate</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {(pricing_form.tax_rate * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Tax Amount</span>
                        <span className="text-sm font-semibold text-gray-900">
                          €{Number(pricing_form.tax_amount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="border-t border-gray-300 pt-3 mt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-gray-900">Total Amount</span>
                          <span className="text-xl font-bold text-gray-900">
                            €{Number(pricing_form.total_amount || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Internal Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Internal Notes (Optional)
                      </label>
                      <textarea
                        value={pricing_form.notes}
                        onChange={(e) => set_pricing_form(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 resize-none transition-all"
                        placeholder="Add any internal notes about this quote..."
                      />
                    </div>

                    {/* Deposit Info */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                      <p className="text-xs text-green-700 font-medium">DEPOSIT REQUIRED (50%)</p>
                      <p className="text-lg font-bold text-green-900">
                        €{(Number(pricing_form.total_amount || 0) * 0.5).toFixed(2)}
                      </p>
                      <p className="text-xs text-green-700">
                        Balance due: €{(Number(pricing_form.total_amount || 0) * 0.5).toFixed(2)}
                      </p>
                    </div>

                    {/* Finalize Button */}
                    <button
                      onClick={handle_finalize_quote}
                      disabled={finalize_mutation.isPending || !pricing_form.final_subtotal || pricing_form.final_subtotal <= 0}
                      className="w-full px-6 py-4 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 rounded-lg hover:from-yellow-500 hover:to-amber-500 transition-all font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                    >
                      {finalize_mutation.isPending ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Finalizing Quote...
                        </span>
                      ) : (
                        'Finalize Quote & Create Invoice'
                      )}
                    </button>

                    {/* Request Info Button */}
                    <button
                      onClick={() => set_show_info_request_form(!show_info_request_form)}
                      disabled={!message_thread}
                      className="w-full px-4 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors font-medium border-2 border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {show_info_request_form ? 'Cancel Info Request' : 'Request More Information'}
                    </button>

                    {/* Info Request Form */}
                    {show_info_request_form && message_thread && (
                      <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Message to Customer
                        </label>
                        <textarea
                          value={info_request_message}
                          onChange={(e) => set_info_request_message(e.target.value)}
                          rows={4}
                          maxLength={1000}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 resize-none transition-all"
                          placeholder="Please provide additional information about..."
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {info_request_message.length} / 1000 characters
                          </span>
                          <button
                            onClick={handle_send_info_request}
                            disabled={info_request_mutation.isPending || !info_request_message.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {info_request_mutation.isPending ? (
                              <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Sending...
                              </span>
                            ) : (
                              'Send Request'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Existing Notes */}
                {quote.notes && (
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">Customer Notes</h2>
                    </div>
                    <div className="p-6">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_ADMIN_QuoteFinalization;