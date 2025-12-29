import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface SummaryWidgets {
  pending_quotes: number;
  active_orders: number;
  payments_pending: number;
  emergency_bookings_today: number;
  sla_at_risk: number;
}

interface AuditLogEntry {
  log: {
    id: string;
    user_id: string;
    action: string;
    object_type: string;
    object_id: string;
    metadata: string | null;
    ip_address: string | null;
    created_at: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface Quote {
  quote: {
    id: string;
    customer_id: string;
    service_id: string;
    tier_id: string;
    status: string;
    created_at: string;
  };
}

interface Order {
  order: {
    id: string;
    quote_id: string;
    customer_id: string;
    tier_id: string;
    status: string;
    due_at: string | null;
    total_amount: number;
    deposit_amount: number;
    created_at: string;
  };
}

// ===========================
// API FUNCTIONS
// ===========================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const fetchPendingQuotes = async (auth_token: string): Promise<number> => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/quotes`, {
    params: { status: 'SUBMITTED', page: 1 },
    headers: { Authorization: `Bearer ${auth_token}` },
  });
  return response.data.total || 0;
};

const fetchActiveOrders = async (auth_token: string): Promise<number> => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/orders`, {
    params: { status: 'IN_PRODUCTION', page: 1 },
    headers: { Authorization: `Bearer ${auth_token}` },
  });
  return response.data.total || 0;
};

const fetchPaymentsPending = async (auth_token: string): Promise<number> => {
  // Get all orders and count those with outstanding payments
  const response = await axios.get(`${API_BASE_URL}/api/admin/orders`, {
    params: { page: 1 },
    headers: { Authorization: `Bearer ${auth_token}` },
  });
  
  // Count orders where deposit not fully paid or balance due
  const orders = response.data.orders || [];
  let pending_count = 0;

  // This is simplified - in real implementation would check payment status per order
  // For now, estimate based on orders not completed
  const incomplete_statuses = ['QUOTE_REQUESTED', 'APPROVED', 'IN_PRODUCTION', 'PROOF_SENT', 'AWAITING_APPROVAL'];
  pending_count = orders.filter((o: any) => {
    const status = o.order?.status ?? o.status ?? '';
    return incomplete_statuses.includes(status);
  }).length;
  
  return pending_count;
};

const fetchEmergencyBookings = async (auth_token: string): Promise<number> => {
  const today = new Date().toISOString().split('T')[0];
  const response = await axios.get(`${API_BASE_URL}/api/calendar/availability`, {
    params: { start_date: today, end_date: today },
    headers: { Authorization: `Bearer ${auth_token}` },
  });
  
  // Note: This endpoint doesn't return emergency bookings count directly
  // This is a placeholder - would need backend endpoint modification
  return 0;
};

const fetchRecentActivity = async (auth_token: string): Promise<AuditLogEntry[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/audit-logs`, {
    params: { page: 1, limit: 15 },
    headers: { Authorization: `Bearer ${auth_token}` },
  });
  
  return response.data.logs || [];
};

// ===========================
// COMPONENT
// ===========================

const UV_ADMIN_Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // CRITICAL: Individual selectors, no object destructuring
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const feature_b2b_enabled = useAppStore(state => state.feature_flags.feature_b2b_enabled);
  const feature_inventory_enabled = useAppStore(state => state.feature_flags.feature_inventory_enabled);
  const feature_analytics_enabled = useAppStore(state => state.feature_flags.feature_analytics_enabled);
  const show_toast = useAppStore(state => state.show_toast);

  // Redirect if not admin
  React.useEffect(() => {
    if (current_user && current_user.role !== 'ADMIN') {
      navigate('/');
      show_toast({
        type: 'error',
        message: 'Access denied. Admin privileges required.',
        duration: 5000,
      });
    }
  }, [current_user, navigate, show_toast]);

  // Fetch all dashboard data using React Query
  const queries = useQueries({
    queries: [
      {
        queryKey: ['admin-pending-quotes'],
        queryFn: () => fetchPendingQuotes(auth_token!),
        enabled: !!auth_token,
        staleTime: 60000,
        retry: 1,
      },
      {
        queryKey: ['admin-active-orders'],
        queryFn: () => fetchActiveOrders(auth_token!),
        enabled: !!auth_token,
        staleTime: 60000,
        retry: 1,
      },
      {
        queryKey: ['admin-payments-pending'],
        queryFn: () => fetchPaymentsPending(auth_token!),
        enabled: !!auth_token,
        staleTime: 60000,
        retry: 1,
      },
      {
        queryKey: ['admin-emergency-bookings'],
        queryFn: () => fetchEmergencyBookings(auth_token!),
        enabled: !!auth_token,
        staleTime: 60000,
        retry: 1,
      },
      {
        queryKey: ['admin-recent-activity'],
        queryFn: () => fetchRecentActivity(auth_token!),
        enabled: !!auth_token,
        staleTime: 60000,
        retry: 1,
      },
    ],
  });

  const [
    pending_quotes_query,
    active_orders_query,
    payments_pending_query,
    emergency_bookings_query,
    recent_activity_query,
  ] = queries;

  // Aggregate summary widgets
  const summary_widgets: SummaryWidgets = useMemo(() => ({
    pending_quotes: pending_quotes_query.data ?? 0,
    active_orders: active_orders_query.data ?? 0,
    payments_pending: payments_pending_query.data ?? 0,
    emergency_bookings_today: emergency_bookings_query.data ?? 0,
    sla_at_risk: 0, // Phase 2 - would come from analytics endpoint
  }), [
    pending_quotes_query.data,
    active_orders_query.data,
    payments_pending_query.data,
    emergency_bookings_query.data,
  ]);

  const recent_activity: AuditLogEntry[] = recent_activity_query.data ?? [];

  const is_loading = queries.some(q => q.isLoading);
  const has_error = queries.some(q => q.isError);

  // Helper function to get action URL from audit log
  const get_action_url = (log: AuditLogEntry['log']): string => {
    const { object_type, object_id } = log;
    
    switch (object_type) {
      case 'QUOTE':
        return `/admin/quotes/${object_id}`;
      case 'ORDER':
        return `/admin/orders/${object_id}`;
      case 'USER':
        return `/admin/users?search=${object_id}`;
      case 'SERVICE':
        return `/admin/services/${object_id}`;
      default:
        return '/admin';
    }
  };

  // Helper to format timestamp
  const format_timestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff_ms = now.getTime() - date.getTime();
    const diff_minutes = Math.floor(diff_ms / 60000);
    const diff_hours = Math.floor(diff_ms / 3600000);
    const diff_days = Math.floor(diff_ms / 86400000);

    if (diff_minutes < 1) return 'Just now';
    if (diff_minutes < 60) return `${diff_minutes} minute${diff_minutes === 1 ? '' : 's'} ago`;
    if (diff_hours < 24) return `${diff_hours} hour${diff_hours === 1 ? '' : 's'} ago`;
    if (diff_days < 7) return `${diff_days} day${diff_days === 1 ? '' : 's'} ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Page Header */}
        <div className="bg-white border-b-2 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Welcome back, {current_user?.name}
                </p>
              </div>
              <div className="mt-4 sm:mt-0">
                <span className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 text-sm font-medium text-gray-700">
                  <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4" />
                  </svg>
                  System Online
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Summary Widgets */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Business Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Pending Quotes Widget */}
              <Link
                to="/admin/quotes?status=SUBMITTED"
                className="block bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Quotes</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {is_loading ? (
                        <span className="inline-block w-12 h-8 bg-gray-200 rounded animate-pulse" />
                      ) : (
                        summary_widgets.pending_quotes
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">Awaiting Review</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </Link>

              {/* Active Orders Widget */}
              <Link
                to="/admin/orders?status=IN_PRODUCTION"
                className="block bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Orders</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {is_loading ? (
                        <span className="inline-block w-12 h-8 bg-gray-200 rounded animate-pulse" />
                      ) : (
                        summary_widgets.active_orders
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">In Production</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
              </Link>

              {/* Payments Pending Widget */}
              <Link
                to="/admin/orders?payment_status=pending"
                className="block bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Payments Pending</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {is_loading ? (
                        <span className="inline-block w-12 h-8 bg-gray-200 rounded animate-pulse" />
                      ) : (
                        summary_widgets.payments_pending
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">Awaiting Confirmation</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </Link>

              {/* Emergency Bookings Widget */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Emergency Bookings</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {is_loading ? (
                        <span className="inline-block w-12 h-8 bg-gray-200 rounded animate-pulse" />
                      ) : (
                        summary_widgets.emergency_bookings_today
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">Today</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* SLA At-Risk Widget (Phase 2) */}
              {feature_analytics_enabled && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">SLA At-Risk</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {summary_widgets.sla_at_risk}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">Jobs at risk</p>
                    </div>
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                to="/admin/quotes?status=SUBMITTED"
                className="relative flex items-center justify-center px-6 py-4 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {summary_widgets.pending_quotes > 0 && (
                  <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                    {summary_widgets.pending_quotes}
                  </span>
                )}
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Finalize Quotes
              </Link>

              <Link
                to="/admin/services"
                className="flex items-center justify-center px-6 py-4 bg-white border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage Services
              </Link>

              {feature_b2b_enabled && (
                <Link
                  to="/admin/b2b"
                  className="flex items-center justify-center px-6 py-4 bg-white border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Create B2B Account
                </Link>
              )}

              {feature_analytics_enabled && (
                <Link
                  to="/admin/analytics"
                  className="flex items-center justify-center px-6 py-4 bg-white border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  View Reports
                </Link>
              )}
            </div>
          </div>

          {/* Two-column layout for Activity Feed and potential future widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Activity Feed (2/3 width) */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                  <p className="text-sm text-gray-600 mt-1">Last 15 actions across the system</p>
                </div>

                {recent_activity_query.isLoading ? (
                  <div className="px-6 py-8">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="mb-4 last:mb-0">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
                        <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : recent_activity_query.isError ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-red-600 text-sm">Failed to load activity feed</p>
                    <button
                      onClick={() => recent_activity_query.refetch()}
                      className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      Retry
                    </button>
                  </div>
                ) : recent_activity.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">No recent activity</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {recent_activity.map((activity) => (
                      <Link
                        key={activity.log.id}
                        to={get_action_url(activity.log)}
                        className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              <span className="font-semibold">{activity.user.name}</span>
                              <span className="text-gray-600 ml-1">{activity.log.action.toLowerCase()}</span>
                              <span className="text-gray-600 ml-1">{activity.log.object_type.toLowerCase()}</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-1 flex items-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 mr-2">
                                {activity.user.role}
                              </span>
                              <span className="truncate">
                                {activity.log.object_type} #{activity.log.object_id.slice(0, 8)}
                              </span>
                            </p>
                          </div>
                          <div className="ml-4 flex-shrink-0">
                            <p className="text-xs text-gray-500 whitespace-nowrap">
                              {format_timestamp(activity.log.created_at)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
                  <Link
                    to="/admin/settings?tab=audit"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    View Full Audit Log →
                  </Link>
                </div>
              </div>
            </div>

            {/* Sidebar Widgets (1/3 width) */}
            <div className="space-y-6">
              {/* Priority Alerts (if any exist) */}
              {summary_widgets.pending_quotes > 0 && (
                <div className="bg-white rounded-xl shadow-lg border border-orange-200 p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">Action Required</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {summary_widgets.pending_quotes} quote{summary_widgets.pending_quotes === 1 ? '' : 's'} awaiting review
                      </p>
                      <Link
                        to="/admin/quotes?status=SUBMITTED"
                        className="inline-block mt-3 text-sm font-medium text-orange-600 hover:text-orange-700"
                      >
                        Review Now →
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* System Status Card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">System Features</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">B2B Accounts</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      feature_b2b_enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {feature_b2b_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Inventory</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      feature_inventory_enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {feature_inventory_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Analytics</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      feature_analytics_enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {feature_analytics_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
                <Link
                  to="/admin/settings?tab=features"
                  className="block mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Manage Features →
                </Link>
              </div>

              {/* Quick Stats Card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Pending</span>
                    <span className="text-lg font-bold text-gray-900">
                      {summary_widgets.pending_quotes + summary_widgets.payments_pending}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">In Progress</span>
                    <span className="text-lg font-bold text-gray-900">
                      {summary_widgets.active_orders}
                    </span>
                  </div>
                  {summary_widgets.emergency_bookings_today > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Emergency Today</span>
                      <span className="text-lg font-bold text-red-600">
                        {summary_widgets.emergency_bookings_today}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Error State (if critical errors) */}
          {has_error && !is_loading && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-8">
              <div className="flex items-start">
                <svg className="h-6 w-6 text-red-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-red-800">Some dashboard data failed to load</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Some widgets may show incomplete data. Try refreshing the page.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_ADMIN_Dashboard;