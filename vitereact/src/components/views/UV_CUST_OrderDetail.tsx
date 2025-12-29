import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Order {
  id: string;
  quote_id: string;
  customer_id: string;
  tier_id: string;
  status: string;
  due_at: string | null;
  total_subtotal: number;
  tax_amount: number;
  total_amount: number;
  deposit_pct: number;
  deposit_amount: number;
  revision_count: number;
  assigned_staff_id: string | null;
  location_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Quote {
  id: string;
  customer_id: string;
  service_id: string;
  tier_id: string;
  status: string;
  estimate_subtotal: number | null;
  final_subtotal: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

interface ProofVersion {
  id: string;
  order_id: string;
  version_number: number;
  file_url: string;
  created_by_staff_id: string;
  status: string;
  customer_comment: string | null;
  internal_notes: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Payment {
  id: string;
  order_id: string;
  amount: number;
  method: string;
  status: string;
  transaction_ref: string | null;
  recorded_by_admin_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageThread {
  id: string;
  quote_id: string | null;
  order_id: string | null;
  created_at: string;
}

interface Message {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  sender_role?: string;
}

interface OrderDetailResponse {
  order: Order;
  quote: Quote;
  service: Service;
  tier: TierPackage;
  booking: any | null;
  proof_versions: ProofVersion[];
  invoice: any | null;
  payments: Payment[];
  message_thread: MessageThread | null;
}

// ===========================
// API BASE URL
// ===========================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// ===========================
// MAIN COMPONENT
// ===========================

const UV_CUST_OrderDetail: React.FC = () => {
  const { id: order_id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Zustand state - CRITICAL: Individual selectors
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const show_toast = useAppStore(state => state.show_toast);
  const show_modal = useAppStore(state => state.show_modal);
  const close_modal = useAppStore(state => state.close_modal);

  // Local state
  const [new_message_body, set_new_message_body] = useState('');
  const [is_sending_message, set_is_sending_message] = useState(false);
  const [selected_proof_id, set_selected_proof_id] = useState<string | null>(null);
  const [change_request_comment, set_change_request_comment] = useState('');
  const [show_change_request_modal, set_show_change_request_modal] = useState(false);
  const [show_approve_modal, set_show_approve_modal] = useState(false);

  // ===========================
  // API CALLS - QUERIES
  // ===========================

  // Fetch order detail
  const {
    data: order_data,
    isLoading: is_loading_order,
    isFetching: is_fetching_order,
    isPending: is_pending_order,
    error: order_error,
    refetch: refetch_order,
  } = useQuery({
    queryKey: ['order', order_id],
    queryFn: async () => {
      const token = useAppStore.getState().authentication_state.auth_token;
      if (!order_id || !token) throw new Error('Missing order_id or auth_token');

      const response = await axios.get<OrderDetailResponse>(
        `${API_BASE_URL}/api/orders/${order_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return response.data;
    },
    enabled: !!order_id && !!auth_token,
    retry: 1,
    staleTime: 60000,
  });

  // Refetch when auth token becomes available
  useEffect(() => {
    if (auth_token && order_id && !order_data && !is_loading_order) {
      refetch_order();
    }
  }, [auth_token, order_id, order_data, is_loading_order, refetch_order]);

  // Fetch messages (dependent query)
  const {
    data: thread_messages = [],
    isLoading: is_loading_messages,
    refetch: refetch_messages,
  } = useQuery({
    queryKey: ['messages', order_data?.message_thread?.id],
    queryFn: async () => {
      if (!order_data?.message_thread?.id || !auth_token) return [];
      
      const response = await axios.get<Message[]>(
        `${API_BASE_URL}/api/message-threads/${order_data.message_thread.id}/messages`,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      
      return response.data;
    },
    enabled: !!order_data?.message_thread?.id && !!auth_token,
    retry: 1,
    staleTime: 30000,
  });

  // ===========================
  // API CALLS - MUTATIONS
  // ===========================

  // Approve proof mutation
  const approve_proof_mutation = useMutation({
    mutationFn: async (proof_id: string) => {
      if (!auth_token) throw new Error('Not authenticated');
      
      const response = await axios.post(
        `${API_BASE_URL}/api/proofs/${proof_id}/approve`,
        {},
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      
      return response.data;
    },
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Proof approved! Your order is now in production.',
        duration: 5000,
      });
      refetch_order();
      set_show_approve_modal(false);
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to approve proof',
        duration: 5000,
      });
    },
  });

  // Request proof changes mutation
  const request_changes_mutation = useMutation({
    mutationFn: async (data: { proof_id: string; customer_comment: string }) => {
      if (!auth_token) throw new Error('Not authenticated');
      
      const response = await axios.post(
        `${API_BASE_URL}/api/proofs/${data.proof_id}/request-changes`,
        { customer_comment: data.customer_comment, reference_file_ids: [] },
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      
      return response.data;
    },
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Change request submitted. We\'ll update your proof soon.',
        duration: 5000,
      });
      refetch_order();
      set_show_change_request_modal(false);
      set_change_request_comment('');
      set_selected_proof_id(null);
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to request changes',
        duration: 5000,
      });
    },
  });

  // Send message mutation
  const send_message_mutation = useMutation({
    mutationFn: async (message_body: string) => {
      if (!order_data?.message_thread?.id || !auth_token) {
        throw new Error('No message thread');
      }
      
      const response = await axios.post(
        `${API_BASE_URL}/api/message-threads/${order_data.message_thread.id}/messages`,
        { body: message_body },
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      
      return response.data;
    },
    onMutate: async (message_body: string) => {
      set_is_sending_message(true);
      
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['messages', order_data?.message_thread?.id] });
      
      const previous_messages = queryClient.getQueryData(['messages', order_data?.message_thread?.id]);
      
      queryClient.setQueryData(['messages', order_data?.message_thread?.id], (old: Message[] = []) => [
        ...old,
        {
          id: `temp_${Date.now()}`,
          thread_id: order_data?.message_thread?.id || '',
          sender_user_id: current_user?.id || '',
          body: message_body,
          is_read: false,
          created_at: new Date().toISOString(),
          sender_name: current_user?.name || 'You',
          sender_role: current_user?.role || 'CUSTOMER',
        },
      ]);
      
      return { previous_messages };
    },
    onSuccess: () => {
      set_new_message_body('');
      set_is_sending_message(false);
      refetch_messages();
    },
    onError: (error: any, variables, context: any) => {
      set_is_sending_message(false);
      queryClient.setQueryData(['messages', order_data?.message_thread?.id], context.previous_messages);
      show_toast({
        type: 'error',
        message: 'Failed to send message. Please try again.',
        duration: 5000,
      });
    },
  });

  // ===========================
  // CALCULATED VALUES
  // ===========================

  const payment_summary = React.useMemo(() => {
    if (!order_data) {
      return {
        total_amount: 0,
        deposit_paid: false,
        deposit_amount: 0,
        balance_due: 0,
        payments_total: 0,
      };
    }

    const payments_total = order_data.payments
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const deposit_amount = Number(order_data.order.deposit_amount || 0);
    const total_amount = Number(order_data.order.total_amount || 0);

    return {
      total_amount,
      deposit_paid: payments_total >= deposit_amount,
      deposit_amount,
      balance_due: total_amount - payments_total,
      payments_total,
    };
  }, [order_data]);

  const tier_revision_limit = React.useMemo(() => {
    if (!order_data?.tier) return 0;
    
    const tier_limits: Record<string, number> = {
      'basic': 0,
      'standard': 2,
      'premium': Infinity,
      'enterprise': Infinity,
    };
    
    return tier_limits[order_data.tier.slug] || 0;
  }, [order_data?.tier]);

  const revisions_remaining = React.useMemo(() => {
    if (!order_data?.order) return 0;
    return Math.max(0, tier_revision_limit - Number(order_data.order.revision_count || 0));
  }, [tier_revision_limit, order_data?.order]);

  // ===========================
  // EVENT HANDLERS
  // ===========================

  const handle_send_message = async () => {
    if (!new_message_body.trim() || new_message_body.length > 1000) {
      show_toast({
        type: 'error',
        message: 'Message must be between 1 and 1000 characters',
        duration: 3000,
      });
      return;
    }

    await send_message_mutation.mutateAsync(new_message_body);
  };

  const handle_approve_proof_click = (proof_id: string) => {
    set_selected_proof_id(proof_id);
    set_show_approve_modal(true);
  };

  const handle_approve_proof_confirm = async () => {
    if (!selected_proof_id) return;
    await approve_proof_mutation.mutateAsync(selected_proof_id);
  };

  const handle_request_changes_click = (proof_id: string) => {
    set_selected_proof_id(proof_id);
    set_show_change_request_modal(true);
  };

  const handle_request_changes_submit = async () => {
    if (!selected_proof_id) return;

    if (change_request_comment.length < 20) {
      show_toast({
        type: 'error',
        message: 'Please provide at least 20 characters describing the changes needed',
        duration: 3000,
      });
      return;
    }

    // Check revision limit
    if (revisions_remaining <= 0) {
      show_toast({
        type: 'error',
        message: 'You have used all revisions for your tier. Please contact us for additional changes.',
        duration: 5000,
      });
      return;
    }

    await request_changes_mutation.mutateAsync({
      proof_id: selected_proof_id,
      customer_comment: change_request_comment,
    });
  };

  const handle_navigate_to_payment = () => {
    navigate(`/app/orders/${order_id}/deposit`);
  };

  const scroll_to_proofs = () => {
    const proofs_element = document.getElementById('proofs-section');
    if (proofs_element) {
      proofs_element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ===========================
  // EFFECTS
  // ===========================

  // Auto-scroll messages to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thread_messages]);

  // Handle errors
  useEffect(() => {
    if (order_error) {
      const error = order_error as any;
      if (error.response?.status === 404) {
        show_toast({
          type: 'error',
          message: 'Order not found',
          duration: 3000,
        });
        navigate('/app/orders');
      } else if (error.response?.status === 403) {
        show_toast({
          type: 'error',
          message: 'Access denied',
          duration: 3000,
        });
        navigate('/app');
      }
    }
  }, [order_error]);

  // ===========================
  // HELPER FUNCTIONS
  // ===========================

  const get_status_color = (status: string): string => {
    const status_colors: Record<string, string> = {
      'QUOTE_REQUESTED': 'bg-blue-100 text-blue-800',
      'APPROVED': 'bg-blue-100 text-blue-800',
      'IN_PRODUCTION': 'bg-teal-100 text-teal-800',
      'PROOF_SENT': 'bg-purple-100 text-purple-800',
      'AWAITING_APPROVAL': 'bg-orange-100 text-orange-800',
      'READY_FOR_PICKUP': 'bg-green-100 text-green-800',
      'COMPLETED': 'bg-green-600 text-white',
      'CANCELLED': 'bg-red-100 text-red-800',
    };
    return status_colors[status] || 'bg-gray-100 text-gray-800';
  };

  const format_status_label = (status: string): string => {
    return status.split('_').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const get_next_action_message = (status: string): { message: string; action?: () => void; action_label?: string } => {
    switch (status) {
      case 'AWAITING_APPROVAL':
        return {
          message: '⚠️ Action required: Review and approve your proof.',
          action: scroll_to_proofs,
          action_label: 'Review Proof',
        };
      case 'READY_FOR_PICKUP':
        return {
          message: 'Your order is ready! Contact us to arrange pickup.',
        };
      case 'COMPLETED':
        return {
          message: '✓ Order completed. Thank you!',
        };
      default:
        return {
          message: 'We\'re working on your order and will keep you updated.',
        };
    }
  };

  const format_date = (date_string: string): string => {
    const date = new Date(date_string);
    const now = new Date();
    const diff_ms = now.getTime() - date.getTime();
    const diff_days = Math.floor(diff_ms / (1000 * 60 * 60 * 24));

    if (diff_days === 0) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diff_days === 1) {
      return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // ===========================
  // LOADING STATE
  // ===========================

  // Show loading if:
  // 1. Query is actively loading/fetching
  // 2. Auth token not yet available (Zustand hydrating)
  // 3. Query is pending (no data yet) and auth is available (about to fetch)
  const should_show_loading = is_loading_order || is_fetching_order || !auth_token || (is_pending_order && !!auth_token && !order_data);

  if (should_show_loading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
              <div className="bg-white rounded-xl p-8 shadow-lg mb-6">
                <div className="h-12 bg-gray-200 rounded mb-4"></div>
                <div className="h-24 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!order_data) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Order not found</h2>
            <Link
              to="/app/orders"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Return to orders list
            </Link>
          </div>
        </div>
      </>
    );
  }

  const { order, quote, service, tier, proof_versions, payments } = order_data;
  const next_action = get_next_action_message(order.status);

  // ===========================
  // STATUS TIMELINE
  // ===========================

  const timeline_steps = [
    {
      status: 'QUOTE_REQUESTED',
      label: 'Quote Finalized',
      timestamp: quote.created_at,
      is_completed: true,
    },
    {
      status: 'APPROVED',
      label: 'Deposit Paid',
      timestamp: payments.find(p => Number(p.amount) >= Number(order.deposit_amount) && p.status === 'COMPLETED')?.created_at || null,
      is_completed: payment_summary.deposit_paid,
    },
    {
      status: 'IN_PRODUCTION',
      label: 'In Production',
      timestamp: order.status === 'IN_PRODUCTION' || order.status === 'PROOF_SENT' || order.status === 'AWAITING_APPROVAL' || order.status === 'READY_FOR_PICKUP' || order.status === 'COMPLETED' ? order.updated_at : null,
      is_completed: ['IN_PRODUCTION', 'PROOF_SENT', 'AWAITING_APPROVAL', 'READY_FOR_PICKUP', 'COMPLETED'].includes(order.status),
    },
    {
      status: 'COMPLETED',
      label: 'Completed',
      timestamp: order.status === 'COMPLETED' ? order.updated_at : null,
      is_completed: order.status === 'COMPLETED',
    },
  ];

  const current_step_index = timeline_steps.findIndex(step => 
    order.status === step.status || (!step.is_completed && !timeline_steps[timeline_steps.indexOf(step) - 1]?.is_completed)
  );

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <nav className="mb-6 text-sm">
            <ol className="flex items-center space-x-2 text-gray-500">
              <li>
                <Link to="/app" className="hover:text-gray-700 transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link to="/app/orders" className="hover:text-gray-700 transition-colors">
                  Orders
                </Link>
              </li>
              <li>/</li>
              <li className="text-gray-900 font-medium">Order #{order.id.slice(0, 8)}</li>
            </ol>
          </nav>

          {/* Page Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Order #{order.id.slice(0, 8)}</h1>
          </div>

          {/* Status Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${get_status_color(order.status)}`}>
                  {format_status_label(order.status)}
                </span>
              </div>
              {next_action.action && (
                <button
                  onClick={next_action.action}
                  className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition-all duration-200"
                >
                  {next_action.action_label}
                </button>
              )}
            </div>

            {/* Next Action Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-900 text-sm">{next_action.message}</p>
            </div>

            {/* Progress Timeline */}
            <div className="relative">
              {/* Desktop Timeline - Horizontal */}
              <div className="hidden md:flex items-center justify-between">
                {timeline_steps.map((step, index) => (
                  <div key={step.status} className="flex-1 flex flex-col items-center relative">
                    {/* Connector Line */}
                    {index < timeline_steps.length - 1 && (
                      <div className={`absolute top-4 left-1/2 w-full h-0.5 ${step.is_completed ? 'bg-green-600' : 'bg-gray-300'}`} style={{ zIndex: 0 }}></div>
                    )}
                    
                    {/* Step Circle */}
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                      step.is_completed 
                        ? 'bg-green-600' 
                        : index === current_step_index 
                        ? 'bg-yellow-400 animate-pulse' 
                        : 'bg-gray-300'
                    }`}>
                      {step.is_completed ? (
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : index === current_step_index ? (
                        <div className="w-3 h-3 bg-black rounded-full"></div>
                      ) : null}
                    </div>
                    
                    {/* Step Label */}
                    <p className={`text-xs font-medium text-center ${step.is_completed || index === current_step_index ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.label}
                    </p>
                    
                    {/* Timestamp */}
                    {step.timestamp && (
                      <p className="text-xs text-gray-500 text-center mt-1">
                        {format_date(step.timestamp)}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Mobile Timeline - Vertical */}
              <div className="md:hidden space-y-4">
                {timeline_steps.map((step, index) => (
                  <div key={step.status} className="flex items-start gap-4">
                    {/* Step Circle */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      step.is_completed 
                        ? 'bg-green-600' 
                        : index === current_step_index 
                        ? 'bg-yellow-400 animate-pulse' 
                        : 'bg-gray-300'
                    }`}>
                      {step.is_completed && (
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    
                    {/* Step Info */}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${step.is_completed || index === current_step_index ? 'text-gray-900' : 'text-gray-500'}`}>
                        {step.label}
                      </p>
                      {step.timestamp && (
                        <p className="text-xs text-gray-500 mt-1">
                          {format_date(step.timestamp)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Order Details & Pricing */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Details Panel */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Order Details</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service:</span>
                    <span className="font-semibold text-gray-900">{service.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tier:</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
                      {tier.name}
                    </span>
                  </div>
                  {order.due_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Due Date:</span>
                      <span className="font-semibold text-gray-900">{format_date(order.due_at)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span className="text-gray-700">{format_date(order.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Pricing Panel */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Pricing</h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-900">€{Number(order.total_subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="text-gray-900">€{Number(order.tax_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex justify-between">
                    <span className="font-semibold text-gray-900">Total:</span>
                    <span className="font-bold text-gray-900">€{Number(order.total_amount || 0).toFixed(2)}</span>
                  </div>

                  <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Deposit ({Number(order.deposit_pct || 0)}%):</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">€{Number(order.deposit_amount || 0).toFixed(2)}</span>
                        {payment_summary.deposit_paid && (
                          <span className="text-green-600 text-sm">✓ Paid</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Balance Due:</span>
                      <span className={`font-semibold ${payment_summary.balance_due > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        €{Number(payment_summary.balance_due || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {payment_summary.balance_due > 0 && payment_summary.deposit_paid && (
                    <button
                      onClick={handle_navigate_to_payment}
                      className="w-full mt-4 bg-yellow-400 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition-all duration-200"
                    >
                      Pay Balance (€{Number(payment_summary.balance_due || 0).toFixed(2)})
                    </button>
                  )}
                </div>
              </div>

              {/* Proofs Section */}
              <div id="proofs-section" className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Design Proofs</h2>
                
                {/* Revision Counter */}
                {tier_revision_limit !== Infinity && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Revisions:</span> {Number(order.revision_count || 0)} / {tier_revision_limit} used ({tier.name} Tier)
                    </p>
                    {revisions_remaining === 0 && (
                      <p className="text-xs text-orange-600 mt-1">
                        ⚠️ Revision limit reached. Additional changes will require a new quote.
                      </p>
                    )}
                  </div>
                )}

                {proof_versions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-600">No proofs uploaded yet. We'll notify you when ready.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {proof_versions.map((proof) => (
                      <div key={proof.id} className={`border rounded-lg p-4 ${proof.status === 'SENT' ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}`}>
                        {/* Proof Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">Version {proof.version_number}</h3>
                            <p className="text-sm text-gray-600">{format_date(proof.created_at)}</p>
                          </div>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            proof.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                            proof.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {proof.status === 'SENT' ? '⏳ Awaiting Review' :
                             proof.status === 'APPROVED' ? '✓ Approved' :
                             '🔄 Changes Requested'}
                          </span>
                        </div>

                        {/* Proof Preview */}
                        <div className="mb-4">
                          <img
                            src={proof.file_url}
                            alt={`Proof version ${proof.version_number}`}
                            className="w-full h-64 object-cover rounded-lg border border-gray-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23E5E7EB" width="400" height="300"/%3E%3Ctext fill="%236B7280" font-family="Arial" font-size="16" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EPreview not available%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        </div>

                        {/* Proof Actions */}
                        {proof.status === 'SENT' && (
                          <div className="flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={() => handle_approve_proof_click(proof.id)}
                              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-all duration-200"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => handle_request_changes_click(proof.id)}
                              className="flex-1 bg-yellow-400 text-black px-4 py-2 rounded-lg font-medium hover:bg-yellow-500 transition-all duration-200"
                            >
                              Request Changes
                            </button>
                          </div>
                        )}

                        {/* Approved Status */}
                        {proof.status === 'APPROVED' && proof.approved_at && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-sm text-green-800">
                              ✓ Approved on {format_date(proof.approved_at)}
                            </p>
                          </div>
                        )}

                        {/* Changes Requested */}
                        {proof.status === 'REVISION_REQUESTED' && proof.customer_comment && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <p className="text-xs font-semibold text-orange-800 mb-2">Changes Requested:</p>
                            <p className="text-sm text-gray-700 italic">&ldquo;{proof.customer_comment}&rdquo;</p>
                            <p className="text-xs text-gray-600 mt-2">Awaiting revised proof from team.</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Messages */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 sticky top-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Messages</h2>
                
                {/* Messages List */}
                <div className="h-96 overflow-y-auto mb-4 space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
                  {is_loading_messages ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                  ) : thread_messages.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 text-sm">No messages yet. Start a conversation!</p>
                    </div>
                  ) : (
                    <>
                      {thread_messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender_user_id === current_user?.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            msg.sender_user_id === current_user?.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-900'
                          }`}>
                            {msg.sender_user_id !== current_user?.id && msg.sender_name && (
                              <p className="text-xs font-semibold mb-1 opacity-75">
                                {msg.sender_name} ({msg.sender_role})
                              </p>
                            )}
                            <p className="text-sm">{msg.body}</p>
                            <p className={`text-xs mt-1 ${msg.sender_user_id === current_user?.id ? 'text-blue-100' : 'text-gray-500'}`}>
                              {format_date(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Message Input */}
                <div className="space-y-2">
                  <textarea
                    value={new_message_body}
                    onChange={(e) => set_new_message_body(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handle_send_message();
                      }
                    }}
                    placeholder="Type your message..."
                    maxLength={1000}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                    rows={3}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{new_message_body.length} / 1000</span>
                    <button
                      onClick={handle_send_message}
                      disabled={!new_message_body.trim() || is_sending_message}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {is_sending_message ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Approve Proof Modal */}
      {show_approve_modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Approve This Proof?</h3>
            <p className="text-gray-700 mb-6">
              By approving, you confirm this design is ready for production. This action cannot be undone.
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={handle_approve_proof_confirm}
                disabled={approve_proof_mutation.isPending}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-all duration-200"
              >
                {approve_proof_mutation.isPending ? 'Approving...' : 'Confirm Approval'}
              </button>
              <button
                onClick={() => {
                  set_show_approve_modal(false);
                  set_selected_proof_id(null);
                }}
                className="w-full bg-gray-100 text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Changes Modal */}
      {show_change_request_modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Request Changes to Proof</h3>
            
            {/* Revision Counter Reminder */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                You have <span className="font-semibold">{revisions_remaining}</span> revision{revisions_remaining !== 1 ? 's' : ''} remaining for your {tier.name} tier.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="change_comment" className="block text-sm font-medium text-gray-900 mb-2">
                  What changes are needed? (Be specific) *
                </label>
                <textarea
                  id="change_comment"
                  value={change_request_comment}
                  onChange={(e) => set_change_request_comment(e.target.value)}
                  placeholder="Example: Increase logo size by 20%, adjust text color to #FF0000..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                  rows={6}
                  minLength={20}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {change_request_comment.length} characters (minimum 20 required)
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handle_request_changes_submit}
                  disabled={change_request_comment.length < 20 || request_changes_mutation.isPending || revisions_remaining <= 0}
                  className="w-full bg-yellow-400 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {request_changes_mutation.isPending ? 'Submitting...' : 'Submit Change Request'}
                </button>
                <button
                  onClick={() => {
                    set_show_change_request_modal(false);
                    set_change_request_comment('');
                    set_selected_proof_id(null);
                  }}
                  className="w-full bg-gray-100 text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_CUST_OrderDetail;