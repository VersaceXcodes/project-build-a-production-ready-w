import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { Calendar, ClipboardList, FileText, DollarSign, ArrowRight, Clock } from 'lucide-react';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Order {
  id: string;
  status: string;
  total_amount: number;
  updated_at: string;
}

interface OrderListItem {
  order: Order;
  payment_status: {
    deposit_paid: boolean;
    balance_due: number;
  };
}

interface OrdersResponse {
  orders: OrderListItem[];
  total: number;
}

interface Quote {
  id: string;
  status: string;
  created_at: string;
}

interface QuotesResponse {
  quotes: Quote[];
  total: number;
}

interface Booking {
  id: string;
  start_at: string;
  status: string;
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  action_url: string | null;
}

interface NextAction {
  type: string;
  message: string;
  action_url: string;
  priority: 'HIGH' | 'NORMAL';
}

interface SummaryCardsData {
  active_orders_count: number;
  pending_quotes_count: number;
  upcoming_bookings_count: number;
  next_booking_date: string | null;
  balance_due_amount: number;
}

// ===========================
// API FUNCTIONS
// ===========================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const fetchOrders = async (authToken: string): Promise<OrdersResponse> => {
  const response = await axios.get(`${API_BASE_URL}/api/orders`, {
    params: { page: 1, limit: 100 },
    headers: { Authorization: `Bearer ${authToken}` }
  });
  return response.data;
};

const fetchQuotes = async (authToken: string): Promise<QuotesResponse> => {
  const response = await axios.get(`${API_BASE_URL}/api/quotes`, {
    params: { status: 'SUBMITTED', page: 1 },
    headers: { Authorization: `Bearer ${authToken}` }
  });
  return response.data;
};

const fetchBookings = async (authToken: string): Promise<Booking[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/bookings`, {
    params: { status: 'CONFIRMED' },
    headers: { Authorization: `Bearer ${authToken}` }
  });
  return response.data;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_CUST_Dashboard: React.FC = () => {
  // Global state access (CRITICAL: Individual selectors)
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // ===========================
  // DATA FETCHING (React Query)
  // ===========================

  const { data: ordersData, isLoading: isLoadingOrders, error: ordersError } = useQuery({
    queryKey: ['dashboard-orders', currentUser?.id],
    queryFn: () => fetchOrders(authToken!),
    enabled: !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: quotesData, isLoading: isLoadingQuotes } = useQuery({
    queryKey: ['dashboard-quotes', currentUser?.id],
    queryFn: () => fetchQuotes(authToken!),
    enabled: !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
    queryKey: ['dashboard-bookings', currentUser?.id],
    queryFn: () => fetchBookings(authToken!),
    enabled: !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // ===========================
  // DATA AGGREGATION
  // ===========================

  const isLoading = isLoadingOrders || isLoadingQuotes || isLoadingBookings;
  const error = ordersError ? 'Failed to load dashboard data' : null;

  const summaryCardsData: SummaryCardsData = React.useMemo(() => {
    const activeStatuses = ['QUOTE_REQUESTED', 'APPROVED', 'IN_PRODUCTION', 'PROOF_SENT', 'AWAITING_APPROVAL', 'READY_FOR_PICKUP'];
    
    const activeOrders = ordersData?.orders.filter(o => activeStatuses.includes(o.order.status)) || [];
    const balanceDue = ordersData?.orders.reduce((sum, o) => sum + Number(o.payment_status.balance_due || 0), 0) || 0;

    const upcomingBookings = bookingsData?.filter(b => new Date(b.start_at) > new Date()) || [];
    const sortedBookings = [...upcomingBookings].sort((a, b) => 
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    return {
      active_orders_count: activeOrders.length,
      pending_quotes_count: quotesData?.total || 0,
      upcoming_bookings_count: upcomingBookings.length,
      next_booking_date: sortedBookings.length > 0 ? sortedBookings[0].start_at : null,
      balance_due_amount: balanceDue,
    };
  }, [ordersData, quotesData, bookingsData]);

  const recentActivity: ActivityItem[] = React.useMemo(() => {
    if (!ordersData?.orders) return [];
    
    const activities: ActivityItem[] = ordersData.orders
      .slice(0, 10)
      .map(o => ({
        id: o.order.id,
        type: 'order_update',
        message: `Order status: ${o.order.status.replace(/_/g, ' ')}`,
        timestamp: o.order.updated_at,
        action_url: `/app/orders/${o.order.id}`,
      }));

    return activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [ordersData]);

  const nextActions: NextAction[] = React.useMemo(() => {
    if (!ordersData?.orders) return [];
    
    const actions: NextAction[] = [];

    ordersData.orders.forEach(orderItem => {
      const { order, payment_status } = orderItem;

      // Proofs awaiting approval
      if (order.status === 'AWAITING_APPROVAL') {
        actions.push({
          type: 'APPROVE_PROOF',
          message: `Review proof for Order #${order.id.substring(0, 8)}`,
          action_url: `/app/orders/${order.id}`,
          priority: 'HIGH',
        });
      }

      // Balance due
      if (Number(payment_status.balance_due) > 0 && order.status === 'READY_FOR_PICKUP') {
        actions.push({
          type: 'PAY_BALANCE',
          message: `Payment due: €${Number(payment_status.balance_due).toFixed(2)}`,
          action_url: `/app/orders/${order.id}`,
          priority: 'HIGH',
        });
      }
    });

    // Sort by priority
    return actions.sort((a, b) => a.priority === 'HIGH' && b.priority !== 'HIGH' ? -1 : 1);
  }, [ordersData]);

  // ===========================
  // HELPER FUNCTIONS
  // ===========================

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {currentUser?.name || 'Customer'}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Here's what's happening with your projects
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Summary Cards + Quick Actions + Next Steps */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Active Orders Card */}
                <Link 
                  to="/app/orders?status=active"
                  className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                        Active Orders
                      </p>
                      {isLoading ? (
                        <div className="mt-2 h-10 w-16 bg-gray-200 rounded animate-pulse"></div>
                      ) : (
                        <p className="mt-2 text-4xl font-bold text-blue-600">
                          {summaryCardsData.active_orders_count}
                        </p>
                      )}
                    </div>
                    <div className="bg-blue-100 rounded-full p-3 group-hover:bg-blue-200 transition-colors">
                      <ClipboardList className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm text-blue-600 group-hover:text-blue-700">
                    <span>View all orders</span>
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </Link>

                {/* Pending Quotes Card */}
                <Link 
                  to="/app/quotes?status=SUBMITTED"
                  className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                        Pending Quotes
                      </p>
                      {isLoading ? (
                        <div className="mt-2 h-10 w-16 bg-gray-200 rounded animate-pulse"></div>
                      ) : (
                        <p className="mt-2 text-4xl font-bold text-yellow-600">
                          {summaryCardsData.pending_quotes_count}
                        </p>
                      )}
                    </div>
                    <div className="bg-yellow-100 rounded-full p-3 group-hover:bg-yellow-200 transition-colors">
                      <FileText className="h-8 w-8 text-yellow-600" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm text-yellow-600 group-hover:text-yellow-700">
                    <span>View all quotes</span>
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </Link>

                {/* Upcoming Bookings Card */}
                <Link 
                  to="/app/bookings?status=CONFIRMED"
                  className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                        Upcoming Bookings
                      </p>
                      {isLoading ? (
                        <div className="mt-2 h-10 w-16 bg-gray-200 rounded animate-pulse"></div>
                      ) : (
                        <>
                          <p className="mt-2 text-4xl font-bold text-green-600">
                            {summaryCardsData.upcoming_bookings_count}
                          </p>
                          {summaryCardsData.next_booking_date && (
                            <p className="mt-2 text-xs text-gray-500">
                              Next: {formatDate(summaryCardsData.next_booking_date)}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="bg-green-100 rounded-full p-3 group-hover:bg-green-200 transition-colors">
                      <Calendar className="h-8 w-8 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm text-green-600 group-hover:text-green-700">
                    <span>View bookings</span>
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </Link>

                {/* Balance Due Card */}
                <Link 
                  to="/app/orders?payment_status=pending"
                  className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                        Balance Due
                      </p>
                      {isLoading ? (
                        <div className="mt-2 h-10 w-20 bg-gray-200 rounded animate-pulse"></div>
                      ) : (
                        <p className="mt-2 text-4xl font-bold text-red-600">
                          €{Number(summaryCardsData.balance_due_amount).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="bg-red-100 rounded-full p-3 group-hover:bg-red-200 transition-colors">
                      <DollarSign className="h-8 w-8 text-red-600" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm text-red-600 group-hover:text-red-700">
                    <span>View orders</span>
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </Link>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Link
                    to="/app/quotes/new"
                    className="flex items-center justify-center px-6 py-4 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <FileText className="h-5 w-5 mr-2" />
                    Get a New Quote
                  </Link>
                  
                  <Link
                    to="/app/orders"
                    className="flex items-center justify-center px-6 py-4 border-2 border-gray-300 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-all duration-200"
                  >
                    <ClipboardList className="h-5 w-5 mr-2" />
                    View All Orders
                  </Link>
                  
                  <Link
                    to="/contact"
                    className="flex items-center justify-center px-6 py-4 border-2 border-gray-300 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-all duration-200"
                  >
                    Contact Support
                  </Link>
                </div>
              </div>

              {/* Next Steps */}
              {nextActions.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    ⚠️ Action Required
                  </h2>
                  <div className="space-y-3">
                    {nextActions.map((action, index) => (
                      <Link
                        key={`${action.type}-${index}`}
                        to={action.action_url}
                        className="flex items-center justify-between p-4 bg-orange-50 border-l-4 border-orange-500 rounded-lg hover:bg-orange-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          {action.priority === 'HIGH' && (
                            <div className="flex-shrink-0">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Urgent
                              </span>
                            </div>
                          )}
                          <p className="text-sm font-medium text-gray-900">{action.message}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-orange-600 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Recent Activity Feed */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 sticky top-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-gray-600" />
                  Recent Activity
                </h2>
                
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                      <ClipboardList className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm">No recent activity</p>
                    <Link
                      to="/app/quotes/new"
                      className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Get started with a quote
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {recentActivity.map((activity) => (
                      <Link
                        key={activity.id}
                        to={activity.action_url || '#'}
                        className="block group"
                      >
                        <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex-shrink-0 mt-0.5">
                            <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                              {activity.message}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatTimestamp(activity.timestamp)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="mt-8 max-w-7xl mx-auto">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty State (No Orders or Quotes) */}
          {!isLoading && 
           summaryCardsData.active_orders_count === 0 && 
           summaryCardsData.pending_quotes_count === 0 && 
           summaryCardsData.upcoming_bookings_count === 0 && (
            <div className="mt-8 bg-white rounded-xl p-12 shadow-lg border border-gray-100 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                <FileText className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to SultanStamp!
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                You haven't started any projects yet. Let's begin by creating your first quote.
              </p>
              <Link
                to="/app/quotes/new"
                className="inline-flex items-center justify-center px-8 py-4 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <FileText className="h-5 w-5 mr-2" />
                Get Your First Quote
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_CUST_Dashboard;