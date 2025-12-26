import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// =====================================================
// TYPES (from Zod schemas)
// =====================================================

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

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CustomerProfile {
  id: string;
  user_id: string;
  phone: string | null;
  company_name: string | null;
  address: string | null;
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

interface Booking {
  id: string;
  quote_id: string;
  customer_id: string;
  start_at: string;
  end_at: string;
  status: string;
  is_emergency: boolean;
  urgent_fee_pct: number;
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
  booking: Booking | null;
  proof_versions: ProofVersion[];
  invoice: any;
  payments: Payment[];
  message_thread: MessageThread | null;
}

// =====================================================
// COMPONENT
// =====================================================

const UV_ADMIN_OrderManagement: React.FC = () => {
  const { order_id } = useParams<{ order_id: string }>();
  const navigate = useNavigate();
  const query_client = useQueryClient();

  // Global state (individual selectors - CRITICAL)
  const auth_token = useAppStore((state) => state.authentication_state.auth_token);
  const current_user = useAppStore((state) => state.authentication_state.current_user);

  // Local state
  const [payment_form, set_payment_form] = useState({
    amount: null as number | null,
    method: 'CASH' as string,
    transaction_ref: '',
    notes: '',
  });

  const [staff_assignment_form, set_staff_assignment_form] = useState({
    assigned_staff_id: null as string | null,
  });

  const [status_update_form, set_status_update_form] = useState({
    new_status: '',
    notes: '',
  });

  const [message_body, set_message_body] = useState('');
  const [show_payment_modal, set_show_payment_modal] = useState(false);
  const [show_cancel_modal, set_show_cancel_modal] = useState(false);
  const [show_status_modal, set_show_status_modal] = useState(false);
  const [is_sending_message, set_is_sending_message] = useState(false);
  const [notification, set_notification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Fetch order details
  const {
    data: order_data,
    isLoading: is_loading_order,
    error: order_error,
    refetch: refetch_order,
  } = useQuery<OrderDetailResponse>({
    queryKey: ['admin_order_detail', order_id],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${order_id}`,
        {
          headers: {
            Authorization: `Bearer ${auth_token}`,
          },
        }
      );
      return response.data;
    },
    enabled: !!order_id && !!auth_token,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Fetch staff members for assignment dropdown
  const { data: staff_members } = useQuery<{ users: Array<{ user: User }> }>({
    queryKey: ['staff_members'],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/users?role=STAFF`,
        {
          headers: {
            Authorization: `Bearer ${auth_token}`,
          },
        }
      );
      return response.data;
    },
    enabled: !!auth_token,
    staleTime: 300000, // 5 minutes
  });

  // Fetch customer profile
  const { data: customer_data } = useQuery<{ user: User; profile: CustomerProfile }>({
    queryKey: ['customer_profile', order_data?.order?.customer_id],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/users?role=CUSTOMER&search=${order_data?.order?.customer_id}`,
        {
          headers: {
            Authorization: `Bearer ${auth_token}`,
          },
        }
      );
      // Find customer in returned users array
      const customer_user = response.data.users?.[0];
      return customer_user || null;
    },
    enabled: !!order_data?.order?.customer_id && !!auth_token,
    staleTime: 60000,
  });

  // Fetch messages for order thread
  const { data: messages_data, refetch: refetch_messages } = useQuery<Message[]>({
    queryKey: ['order_messages', order_data?.message_thread?.id],
    queryFn: async () => {
      if (!order_data?.message_thread?.id) return [];
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/message-threads/${order_data.message_thread.id}/messages`,
        {
          headers: {
            Authorization: `Bearer ${auth_token}`,
          },
        }
      );
      return response.data;
    },
    enabled: !!order_data?.message_thread?.id && !!auth_token,
    staleTime: 30000,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Record payment mutation
  const record_payment_mutation = useMutation({
    mutationFn: async (payment_data: {
      amount: number;
      method: string;
      transaction_ref: string;
    }) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${order_id}/payments`,
        payment_data,
        {
          headers: {
            Authorization: `Bearer ${auth_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: ['admin_order_detail', order_id] });
      set_show_payment_modal(false);
      set_payment_form({ amount: null, method: 'CASH', transaction_ref: '', notes: '' });
      set_notification({ type: 'success', message: 'Payment recorded successfully' });
      setTimeout(() => set_notification(null), 5000);
    },
    onError: (error: any) => {
      set_notification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to record payment',
      });
      setTimeout(() => set_notification(null), 5000);
    },
  });

  // Update order status mutation
  const update_status_mutation = useMutation({
    mutationFn: async (status_data: { status: string; notes: string }) => {
      const response = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${order_id}`,
        status_data,
        {
          headers: {
            Authorization: `Bearer ${auth_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: ['admin_order_detail', order_id] });
      set_show_status_modal(false);
      set_status_update_form({ new_status: '', notes: '' });
      set_notification({ type: 'success', message: 'Order status updated successfully' });
      setTimeout(() => set_notification(null), 5000);
    },
    onError: (error: any) => {
      set_notification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update status',
      });
      setTimeout(() => set_notification(null), 5000);
    },
  });

  // Assign staff mutation
  const assign_staff_mutation = useMutation({
    mutationFn: async (staff_id: string) => {
      const response = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${order_id}`,
        { assigned_staff_id: staff_id },
        {
          headers: {
            Authorization: `Bearer ${auth_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: ['admin_order_detail', order_id] });
      set_notification({ type: 'success', message: 'Staff assigned successfully' });
      setTimeout(() => set_notification(null), 5000);
    },
    onError: (error: any) => {
      set_notification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to assign staff',
      });
      setTimeout(() => set_notification(null), 5000);
    },
  });

  // Send message mutation
  const send_message_mutation = useMutation({
    mutationFn: async (message_text: string) => {
      if (!order_data?.message_thread?.id) throw new Error('No message thread');
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/message-threads/${order_data.message_thread.id}/messages`,
        { body: message_text },
        {
          headers: {
            Authorization: `Bearer ${auth_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      refetch_messages();
      set_message_body('');
      set_is_sending_message(false);
    },
    onError: (error: any) => {
      set_is_sending_message(false);
      set_notification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to send message',
      });
      setTimeout(() => set_notification(null), 5000);
    },
  });

  // Calculate payment summary
  const payment_summary = useMemo(() => {
    if (!order_data?.order || !order_data?.payments) {
      return {
        total_paid: 0,
        balance_due: 0,
        deposit_paid: false,
      };
    }

    const total_paid = order_data.payments
      .filter((p) => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const balance_due = Number(order_data.order.total_amount || 0) - total_paid;
    const deposit_paid = total_paid >= Number(order_data.order.deposit_amount || 0);

    return {
      total_paid,
      balance_due,
      deposit_paid,
    };
  }, [order_data?.order, order_data?.payments]);

  // Initialize payment form amount when order loads
  useEffect(() => {
    if (order_data?.order && payment_summary.balance_due > 0 && !payment_form.amount) {
      set_payment_form((prev) => ({
        ...prev,
        amount: payment_summary.balance_due,
      }));
    }
  }, [order_data?.order, payment_summary.balance_due]);

  // Initialize staff assignment when order loads
  useEffect(() => {
    if (order_data?.order?.assigned_staff_id && !staff_assignment_form.assigned_staff_id) {
      set_staff_assignment_form({
        assigned_staff_id: order_data.order.assigned_staff_id,
      });
    }
  }, [order_data?.order?.assigned_staff_id]);

  // Handlers
  const handle_record_payment = () => {
    if (!payment_form.amount || payment_form.amount <= 0) {
      set_notification({ type: 'error', message: 'Please enter a valid payment amount' });
      setTimeout(() => set_notification(null), 5000);
      return;
    }

    record_payment_mutation.mutate({
      amount: payment_form.amount,
      method: payment_form.method,
      transaction_ref: payment_form.transaction_ref,
    });
  };

  const handle_update_status = () => {
    if (!status_update_form.new_status) {
      set_notification({ type: 'error', message: 'Please select a new status' });
      setTimeout(() => set_notification(null), 5000);
      return;
    }

    update_status_mutation.mutate({
      status: status_update_form.new_status,
      notes: status_update_form.notes,
    });
  };

  const handle_assign_staff = (staff_id: string) => {
    set_staff_assignment_form({ assigned_staff_id: staff_id });
    assign_staff_mutation.mutate(staff_id);
  };

  const handle_cancel_order = () => {
    update_status_mutation.mutate(
      { status: 'CANCELLED', notes: 'Order cancelled by admin' },
      {
        onSuccess: () => {
          set_show_cancel_modal(false);
          set_notification({ type: 'success', message: 'Order cancelled successfully' });
          setTimeout(() => set_notification(null), 5000);
        },
      }
    );
  };

  const handle_send_message = () => {
    if (!message_body.trim() || message_body.length > 1000) {
      set_notification({
        type: 'error',
        message: 'Message must be between 1 and 1000 characters',
      });
      setTimeout(() => set_notification(null), 5000);
      return;
    }

    set_is_sending_message(true);
    send_message_mutation.mutate(message_body);
  };

  // Status badge color mapping
  const get_status_color = (status: string) => {
    const status_colors: Record<string, string> = {
      QUOTE_REQUESTED: 'bg-gray-100 text-gray-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      IN_PRODUCTION: 'bg-purple-100 text-purple-800',
      PROOF_SENT: 'bg-yellow-100 text-yellow-800',
      AWAITING_APPROVAL: 'bg-orange-100 text-orange-800',
      READY_FOR_PICKUP: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-green-600 text-white',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return status_colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Format date helper
  const format_date = (date_string: string | null) => {
    if (!date_string) return 'N/A';
    return new Date(date_string).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Error handling
  if (order_error) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
            <p className="text-gray-600 mb-6">
              The order you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Link
              to="/admin/orders"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Back to Orders List
            </Link>
          </div>
        </div>
      </>
    );
  }

  // Loading state
  if (is_loading_order) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-96 bg-gray-200 rounded"></div>
                <div className="h-96 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const { order, quote, service, tier, booking, proof_versions, payments, message_thread } =
    order_data || {};

  if (!order) {
    return null;
  }

  const customer = customer_data?.user || null;
  const customer_profile = customer_data?.profile || null;

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        {/* Notification Toast */}
        {notification && (
          <div
            className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${
              notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            <div className="flex items-center space-x-3">
              {notification.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              <span>{notification.message}</span>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex mb-6" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm">
              <li>
                <Link to="/admin" className="text-gray-500 hover:text-gray-700">
                  Dashboard
                </Link>
              </li>
              <li>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </li>
              <li>
                <Link to="/admin/orders" className="text-gray-500 hover:text-gray-700">
                  Orders
                </Link>
              </li>
              <li>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </li>
              <li>
                <span className="text-gray-900 font-medium">Order #{order.id.slice(0, 8)}</span>
              </li>
            </ol>
          </nav>

          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Order #{order.id.slice(0, 8).toUpperCase()}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-semibold ${get_status_color(
                      order.status
                    )}`}
                  >
                    {order.status.replace(/_/g, ' ')}
                  </span>
                  {booking?.is_emergency && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                      ⚡ Emergency Booking
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 lg:mt-0 flex flex-wrap gap-3">
                <button
                  onClick={() => set_show_status_modal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Update Status
                </button>
                <button
                  onClick={() => set_show_payment_modal(true)}
                  disabled={payment_summary.balance_due <= 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Record Payment
                </button>
                <button
                  onClick={() => set_show_cancel_modal(true)}
                  disabled={order.status === 'CANCELLED' || order.status === 'COMPLETED'}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel Order
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Order Overview */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Order Details</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Service</p>
                      <p className="font-semibold text-gray-900">{service?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Tier</p>
                      <p className="font-semibold text-gray-900">{tier?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Created</p>
                      <p className="font-semibold text-gray-900">{format_date(order.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Due Date</p>
                      <p
                        className={`font-semibold ${
                          order.due_at && new Date(order.due_at) < new Date()
                            ? 'text-red-600'
                            : 'text-gray-900'
                        }`}
                      >
                        {format_date(order.due_at)}
                      </p>
                    </div>
                  </div>

                  {booking && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600 mb-2">Booking Details</p>
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-sm text-gray-900">
                          <strong>Date:</strong> {format_date(booking.start_at)}
                        </p>
                        <p className="text-sm text-gray-900">
                          <strong>Time:</strong>{' '}
                          {new Date(booking.start_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          -{' '}
                          {new Date(booking.end_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="text-sm text-gray-900">
                          <strong>Status:</strong> {booking.status}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Information */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Customer Information</h2>
                {customer ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-semibold text-gray-900">{customer.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <a
                        href={`mailto:${customer.email}`}
                        className="font-semibold text-blue-600 hover:text-blue-700"
                      >
                        {customer.email}
                      </a>
                    </div>
                    {customer_profile?.phone && (
                      <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <a
                          href={`tel:${customer_profile.phone}`}
                          className="font-semibold text-blue-600 hover:text-blue-700"
                        >
                          {customer_profile.phone}
                        </a>
                      </div>
                    )}
                    {customer_profile?.company_name && (
                      <div>
                        <p className="text-sm text-gray-600">Company</p>
                        <p className="font-semibold text-gray-900">{customer_profile.company_name}</p>
                      </div>
                    )}
                    {customer_profile?.address && (
                      <div>
                        <p className="text-sm text-gray-600">Address</p>
                        <p className="font-semibold text-gray-900">{customer_profile.address}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">Loading customer information...</p>
                )}
              </div>

              {/* Financial Panel */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Financial Summary</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold text-gray-900">
                      €{Number(order.total_subtotal || 0).toFixed(2)}
                    </span>
                  </div>
                  {booking?.is_emergency && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Emergency Fee ({booking.urgent_fee_pct}%)</span>
                      <span className="font-semibold text-yellow-700">
                        €
                        {(
                          (Number(order.total_subtotal || 0) * Number(booking.urgent_fee_pct || 0)) /
                          100
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-semibold text-gray-900">
                      €{Number(order.tax_amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-gray-200">
                    <span className="font-bold text-gray-900">Total Amount</span>
                    <span className="font-bold text-gray-900 text-lg">
                      €{Number(order.total_amount || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-gray-200 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Deposit ({order.deposit_pct}%)
                        {payment_summary.deposit_paid && (
                          <span className="ml-2 text-green-600">✓</span>
                        )}
                      </span>
                      <span className="font-semibold text-gray-900">
                        €{Number(order.deposit_amount || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Paid</span>
                      <span className="font-semibold text-green-600">
                        €{payment_summary.total_paid.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-gray-900">Balance Due</span>
                      <span
                        className={`font-bold text-lg ${
                          payment_summary.balance_due > 0 ? 'text-orange-600' : 'text-green-600'
                        }`}
                      >
                        €{payment_summary.balance_due.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment History */}
                {payments && payments.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-3">Payment History</h3>
                    <div className="space-y-2">
                      {payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {payment.method} - €{Number(payment.amount || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">{format_date(payment.created_at)}</p>
                            {payment.transaction_ref && (
                              <p className="text-xs text-gray-500">Ref: {payment.transaction_ref}</p>
                            )}
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              payment.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {payment.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Proof Versions */}
              {proof_versions && proof_versions.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Proof Versions</h2>
                  <div className="space-y-4">
                    {proof_versions.map((proof) => (
                      <div key={proof.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              Version {proof.version_number}
                            </h3>
                            <p className="text-sm text-gray-500">{format_date(proof.created_at)}</p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              proof.status === 'APPROVED'
                                ? 'bg-green-100 text-green-800'
                                : proof.status === 'REVISION_REQUESTED'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {proof.status}
                          </span>
                        </div>
                        <a
                          href={proof.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          View Proof →
                        </a>
                        {proof.customer_comment && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-sm text-gray-600 mb-1">Customer Comment:</p>
                            <p className="text-sm text-gray-900 italic">"{proof.customer_comment}"</p>
                          </div>
                        )}
                        {proof.internal_notes && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-600 mb-1">Internal Notes:</p>
                            <p className="text-sm text-gray-700">{proof.internal_notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Status Management */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Status Management</h2>

                {/* Staff Assignment */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assigned Staff Member
                  </label>
                  <select
                    value={staff_assignment_form.assigned_staff_id || ''}
                    onChange={(e) => handle_assign_staff(e.target.value)}
                    disabled={assign_staff_mutation.isPending}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {staff_members?.users?.map((staff_obj) => (
                      <option key={staff_obj.user.id} value={staff_obj.user.id}>
                        {staff_obj.user.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Current Status Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">Current Status</p>
                  <p className="font-bold text-gray-900 text-lg mb-2">
                    {order.status.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-gray-600">
                    Last updated: {format_date(order.updated_at)}
                  </p>
                  {order.revision_count > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      Revisions: {order.revision_count}
                    </p>
                  )}
                </div>
              </div>

              {/* Customer Messages */}
              {message_thread && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Messages</h2>

                  {/* Message Thread */}
                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                    {messages_data && messages_data.length > 0 ? (
                      messages_data.map((message) => (
                        <div
                          key={message.id}
                          className={`p-3 rounded-lg ${
                            message.sender_user_id === current_user?.id
                              ? 'bg-blue-50 ml-8'
                              : 'bg-gray-100 mr-8'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-semibold text-gray-700">
                              {message.sender_name || 'Unknown'}{' '}
                              <span className="text-gray-500">({message.sender_role || 'N/A'})</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(message.created_at).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <p className="text-sm text-gray-900">{message.body}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm text-center py-4">No messages yet</p>
                    )}
                  </div>

                  {/* Message Composer */}
                  <div className="border-t border-gray-200 pt-4">
                    <textarea
                      value={message_body}
                      onChange={(e) => {
                        set_notification(null);
                        set_message_body(e.target.value);
                      }}
                      placeholder="Type your message to customer..."
                      rows={3}
                      maxLength={1000}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">{message_body.length} / 1000</span>
                      <button
                        onClick={handle_send_message}
                        disabled={is_sending_message || !message_body.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {is_sending_message ? 'Sending...' : 'Send Message'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      window.open(
                        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/invoices/${order.id}/download`,
                        '_blank'
                      );
                    }}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors border border-gray-300"
                  >
                    Download Invoice
                  </button>
                  <Link
                    to={`/admin/quotes/${order.quote_id}`}
                    className="block w-full px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors border border-gray-300 text-center"
                  >
                    View Related Quote
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Recording Modal */}
        {show_payment_modal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => set_show_payment_modal(false)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Record Manual Payment</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payment_form.amount || ''}
                    onChange={(e) => {
                      set_notification(null);
                      set_payment_form({ ...payment_form, amount: parseFloat(e.target.value) });
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="0.00"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Balance due: €{payment_summary.balance_due.toFixed(2)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={payment_form.method}
                    onChange={(e) =>
                      set_payment_form({ ...payment_form, method: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CHECK">Check</option>
                    <option value="WIRE">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction Reference
                  </label>
                  <input
                    type="text"
                    value={payment_form.transaction_ref}
                    onChange={(e) =>
                      set_payment_form({ ...payment_form, transaction_ref: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="Transaction ID or check number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={payment_form.notes}
                    onChange={(e) =>
                      set_payment_form({ ...payment_form, notes: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="Internal notes..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => set_show_payment_modal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handle_record_payment}
                  disabled={record_payment_mutation.isPending || !payment_form.amount}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {record_payment_mutation.isPending ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Update Modal */}
        {show_status_modal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => set_show_status_modal(false)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Update Order Status</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Status
                  </label>
                  <select
                    value={status_update_form.new_status}
                    onChange={(e) => {
                      set_notification(null);
                      set_status_update_form({
                        ...status_update_form,
                        new_status: e.target.value,
                      });
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Select new status...</option>
                    <option value="QUOTE_REQUESTED">Quote Requested</option>
                    <option value="APPROVED">Approved</option>
                    <option value="IN_PRODUCTION">In Production</option>
                    <option value="PROOF_SENT">Proof Sent</option>
                    <option value="AWAITING_APPROVAL">Awaiting Approval</option>
                    <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Current: {order.status.replace(/_/g, ' ')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Internal Notes (Optional)
                  </label>
                  <textarea
                    value={status_update_form.notes}
                    onChange={(e) =>
                      set_status_update_form({ ...status_update_form, notes: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="Reason for status change..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => set_show_status_modal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handle_update_status}
                  disabled={update_status_mutation.isPending || !status_update_form.new_status}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {update_status_mutation.isPending ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Order Confirmation Modal */}
        {show_cancel_modal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => set_show_cancel_modal(false)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Cancel This Order?</h2>
                <p className="text-gray-600 mb-4">
                  This action will cancel the order. Customer will be notified.
                </p>

                {payment_summary.total_paid > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-yellow-800 mb-2">
                      <strong>Refund Calculation:</strong>
                    </p>
                    <p className="text-sm text-yellow-800">
                      Total Paid: €{payment_summary.total_paid.toFixed(2)}
                    </p>
                    <p className="text-sm text-yellow-800 font-semibold mt-1">
                      Estimated Refund: €{payment_summary.total_paid.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => set_show_cancel_modal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Keep Order
                </button>
                <button
                  onClick={handle_cancel_order}
                  disabled={update_status_mutation.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {update_status_mutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_ADMIN_OrderManagement;