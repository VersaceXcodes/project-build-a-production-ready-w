import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// =====================================================
// TYPE DEFINITIONS
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
  created_at: Date;
  updated_at: Date;
}

interface Service {
  id: string;
  name: string;
  slug: string;
}

interface TierPackage {
  id: string;
  name: string;
  slug: string;
}

interface PaymentStatus {
  deposit_paid: boolean;
  balance_due: number;
}

interface OrderListItem {
  order: Order;
  service: Service;
  tier: TierPackage;
  payment_status: PaymentStatus;
}

interface OrdersResponse {
  orders: OrderListItem[];
  total: number;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

const UV_CUST_OrdersList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // CRITICAL: Individual selectors, no object destructuring
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);

  // Parse URL parameters
  const statusParam = searchParams.get('status');
  const searchParam = searchParams.get('search') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // Local state for controlled inputs
  const [searchInput, setSearchInput] = React.useState(searchParam);

  // Sync search input with URL param on mount
  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  // =====================================================
  // API DATA FETCHING
  // =====================================================

  const fetchOrders = async (): Promise<OrdersResponse> => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    
    const params: Record<string, string | number> = {
      page: pageParam,
    };

    if (statusParam) {
      params.status = statusParam;
    }

    if (searchParam) {
      params.search = searchParam;
    }

    const response = await axios.get<OrdersResponse>(
      `${API_BASE_URL}/api/orders`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        params,
      }
    );

    // Transform response to ensure proper types
    return {
      orders: response.data.orders.map(item => ({
        order: {
          ...item.order,
          created_at: new Date(item.order.created_at),
          updated_at: new Date(item.order.updated_at),
        },
        service: item.service,
        tier: item.tier,
        payment_status: item.payment_status,
      })),
      total: response.data.total,
    };
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-orders', statusParam, searchParam, pageParam],
    queryFn: fetchOrders,
    enabled: !!authToken,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // =====================================================
  // FILTER & NAVIGATION HANDLERS
  // =====================================================

  const applyStatusFilter = (status: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    
    if (status) {
      newParams.set('status', status);
    } else {
      newParams.delete('status');
    }
    
    // Reset to page 1 when filter changes
    newParams.delete('page');
    
    setSearchParams(newParams);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newParams = new URLSearchParams(searchParams);
    
    if (searchInput.trim()) {
      newParams.set('search', searchInput.trim());
    } else {
      newParams.delete('search');
    }
    
    // Reset to page 1 when search changes
    newParams.delete('page');
    
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
  };

  const navigateToOrderDetail = (orderId: string) => {
    navigate(`/app/orders/${orderId}`);
  };

  const navigateToPayment = (orderId: string) => {
    navigate(`/app/orders/${orderId}/deposit`);
  };

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================

  const getStatusBadgeColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      QUOTE_REQUESTED: 'bg-gray-100 text-gray-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      IN_PRODUCTION: 'bg-yellow-100 text-yellow-800',
      PROOF_SENT: 'bg-purple-100 text-purple-800',
      AWAITING_APPROVAL: 'bg-orange-100 text-orange-800',
      READY_FOR_PICKUP: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-green-600 text-white',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatStatus = (status: string): string => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Not set';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays < 0) {
      return `Overdue by ${Math.abs(diffInDays)} day${Math.abs(diffInDays) !== 1 ? 's' : ''}`;
    } else if (diffInDays === 0) {
      return 'Due today';
    } else if (diffInDays === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${diffInDays} days`;
    }
  };

  const isActiveStatus = (status: string): boolean => {
    const activeStatuses = [
      'QUOTE_REQUESTED',
      'APPROVED',
      'IN_PRODUCTION',
      'PROOF_SENT',
      'AWAITING_APPROVAL',
      'READY_FOR_PICKUP',
    ];
    return activeStatuses.includes(status);
  };

  const getFilteredOrders = (): OrderListItem[] => {
    if (!data?.orders) return [];
    
    const filteredByStatus = statusParam
      ? data.orders.filter(item => {
          if (statusParam === 'active') {
            return isActiveStatus(item.order.status);
          } else if (statusParam === 'completed') {
            return item.order.status === 'COMPLETED';
          } else if (statusParam === 'cancelled') {
            return item.order.status === 'CANCELLED';
          }
          return true;
        })
      : data.orders;

    // Sort active orders by due date (nearest first)
    if (!statusParam || statusParam === 'active') {
      return [...filteredByStatus].sort((a, b) => {
        if (!a.order.due_at && !b.order.due_at) return 0;
        if (!a.order.due_at) return 1;
        if (!b.order.due_at) return -1;
        return new Date(a.order.due_at).getTime() - new Date(b.order.due_at).getTime();
      });
    }

    return filteredByStatus;
  };

  const orders = getFilteredOrders();
  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="md:flex md:items-center md:justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
              </div>
              <div className="mt-4 flex md:mt-0 md:ml-4">
                <Link
                  to="/app/quotes/new"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-black bg-yellow-400 hover:bg-yellow-500 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Quote
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Filter Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                <button
                  onClick={() => applyStatusFilter(null)}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    !statusParam
                      ? 'border-yellow-400 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => applyStatusFilter('active')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    statusParam === 'active'
                      ? 'border-yellow-400 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => applyStatusFilter('completed')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    statusParam === 'completed'
                      ? 'border-yellow-400 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Completed
                </button>
                <button
                  onClick={() => applyStatusFilter('cancelled')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    statusParam === 'cancelled'
                      ? 'border-yellow-400 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Cancelled
                </button>
              </nav>
            </div>

            {/* Search Bar */}
            <div className="p-4">
              <form onSubmit={handleSearchSubmit} className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="search" className="sr-only">
                    Search orders
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      id="search"
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search by order ID or service..."
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 sm:text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors"
                >
                  Search
                </button>
                {searchParam && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      const newParams = new URLSearchParams(searchParams);
                      newParams.delete('search');
                      newParams.delete('page');
                      setSearchParams(newParams);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm text-red-700">
                    {error instanceof Error ? error.message : 'Failed to load orders. Please try again.'}
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => refetch()}
                    className="inline-flex text-sm font-medium text-red-700 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="animate-pulse p-6">
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && orders.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchParam ? 'No orders found' : 'No orders yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchParam 
                  ? 'Try adjusting your search or filters.'
                  : 'Start by requesting a quote for your first project.'}
              </p>
              <Link
                to="/app/quotes/new"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-black bg-yellow-400 hover:bg-yellow-500 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Get a Quote
              </Link>
            </div>
          )}

          {/* Orders List - Desktop Table */}
          {!isLoading && !error && orders.length > 0 && (
            <>
              <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Service
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tier
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((item) => {
                      const isOverdue = item.order.due_at && new Date(item.order.due_at) < new Date();
                      
                      return (
                        <tr
                          key={item.order.id}
                          onClick={() => navigateToOrderDetail(item.order.id)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              #{item.order.id.substring(0, 8).toUpperCase()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{item.service.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {item.tier.name}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(item.order.status)}`}>
                              {formatStatus(item.order.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                              {formatDate(item.order.due_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              €{Number(item.order.total_amount || 0).toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              {item.payment_status.deposit_paid && item.payment_status.balance_due <= 0 ? (
                                <span className="text-green-600 font-medium">✓ Paid</span>
                              ) : item.payment_status.deposit_paid && item.payment_status.balance_due > 0 ? (
                                <span className="text-orange-600 font-medium">
                                  Due €{Number(item.payment_status.balance_due || 0).toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-red-600 font-medium">
                                  Deposit Due €{Number(item.order.deposit_amount || 0).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToOrderDetail(item.order.id);
                              }}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              View Details
                            </button>
                            {item.payment_status.balance_due > 0 && item.payment_status.deposit_paid && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToPayment(item.order.id);
                                }}
                                className="text-yellow-600 hover:text-yellow-700 font-medium"
                              >
                                Pay Balance
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Orders List - Mobile Cards */}
              <div className="md:hidden space-y-4">
                {orders.map((item) => {
                  const isOverdue = item.order.due_at && new Date(item.order.due_at) < new Date();
                  
                  return (
                    <div
                      key={item.order.id}
                      onClick={() => navigateToOrderDetail(item.order.id)}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      {/* Order Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="text-xs font-medium text-gray-500 mb-1">
                            Order #{item.order.id.substring(0, 8).toUpperCase()}
                          </div>
                          <h3 className="text-base font-semibold text-gray-900 mb-1">
                            {item.service.name}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {item.tier.name}
                          </span>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(item.order.status)}`}>
                          {formatStatus(item.order.status)}
                        </span>
                      </div>

                      {/* Order Details */}
                      <div className="grid grid-cols-2 gap-4 mb-4 pt-3 border-t border-gray-100">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Due Date</div>
                          <div className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatDate(item.order.due_at)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Total</div>
                          <div className="text-sm font-medium text-gray-900">
                            €{Number(item.order.total_amount || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Payment Status */}
                      <div className="mb-4 pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">Payment Status</div>
                        {item.payment_status.deposit_paid && item.payment_status.balance_due <= 0 ? (
                          <div className="text-sm font-medium text-green-600">✓ Paid in Full</div>
                        ) : item.payment_status.deposit_paid && item.payment_status.balance_due > 0 ? (
                          <div className="text-sm font-medium text-orange-600">
                            Balance Due: €{Number(item.payment_status.balance_due || 0).toFixed(2)}
                          </div>
                        ) : (
                          <div className="text-sm font-medium text-red-600">
                            Deposit Due: €{Number(item.order.deposit_amount || 0).toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToOrderDetail(item.order.id);
                          }}
                          className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors"
                        >
                          View Details
                        </button>
                        {item.payment_status.balance_due > 0 && item.payment_status.deposit_paid && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToPayment(item.order.id);
                            }}
                            className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-black bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors"
                          >
                            Pay Balance
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg shadow-sm">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(Math.max(1, pageParam - 1))}
                      disabled={pageParam <= 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(Math.min(totalPages, pageParam + 1))}
                      disabled={pageParam >= totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing page <span className="font-medium">{pageParam}</span> of{' '}
                        <span className="font-medium">{totalPages}</span>
                        {' '}({data?.total || 0} total orders)
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => handlePageChange(Math.max(1, pageParam - 1))}
                          disabled={pageParam <= 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNumber = i + 1;
                          return (
                            <button
                              key={pageNumber}
                              onClick={() => handlePageChange(pageNumber)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                pageParam === pageNumber
                                  ? 'z-10 bg-yellow-50 border-yellow-400 text-yellow-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNumber}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => handlePageChange(Math.min(totalPages, pageParam + 1))}
                          disabled={pageParam >= totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_CUST_OrdersList;