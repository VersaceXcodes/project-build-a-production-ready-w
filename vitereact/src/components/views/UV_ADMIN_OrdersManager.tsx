import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPES & INTERFACES
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

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

interface OrderListItem {
  order: Order;
  customer: User;
  service: Service;
  tier: TierPackage;
  assigned_staff: User | null;
  payment_summary?: {
    deposit_paid: boolean;
    balance_due: number;
  };
}

interface OrdersResponse {
  orders: OrderListItem[];
  total: number;
}

interface UsersResponse {
  users: Array<{
    user: User;
    profile: any;
  }>;
  total: number;
}

interface StaffMember {
  id: string;
  name: string;
  department: string | null;
}

interface Filters {
  status: string | null;
  assigned_to: string | null;
  payment_status: string | null;
  customer_search: string | null;
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchOrdersList = async (
  authToken: string,
  filters: Filters,
  page: number
): Promise<OrdersResponse> => {
  const params: Record<string, string> = {
    page: page.toString(),
  };

  if (filters.status) params.status = filters.status;
  if (filters.assigned_to) params.assigned_to = filters.assigned_to;
  if (filters.payment_status) params.payment_status = filters.payment_status;
  if (filters.customer_search) params.customer = filters.customer_search;

  const response = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/orders`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
      params,
    }
  );

  return response.data;
};

const fetchStaffMembers = async (authToken: string): Promise<StaffMember[]> => {
  const response = await axios.get<UsersResponse>(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/users`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { role: 'STAFF' },
    }
  );

  return response.data.users.map((u) => ({
    id: u.user.id,
    name: u.user.name,
    department: u.profile?.department || null,
  }));
};

const assignStaffToOrder = async (
  authToken: string,
  orderId: string,
  staffId: string | null
): Promise<void> => {
  await axios.patch(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${orderId}`,
    { assigned_staff_id: staffId },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_ADMIN_OrdersManager: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // CRITICAL: Individual Zustand selectors (no object destructuring)
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);

  // Initialize filters from URL params
  const [filters, setFilters] = useState<Filters>({
    status: searchParams.get('status') || null,
    assigned_to: searchParams.get('assigned_to') || null,
    payment_status: searchParams.get('payment_status') || null,
    customer_search: searchParams.get('customer') || null,
  });

  const [currentPage, setCurrentPage] = useState<number>(
    parseInt(searchParams.get('page') || '1', 10)
  );

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Sync URL params with state changes
  useEffect(() => {
    const params: Record<string, string> = {};

    if (filters.status) params.status = filters.status;
    if (filters.assigned_to) params.assigned_to = filters.assigned_to;
    if (filters.payment_status) params.payment_status = filters.payment_status;
    if (filters.customer_search) params.customer = filters.customer_search;
    if (currentPage > 1) params.page = currentPage.toString();

    setSearchParams(params);
  }, [filters, currentPage, setSearchParams]);

  // Fetch orders list
  const {
    data: ordersData,
    isLoading: isLoadingOrders,
    error: ordersError,
  } = useQuery({
    queryKey: ['admin-orders', filters, currentPage],
    queryFn: () => fetchOrdersList(authToken!, filters, currentPage),
    enabled: !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Fetch staff members for assignment dropdown
  const { data: staffMembers = [] } = useQuery({
    queryKey: ['staff-members'],
    queryFn: () => fetchStaffMembers(authToken!),
    enabled: !!authToken,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Mutation for staff assignment
  const assignStaffMutation = useMutation({
    mutationFn: ({ orderId, staffId }: { orderId: string; staffId: string | null }) =>
      assignStaffToOrder(authToken!, orderId, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      showToast({
        type: 'success',
        message: 'Staff assigned successfully',
        duration: 3000,
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Assignment failed',
        duration: 5000,
      });
    },
  });

  // Calculate summary cards from orders data
  const summaryCards = useMemo(() => {
    if (!ordersData?.orders) {
      return {
        total_orders: 0,
        active_orders: 0,
        awaiting_approval: 0,
        overdue_count: 0,
        pending_payments: 0,
      };
    }

    const orders = ordersData.orders;
    const activeStatuses = ['SCHEDULED', 'IN_PRODUCTION', 'PROOF_SENT', 'AWAITING_APPROVAL', 'READY_FOR_PICKUP'];
    const now = new Date();

    return {
      total_orders: ordersData.total || orders.length,
      active_orders: orders.filter(o => activeStatuses.includes(o.order.status)).length,
      awaiting_approval: orders.filter(o => o.order.status === 'AWAITING_APPROVAL').length,
      overdue_count: orders.filter(o => 
        o.order.due_at && 
        new Date(o.order.due_at) < now && 
        o.order.status !== 'COMPLETED'
      ).length,
      pending_payments: orders.filter(o => 
        !o.payment_summary?.deposit_paid || 
        (o.payment_summary?.balance_due ?? 0) > 0
      ).length,
    };
  }, [ordersData]);

  // Filter change handlers
  const handleFilterChange = (key: keyof Filters, value: string | null) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to page 1 when filters change
    setSelectedOrderIds([]); // Clear selections
  };

  const handleResetFilters = () => {
    setFilters({
      status: null,
      assigned_to: null,
      payment_status: null,
      customer_search: null,
    });
    setCurrentPage(1);
    setSelectedOrderIds([]);
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (!ordersData?.orders) return;
    
    if (selectedOrderIds.length === ordersData.orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(ordersData.orders.map(o => o.order.id));
    }
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  // Staff assignment handler
  const handleStaffAssignment = (orderId: string, staffId: string) => {
    assignStaffMutation.mutate({ orderId, staffId: staffId || null });
  };

  // Export CSV handler
  const handleExportCSV = () => {
    if (!ordersData?.orders) return;

    const headers = [
      'Order ID',
      'Customer Name',
      'Customer Email',
      'Service',
      'Tier',
      'Status',
      'Due Date',
      'Total Amount',
      'Deposit Paid',
      'Balance Due',
      'Assigned Staff',
      'Created At',
    ];

    const rows = ordersData.orders.map(item => [
      item.order.id,
      item.customer.name,
      item.customer.email,
      item.service.name,
      item.tier.name,
      item.order.status,
      item.order.due_at || 'N/A',
      `€${Number(item.order.total_amount || 0).toFixed(2)}`,
      item.payment_summary?.deposit_paid ? 'Yes' : 'No',
      `€${Number(item.payment_summary?.balance_due || 0).toFixed(2)}`,
      item.assigned_staff?.name || 'Unassigned',
      new Date(item.order.created_at).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    showToast({
      type: 'success',
      message: 'Orders exported successfully',
      duration: 3000,
    });
  };

  // Bulk assign staff handler
  const handleBulkAssignStaff = async (staffId: string) => {
    if (selectedOrderIds.length === 0) {
      showToast({
        type: 'warning',
        message: 'No orders selected',
        duration: 3000,
      });
      return;
    }

    setBulkActionLoading(true);

    try {
      // Use allSettled to allow partial success
      const results = await Promise.allSettled(
        selectedOrderIds.map(orderId =>
          assignStaffToOrder(authToken!, orderId, staffId)
        )
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setSelectedOrderIds([]);

      if (failed === 0) {
        showToast({
          type: 'success',
          message: `${succeeded} orders assigned successfully`,
          duration: 3000,
        });
      } else if (succeeded > 0) {
        showToast({
          type: 'info',
          message: `${succeeded} orders assigned, ${failed} failed`,
          duration: 5000,
        });
      } else {
        showToast({
          type: 'error',
          message: 'All bulk assignments failed',
          duration: 5000,
        });
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Bulk assignment failed',
        duration: 5000,
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Status badge color mapping
  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      QUOTE_REQUESTED: 'bg-gray-100 text-gray-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      IN_PRODUCTION: 'bg-yellow-100 text-yellow-800',
      PROOF_SENT: 'bg-purple-100 text-purple-800',
      AWAITING_APPROVAL: 'bg-orange-100 text-orange-800',
      READY_FOR_PICKUP: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-green-600 text-white',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  // Format status label
  const formatStatus = (status: string): string => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Check if order is overdue
  const isOrderOverdue = (order: Order): boolean => {
    if (!order.due_at || order.status === 'COMPLETED') return false;
    return new Date(order.due_at) < new Date();
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Orders Management</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage all orders across the business
                </p>
              </div>
              <Link
                to="/admin"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {summaryCards.total_orders}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Orders</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {summaryCards.active_orders}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Awaiting Approval</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {summaryCards.awaiting_approval}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="mt-2 text-3xl font-bold text-red-600">
                    {summaryCards.overdue_count}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {summaryCards.pending_payments}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  id="status-filter"
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="QUOTE_REQUESTED">Quote Requested</option>
                  <option value="APPROVED">Approved</option>
                  <option value="IN_PRODUCTION">In Production</option>
                  <option value="PROOF_SENT">Proof Sent</option>
                  <option value="AWAITING_APPROVAL">Awaiting Approval</option>
                  <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Assigned To Filter */}
              <div>
                <label htmlFor="assigned-to-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Assigned To
                </label>
                <select
                  id="assigned-to-filter"
                  value={filters.assigned_to || ''}
                  onChange={(e) => handleFilterChange('assigned_to', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Staff</option>
                  <option value="unassigned">Unassigned</option>
                  {staffMembers.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} {staff.department ? `(${staff.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Status Filter */}
              <div>
                <label htmlFor="payment-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Status
                </label>
                <select
                  id="payment-filter"
                  value={filters.payment_status || ''}
                  onChange={(e) => handleFilterChange('payment_status', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Payments</option>
                  <option value="deposit_pending">Deposit Pending</option>
                  <option value="balance_due">Balance Due</option>
                  <option value="fully_paid">Fully Paid</option>
                </select>
              </div>

              {/* Customer Search */}
              <div>
                <label htmlFor="customer-search" className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Search
                </label>
                <input
                  id="customer-search"
                  type="text"
                  value={filters.customer_search || ''}
                  onChange={(e) => handleFilterChange('customer_search', e.target.value || null)}
                  placeholder="Name or email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar (show when orders selected) - STICKY */}
        {selectedOrderIds.length > 0 && (
          <div className="sticky top-0 z-30 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-blue-900">
                  {selectedOrderIds.length} order{selectedOrderIds.length !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedOrderIds([])}
                  className="text-sm text-blue-700 hover:text-blue-900 underline"
                >
                  Clear selection
                </button>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleExportCSV}
                  disabled={bulkActionLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Export Selected
                </button>

                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkAssignStaff(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  disabled={bulkActionLoading}
                  className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Assign to Staff...</option>
                  {staffMembers.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Loading State */}
            {isLoadingOrders && (
              <div className="text-center py-12">
                <svg className="animate-spin h-8 w-8 mx-auto text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-3 text-sm text-gray-600">Loading orders...</p>
              </div>
            )}

            {/* Error State */}
            {ordersError && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">Error loading orders</p>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-orders'] })}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoadingOrders && !ordersError && (!ordersData?.orders || ordersData.orders.length === 0) && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your filters or create a new order.
                </p>
                <div className="mt-6">
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            )}

            {/* Orders Table */}
            {!isLoadingOrders && !ordersError && ordersData?.orders && ordersData.orders.length > 0 && (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="w-12 px-6 py-3">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.length === ordersData.orders.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Order ID
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
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
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned To
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {ordersData.orders.map((item) => (
                        <tr
                          key={item.order.id}
                          className={`hover:bg-gray-50 transition-colors ${
                            isOrderOverdue(item.order) ? 'bg-red-50' : ''
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.includes(item.order.id)}
                              onChange={() => handleSelectOrder(item.order.id)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              #{item.order.id.slice(0, 8)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{item.customer.name}</div>
                            <div className="text-sm text-gray-500">{item.customer.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{item.service.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                              {item.tier.name}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.order.status)}`}>
                              {formatStatus(item.order.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.order.due_at ? (
                              <div className="text-sm">
                                <div className={isOrderOverdue(item.order) ? 'text-red-600 font-medium' : 'text-gray-900'}>
                                  {new Date(item.order.due_at).toLocaleDateString()}
                                </div>
                                {isOrderOverdue(item.order) && (
                                  <div className="text-xs text-red-600">Overdue</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              €{Number(item.order.total_amount || 0).toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-xs space-y-1">
                              <div className={item.payment_summary?.deposit_paid ? 'text-green-600' : 'text-orange-600'}>
                                Deposit: {item.payment_summary?.deposit_paid ? '✓ Paid' : '⏳ Pending'}
                              </div>
                              <div className={Number(item.payment_summary?.balance_due || 0) > 0 ? 'text-orange-600' : 'text-green-600'}>
                                Balance: €{Number(item.payment_summary?.balance_due || 0).toFixed(2)}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={item.order.assigned_staff_id || ''}
                              onChange={(e) => handleStaffAssignment(item.order.id, e.target.value)}
                              disabled={assignStaffMutation.isPending}
                              className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                              <option value="">Unassigned</option>
                              {staffMembers.map(staff => (
                                <option key={staff.id} value={staff.id}>
                                  {staff.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              to={`/admin/orders/${item.order.id}`}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List */}
                <div className="lg:hidden divide-y divide-gray-200">
                  {ordersData.orders.map((item) => (
                    <div
                      key={item.order.id}
                      className={`p-4 ${isOrderOverdue(item.order) ? 'bg-red-50' : 'bg-white'}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(item.order.id)}
                            onChange={() => handleSelectOrder(item.order.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              #{item.order.id.slice(0, 8)}
                            </div>
                            <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.order.status)}`}>
                              {formatStatus(item.order.status)}
                            </span>
                          </div>
                        </div>
                        <Link
                          to={`/admin/orders/${item.order.id}`}
                          className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                        >
                          View →
                        </Link>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Customer:</span>
                          <span className="font-medium text-gray-900">{item.customer.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Service:</span>
                          <span className="text-gray-900">{item.service.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tier:</span>
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                            {item.tier.name}
                          </span>
                        </div>
                        {item.order.due_at && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Due:</span>
                            <span className={isOrderOverdue(item.order) ? 'text-red-600 font-medium' : 'text-gray-900'}>
                              {new Date(item.order.due_at).toLocaleDateString()}
                              {isOrderOverdue(item.order) && ' (Overdue)'}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-medium text-gray-900">
                            €{Number(item.order.total_amount || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payment:</span>
                          <div className="text-right">
                            <div className={`text-xs ${item.payment_summary?.deposit_paid ? 'text-green-600' : 'text-orange-600'}`}>
                              Deposit: {item.payment_summary?.deposit_paid ? '✓' : '⏳'}
                            </div>
                            <div className={`text-xs ${Number(item.payment_summary?.balance_due || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              Balance: €{Number(item.payment_summary?.balance_due || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-gray-200">
                          <label className="block text-xs text-gray-600 mb-1">Assigned To:</label>
                          <select
                            value={item.order.assigned_staff_id || ''}
                            onChange={(e) => handleStaffAssignment(item.order.id, e.target.value)}
                            disabled={assignStaffMutation.isPending}
                            className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          >
                            <option value="">Unassigned</option>
                            {staffMembers.map(staff => (
                              <option key={staff.id} value={staff.id}>
                                {staff.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {ordersData && ordersData.total > 20 && (
                  <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 flex justify-between sm:hidden">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage >= Math.ceil(ordersData.total / 20)}
                          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-700">
                            Showing{' '}
                            <span className="font-medium">
                              {(currentPage - 1) * 20 + 1}
                            </span>{' '}
                            to{' '}
                            <span className="font-medium">
                              {Math.min(currentPage * 20, ordersData.total)}
                            </span>{' '}
                            of{' '}
                            <span className="font-medium">{ordersData.total}</span> results
                          </p>
                        </div>
                        <div>
                          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                            <button
                              onClick={() => handlePageChange(currentPage - 1)}
                              disabled={currentPage === 1}
                              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span className="sr-only">Previous</span>
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            
                            {/* Page numbers */}
                            {Array.from({ length: Math.ceil(ordersData.total / 20) }, (_, i) => i + 1)
                              .filter(page => 
                                page === 1 || 
                                page === Math.ceil(ordersData.total / 20) || 
                                Math.abs(page - currentPage) <= 2
                              )
                              .map(page => (
                                <button
                                  key={page}
                                  onClick={() => handlePageChange(page)}
                                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                    page === currentPage
                                      ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              ))}
                            
                            <button
                              onClick={() => handlePageChange(currentPage + 1)}
                              disabled={currentPage >= Math.ceil(ordersData.total / 20)}
                              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span className="sr-only">Next</span>
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </nav>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_ADMIN_OrdersManager;