import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
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
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
  updated_at: Date;
}

interface TierPackage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

interface QuoteAnswer {
  id: string;
  quote_id: string;
  option_key: string;
  value: string;
  created_at: Date;
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
  created_at: Date;
}

interface MessageThread {
  id: string;
  quote_id: string | null;
  order_id: string | null;
  created_at: Date;
}

interface Message {
  id: string;
  thread_id: string;
  sender_user_id: string;
  sender_name?: string;
  sender_role?: string;
  body: string;
  is_read: boolean;
  created_at: Date;
}

interface QuoteDetailResponse {
  quote: Quote;
  service: Service;
  tier: TierPackage;
  quote_answers: QuoteAnswer[];
  uploads: Upload[];
  message_thread: MessageThread | null;
}

interface ThreadMessagesResponse {
  message: Message;
  sender: {
    id: string;
    name: string;
    role: string;
  };
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchQuoteDetail = async (quote_id: string, auth_token: string): Promise<QuoteDetailResponse> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const response = await axios.get(`${API_BASE_URL}/api/quotes/${quote_id}`, {
    headers: {
      'Authorization': `Bearer ${auth_token}`,
    },
  });
  
  // Transform date strings to Date objects
  return {
    quote: {
      ...response.data.quote,
      estimate_subtotal: response.data.quote.estimate_subtotal ? Number(response.data.quote.estimate_subtotal) : null,
      final_subtotal: response.data.quote.final_subtotal ? Number(response.data.quote.final_subtotal) : null,
      created_at: new Date(response.data.quote.created_at),
      updated_at: new Date(response.data.quote.updated_at),
    },
    service: {
      ...response.data.service,
      slot_duration_hours: Number(response.data.service.slot_duration_hours),
      created_at: new Date(response.data.service.created_at),
      updated_at: new Date(response.data.service.updated_at),
    },
    tier: {
      ...response.data.tier,
      sort_order: Number(response.data.tier.sort_order),
      created_at: new Date(response.data.tier.created_at),
      updated_at: new Date(response.data.tier.updated_at),
    },
    quote_answers: response.data.quote_answers.map((qa: any) => ({
      ...qa,
      created_at: new Date(qa.created_at),
    })),
    uploads: response.data.uploads.map((upload: any) => ({
      ...upload,
      file_size_bytes: Number(upload.file_size_bytes),
      created_at: new Date(upload.created_at),
    })),
    message_thread: response.data.message_thread ? {
      ...response.data.message_thread,
      created_at: new Date(response.data.message_thread.created_at),
    } : null,
  };
};

const fetchThreadMessages = async (thread_id: string, auth_token: string): Promise<Message[]> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const response = await axios.get(`${API_BASE_URL}/api/message-threads/${thread_id}/messages`, {
    headers: {
      'Authorization': `Bearer ${auth_token}`,
    },
  });
  
  // Transform response to augmented messages
  return response.data.map((item: any) => ({
    id: item.message?.id || item.id,
    thread_id: item.message?.thread_id || item.thread_id,
    sender_user_id: item.message?.sender_user_id || item.sender_user_id,
    sender_name: item.sender?.name || item.sender_name,
    sender_role: item.sender?.role || item.sender_role,
    body: item.message?.body || item.body,
    is_read: item.message?.is_read ?? item.is_read,
    created_at: new Date(item.message?.created_at || item.created_at),
  }));
};

const sendMessage = async (thread_id: string, body: string, auth_token: string): Promise<Message> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const response = await axios.post(
    `${API_BASE_URL}/api/message-threads/${thread_id}/messages`,
    { body },
    {
      headers: {
        'Authorization': `Bearer ${auth_token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  return {
    ...response.data,
    created_at: new Date(response.data.created_at),
  };
};

// ===========================
// UTILITY FUNCTIONS
// ===========================

const formatDate = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  } else if (days === 1) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + 
           ` at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'SUBMITTED': return 'bg-gray-100 text-gray-800';
    case 'IN_REVIEW': return 'bg-yellow-100 text-yellow-800';
    case 'APPROVED': return 'bg-green-100 text-green-800';
    case 'REJECTED': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'SUBMITTED': return 'Under Review';
    case 'IN_REVIEW': return 'Being Reviewed';
    case 'APPROVED': return 'Finalized';
    case 'REJECTED': return 'Declined';
    default: return status;
  }
};

const getNextActionMessage = (status: string): string => {
  switch (status) {
    case 'SUBMITTED':
      return 'Your quote is being reviewed. We\'ll respond within 24 hours.';
    case 'IN_REVIEW':
      return 'We\'re reviewing your quote details. Check messages below for any questions.';
    case 'APPROVED':
      return 'Your quote is ready! Proceed to booking and payment.';
    case 'REJECTED':
      return 'This quote was declined. Please contact us or request a new quote.';
    default:
      return 'Check messages below for updates on your quote.';
  }
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_CUST_QuoteDetail: React.FC = () => {
  const { quote_id } = useParams<{ quote_id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Global state - CRITICAL: Individual selectors
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const show_toast = useAppStore(state => state.show_toast);
  
  // Local state
  const [new_message_body, set_new_message_body] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Fetch quote detail
  const {
    data: quoteData,
    isLoading: is_loading,
    error: fetchError
  } = useQuery({
    queryKey: ['quote', quote_id],
    queryFn: () => {
      if (!quote_id || !auth_token) throw new Error('Missing required parameters');
      return fetchQuoteDetail(quote_id, auth_token);
    },
    enabled: !!quote_id && !!auth_token,
    staleTime: 60000,
    retry: 1,
  });

  // Fetch thread messages (only if thread exists)
  const {
    data: thread_messages = [],
    refetch: refetchMessages
  } = useQuery({
    queryKey: ['messages', quoteData?.message_thread?.id],
    queryFn: () => {
      if (!quoteData?.message_thread?.id || !auth_token) throw new Error('Missing parameters');
      return fetchThreadMessages(quoteData.message_thread.id, auth_token);
    },
    enabled: !!quoteData?.message_thread?.id && !!auth_token,
    staleTime: 30000,
    retry: 1,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message_body: string) => {
      if (!quoteData?.message_thread?.id || !auth_token) throw new Error('Missing parameters');
      return sendMessage(quoteData.message_thread.id, message_body, auth_token);
    },
    onSuccess: () => {
      set_new_message_body('');
      refetchMessages();
      show_toast({
        type: 'success',
        message: 'Message sent successfully',
        duration: 3000,
      });
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to send message',
        duration: 5000,
      });
    },
  });
  
  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thread_messages]);
  
  // Handle message send
  const handle_send_message = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!new_message_body.trim()) return;
    if (new_message_body.length > 1000) {
      show_toast({
        type: 'error',
        message: 'Message cannot exceed 1000 characters',
        duration: 3000,
      });
      return;
    }
    
    sendMessageMutation.mutate(new_message_body);
  };
  
  // Handle booking navigation
  const navigate_to_booking = () => {
    navigate(`/app/bookings/new?quote_id=${quote_id}`);
  };
  
  // Handle file download
  const handle_file_download = (file_url: string, file_name: string) => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const full_url = file_url.startsWith('http') ? file_url : `${API_BASE_URL}${file_url}`;
    
    // Open in new tab for download
    window.open(full_url, '_blank');
  };
  
  // Error handling
  if (fetchError) {
    const error = fetchError as any;
    if (error.response?.status === 404) {
      return (
        <>
          <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
              <div className="bg-white rounded-xl shadow-lg p-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Quote Not Found</h2>
                <p className="text-gray-600 mb-6">The quote you're looking for doesn't exist or you don't have access to it.</p>
                <Link
                  to="/app/quotes"
                  className="inline-block bg-yellow-400 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
                >
                  View All Quotes
                </Link>
              </div>
            </div>
          </div>
        </>
      );
    }
    
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Quote</h2>
              <p className="text-gray-600 mb-6">{error.response?.data?.message || 'Failed to load quote details'}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-block bg-yellow-400 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }
  
  // Loading state
  if (is_loading || !quoteData) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            {/* Loading skeleton */}
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <div className="h-12 bg-gray-200 rounded mb-4"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
  
  const { quote, service, tier, quote_answers, uploads, message_thread } = quoteData;
  
  // Calculate pricing (if finalized)
  const TAX_RATE = 0.23; // 23% VAT
  const final_subtotal = quote.final_subtotal ? Number(quote.final_subtotal) : null;
  const tax_amount = final_subtotal ? final_subtotal * TAX_RATE : null;
  const total_amount = final_subtotal && tax_amount ? final_subtotal + tax_amount : null;
  const deposit_amount = total_amount ? total_amount * 0.5 : null; // 50% deposit
  const balance_due = total_amount && deposit_amount ? total_amount - deposit_amount : null;
  
  // Check if can book
  const can_book = quote.status === 'APPROVED' && final_subtotal;
  
  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <nav className="mb-6">
            <ol className="flex items-center space-x-2 text-sm text-gray-600">
              <li>
                <Link to="/app" className="hover:text-gray-900 transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </li>
              <li>
                <Link to="/app/quotes" className="hover:text-gray-900 transition-colors">
                  Quotes
                </Link>
              </li>
              <li>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </li>
              <li className="text-gray-900 font-medium">
                Quote #{quote_id?.substring(0, 8)}
              </li>
            </ol>
          </nav>
          
          {/* Page heading */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Quote #{quote_id?.substring(0, 8)}</h1>
          </div>
          
          {/* Status section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-6">
            <div className="p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(quote.status)}`}>
                    {getStatusLabel(quote.status)}
                  </span>
                  <span className="text-sm text-gray-500">
                    Updated {formatDate(quote.updated_at)}
                  </span>
                </div>
                
                {can_book && (
                  <button
                    onClick={navigate_to_booking}
                    className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Book Your Appointment
                  </button>
                )}
              </div>
              
              <p className="text-gray-700 leading-relaxed">
                {getNextActionMessage(quote.status)}
              </p>
            </div>
          </div>
          
          {/* Quote details panel */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-6">
            <div className="p-6 lg:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Quote Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Service</p>
                  <p className="text-lg font-semibold text-gray-900">{service.name}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Tier</p>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                    {tier.name}
                  </span>
                </div>
              </div>
              
              {quote_answers.length > 0 && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Specifications</h3>
                  <dl className="space-y-3">
                    {quote_answers.map((answer) => {
                      let parsed_value = answer.value;
                      try {
                        const json_value = JSON.parse(answer.value);
                        parsed_value = json_value.value || json_value;
                      } catch {
                        // Not JSON, use as-is
                      }
                      
                      return (
                        <div key={answer.id} className="grid grid-cols-3 gap-4">
                          <dt className="text-sm font-medium text-gray-500 capitalize">
                            {answer.option_key.replace(/_/g, ' ')}
                          </dt>
                          <dd className="text-sm text-gray-900 col-span-2">
                            {String(parsed_value)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              )}
              
              {uploads.length > 0 && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Files</h3>
                  <div className="space-y-2">
                    {uploads.map((upload) => (
                      <div key={upload.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {upload.file_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-gray-500">
                                {formatFileSize(upload.file_size_bytes)}
                              </p>
                              {upload.dpi_warning && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                  ⚠ DPI Warning
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handle_file_download(upload.file_url, upload.file_name)}
                          className="ml-3 flex-shrink-0 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Pricing panel (only if finalized) */}
          {quote.status === 'APPROVED' && final_subtotal && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-6">
              <div className="p-6 lg:p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Pricing Breakdown</h2>
                
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-600">Subtotal</dt>
                    <dd className="text-sm font-semibold text-gray-900">€{final_subtotal.toFixed(2)}</dd>
                  </div>
                  
                  {tax_amount && (
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-600">Tax (23% VAT)</dt>
                      <dd className="text-sm font-semibold text-gray-900">€{tax_amount.toFixed(2)}</dd>
                    </div>
                  )}
                  
                  {total_amount && (
                    <>
                      <div className="flex justify-between pt-3 border-t border-gray-200">
                        <dt className="text-base font-bold text-gray-900">Total Amount</dt>
                        <dd className="text-base font-bold text-gray-900">€{total_amount.toFixed(2)}</dd>
                      </div>
                      
                      <div className="flex justify-between pt-3 border-t border-gray-200">
                        <dt className="text-sm font-medium text-gray-600">Deposit Required (50%)</dt>
                        <dd className="text-sm font-semibold text-green-700">€{(deposit_amount || 0).toFixed(2)}</dd>
                      </div>
                      
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-600">Balance Due</dt>
                        <dd className="text-sm font-semibold text-gray-900">€{(balance_due || 0).toFixed(2)}</dd>
                      </div>
                    </>
                  )}
                </dl>
                
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> Prices exclude VAT. The deposit is required to confirm your booking. Balance is due before delivery.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Messages section */}
          {message_thread && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6 lg:p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Messages</h2>
                
                {/* Messages list */}
                <div className="border border-gray-200 rounded-lg mb-4 bg-gray-50">
                  <div className="h-96 overflow-y-auto p-4 space-y-4">
                    {thread_messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-sm">No messages yet. Start a conversation!</p>
                      </div>
                    ) : (
                      <>
                        {thread_messages.map((message) => {
                          const is_customer_message = message.sender_user_id === current_user?.id;
                          
                          return (
                            <div
                              key={message.id}
                              className={`flex ${is_customer_message ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[70%] ${is_customer_message ? 'order-2' : 'order-1'}`}>
                                {!is_customer_message && (
                                  <p className="text-xs text-gray-500 mb-1">
                                    {message.sender_name} ({message.sender_role})
                                  </p>
                                )}
                                <div className={`rounded-lg p-3 ${is_customer_message ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'}`}>
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {message.body}
                                  </p>
                                  <p className={`text-xs mt-2 ${is_customer_message ? 'text-blue-100' : 'text-gray-500'}`}>
                                    {formatDate(message.created_at)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>
                </div>
                
                {/* Message input */}
                <form onSubmit={handle_send_message} className="space-y-3">
                  <div>
                    <textarea
                      value={new_message_body}
                      onChange={(e) => set_new_message_body(e.target.value)}
                      placeholder="Type your message..."
                      rows={3}
                      maxLength={1000}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none resize-none text-sm"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        {new_message_body.length} / 1000 characters
                      </p>
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={!new_message_body.trim() || sendMessageMutation.isPending}
                    className="w-full sm:w-auto bg-yellow-400 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    {sendMessageMutation.isPending ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_CUST_QuoteDetail;