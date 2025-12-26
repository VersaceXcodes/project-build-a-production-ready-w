import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Order {
  id: string;
  customer_id: string;
  tier_id: string;
  status: string;
  due_at: string | null;
  total_subtotal: number;
  total_amount: number;
  revision_count: number;
  assigned_staff_id: string | null;
  created_at: string;
  updated_at: string;
}

interface JobListItem {
  order: Order;
  customer_name: string;
  customer_email: string;
  service_name: string;
  tier_name: string;
  is_overdue: boolean;
  priority_level: 'HIGH' | 'NORMAL';
  days_until_due: number | null;
}

interface FilterState {
  status: string | null;
  priority: string | null;
  assigned_to: string | null;
}

interface SortConfig {
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchStaffJobs = async (
  authToken: string,
  filters: FilterState
): Promise<JobListItem[]> => {
  const params = new URLSearchParams();
  
  if (filters.status) params.append('status', filters.status);
  if (filters.priority) params.append('priority', filters.priority);
  if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);

  const response = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/staff/jobs?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    }
  );

  // Transform response with calculated fields
  const now = new Date();
  const processedJobs = response.data.map((job: any) => {
    const dueDate = job.due_at ? new Date(job.due_at) : null;
    const isOverdue = dueDate ? dueDate < now : false;
    const daysUntilDue = dueDate
      ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const priorityLevel =
      isOverdue || job.tier_name === 'Enterprise' ? 'HIGH' : 'NORMAL';

    return {
      order: {
        id: job.id,
        customer_id: job.customer_id,
        tier_id: job.tier_id,
        status: job.status,
        due_at: job.due_at,
        total_subtotal: Number(job.total_subtotal || 0),
        total_amount: Number(job.total_amount || 0),
        revision_count: Number(job.revision_count || 0),
        assigned_staff_id: job.assigned_staff_id,
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
      customer_name: job.customer_name,
      customer_email: job.customer_email,
      service_name: job.service_name,
      tier_name: job.tier_name,
      is_overdue: isOverdue,
      priority_level: priorityLevel,
      days_until_due: daysUntilDue,
    };
  });

  return processedJobs;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_STAFF_JobQueue: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // CRITICAL: Individual Zustand selectors (no object destructuring)
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);

  // Parse URL params into filter state
  const initialFilters: FilterState = {
    status: searchParams.get('status') || null,
    priority: searchParams.get('priority') || null,
    assigned_to: searchParams.get('assigned_to') || null,
  };

  const [activeFilters, setActiveFilters] = useState<FilterState>(initialFilters);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    sort_by: 'due_at',
    sort_order: 'asc',
  });

  // Sync URL params with filter state
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeFilters.status) params.set('status', activeFilters.status);
    if (activeFilters.priority) params.set('priority', activeFilters.priority);
    if (activeFilters.assigned_to) params.set('assigned_to', activeFilters.assigned_to);
    setSearchParams(params);
  }, [activeFilters, setSearchParams]);

  // Fetch jobs using React Query
  const {
    data: jobs = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['staff-jobs', activeFilters],
    queryFn: () => fetchStaffJobs(authToken!, activeFilters),
    enabled: !!authToken,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Apply client-side sorting
  const sortedJobs = useMemo(() => {
    if (!jobs || jobs.length === 0) return [];

    const sorted = [...jobs].sort((a, b) => {
      // Priority sorting: overdue > Enterprise > due soonest > created first
      if (a.is_overdue && !b.is_overdue) return -1;
      if (!a.is_overdue && b.is_overdue) return 1;

      if (a.tier_name === 'Enterprise' && b.tier_name !== 'Enterprise') return -1;
      if (a.tier_name !== 'Enterprise' && b.tier_name === 'Enterprise') return 1;

      // Then sort by selected column
      if (sortConfig.sort_by === 'due_at') {
        const aDue = a.order.due_at ? new Date(a.order.due_at).getTime() : Infinity;
        const bDue = b.order.due_at ? new Date(b.order.due_at).getTime() : Infinity;
        return sortConfig.sort_order === 'asc' ? aDue - bDue : bDue - aDue;
      }

      if (sortConfig.sort_by === 'customer_name') {
        const compare = a.customer_name.localeCompare(b.customer_name);
        return sortConfig.sort_order === 'asc' ? compare : -compare;
      }

      // Default: created_at
      const aCreated = new Date(a.order.created_at).getTime();
      const bCreated = new Date(b.order.created_at).getTime();
      return sortConfig.sort_order === 'asc' ? aCreated - bCreated : bCreated - aCreated;
    });

    return sorted;
  }, [jobs, sortConfig]);

  // Filter handlers
  const applyFilter = (filterKey: keyof FilterState, value: string | null) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterKey]: value,
    }));
  };

  const clearFilters = () => {
    setActiveFilters({
      status: null,
      priority: null,
      assigned_to: null,
    });
  };

  const changeSortOrder = (columnKey: string) => {
    setSortConfig(prev => ({
      sort_by: columnKey,
      sort_order: prev.sort_by === columnKey && prev.sort_order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const navigateToJobDetail = (orderId: string) => {
    navigate(`/staff/jobs/${orderId}`);
  };

  // Status badge styling
  const getStatusBadgeClass = (status: string): string => {
    const statusMap: Record<string, string> = {
      'QUOTE_REQUESTED': 'bg-gray-100 text-gray-800',
      'APPROVED': 'bg-blue-100 text-blue-800',
      'IN_PRODUCTION': 'bg-teal-100 text-teal-800',
      'PROOF_SENT': 'bg-purple-100 text-purple-800',
      'AWAITING_APPROVAL': 'bg-orange-100 text-orange-800',
      'READY_FOR_PICKUP': 'bg-green-100 text-green-800',
      'COMPLETED': 'bg-green-600 text-white',
      'CANCELLED': 'bg-red-100 text-red-800',
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };

  // Next action derivation
  const getNextAction = (status: string): string => {
    const actionMap: Record<string, string> = {
      'QUOTE_REQUESTED': 'Review quote',
      'APPROVED': 'Begin work',
      'IN_PRODUCTION': 'Upload proof',
      'PROOF_SENT': 'Awaiting customer',
      'AWAITING_APPROVAL': 'Awaiting customer',
      'READY_FOR_PICKUP': 'Prepare pickup',
      'COMPLETED': 'Completed',
      'CANCELLED': 'Cancelled',
    };
    return actionMap[status] || 'Continue work';
  };

  // Format due date display
  const formatDueDate = (daysUntilDue: number | null, isOverdue: boolean): string => {
    if (daysUntilDue === null) return 'No due date';
    if (isOverdue) return `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) > 1 ? 's' : ''}`;
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue === 1) return 'Due tomorrow';
    return `Due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}`;
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Jobs</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage your assigned jobs and priorities
                </p>
              </div>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5 inline-block mr-2 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-2 overflow-x-auto py-4">
              <button
                onClick={() => applyFilter('assigned_to', currentUser?.id || null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeFilters.assigned_to === currentUser?.id
                    ? 'bg-yellow-400 text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Assigned to Me
              </button>

              <button
                onClick={() => applyFilter('assigned_to', null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeFilters.assigned_to === null
                    ? 'bg-yellow-400 text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Jobs
              </button>

              <div className="w-px bg-gray-300 mx-2"></div>

              {['APPROVED', 'IN_PRODUCTION', 'PROOF_SENT', 'AWAITING_APPROVAL', 'READY_FOR_PICKUP'].map(
                (status) => (
                  <button
                    key={status}
                    onClick={() =>
                      applyFilter('status', activeFilters.status === status ? null : status)
                    }
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeFilters.status === status
                        ? 'bg-yellow-400 text-black'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.replace(/_/g, ' ')}
                  </button>
                )
              )}

              <div className="w-px bg-gray-300 mx-2"></div>

              <button
                onClick={() =>
                  applyFilter('priority', activeFilters.priority === 'high' ? null : 'high')
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeFilters.priority === 'high'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🚨 High Priority
              </button>

              {(activeFilters.status || activeFilters.priority) && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors whitespace-nowrap"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
                    <div className="h-8 bg-gray-200 rounded w-24"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Failed to load jobs</h3>
                  <p className="mt-1 text-sm text-red-700">
                    {error instanceof Error ? error.message : 'An error occurred'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && sortedJobs.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
              <p className="text-sm text-gray-600">
                {activeFilters.status || activeFilters.priority
                  ? 'Try adjusting your filters to see more jobs.'
                  : 'No jobs assigned yet. Check back soon!'}
              </p>
              {(activeFilters.status || activeFilters.priority) && (
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

          {/* Desktop Table View (hidden on mobile) */}
          {!isLoading && !error && sortedJobs.length > 0 && (
            <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => changeSortOrder('customer_name')}
                        className="flex items-center space-x-1 hover:text-gray-700"
                      >
                        <span>Customer</span>
                        {sortConfig.sort_by === 'customer_name' && (
                          <svg className={`w-4 h-4 ${sortConfig.sort_order === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => changeSortOrder('due_at')}
                        className="flex items-center space-x-1 hover:text-gray-700"
                      >
                        <span>Due Date</span>
                        {sortConfig.sort_by === 'due_at' && (
                          <svg className={`w-4 h-4 ${sortConfig.sort_order === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Next Action
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedJobs.map((job) => (
                    <tr
                      key={job.order.id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        job.is_overdue ? 'bg-red-50' : ''
                      }`}
                      onClick={() => navigateToJobDetail(job.order.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {job.priority_level === 'HIGH' && (
                            <span className="mr-2">
                              {job.is_overdue ? '🚨' : job.tier_name === 'Enterprise' ? '⭐' : ''}
                            </span>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {job.customer_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              #{job.order.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{job.service_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {job.tier_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                            job.order.status
                          )}`}
                        >
                          {job.order.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm ${
                            job.is_overdue ? 'text-red-600 font-semibold' : 'text-gray-900'
                          }`}
                        >
                          {formatDueDate(job.days_until_due, job.is_overdue)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{getNextAction(job.order.status)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={`/staff/jobs/${job.order.id}`}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Job
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile Card View (hidden on desktop) */}
          {!isLoading && !error && sortedJobs.length > 0 && (
            <div className="md:hidden space-y-4">
              {sortedJobs.map((job) => (
                <div
                  key={job.order.id}
                  onClick={() => navigateToJobDetail(job.order.id)}
                  className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer ${
                    job.is_overdue ? 'border-l-4 border-l-red-600' : ''
                  }`}
                >
                  {/* Priority Indicators */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      {job.priority_level === 'HIGH' && (
                        <span className="text-2xl">
                          {job.is_overdue ? '🚨' : job.tier_name === 'Enterprise' ? '⭐' : ''}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        #{job.order.id.slice(0, 8)}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                        job.order.status
                      )}`}
                    >
                      {job.order.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Customer & Service */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {job.customer_name}
                    </h3>
                    <p className="text-sm text-gray-600">{job.service_name}</p>
                  </div>

                  {/* Tier & Due Date */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Tier</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {job.tier_name}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Due Date</p>
                      <p
                        className={`text-sm font-medium ${
                          job.is_overdue ? 'text-red-600' : 'text-gray-900'
                        }`}
                      >
                        {formatDueDate(job.days_until_due, job.is_overdue)}
                      </p>
                    </div>
                  </div>

                  {/* Next Action */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Next Action</p>
                        <p className="text-sm font-medium text-gray-900">
                          {getNextAction(job.order.status)}
                        </p>
                      </div>
                      <Link
                        to={`/staff/jobs/${job.order.id}`}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Job
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Job Count Summary */}
          {!isLoading && !error && sortedJobs.length > 0 && (
            <div className="mt-6 text-sm text-gray-600 text-center">
              Showing {sortedJobs.length} job{sortedJobs.length !== 1 ? 's' : ''}
              {activeFilters.status && ` in ${activeFilters.status.replace(/_/g, ' ')}`}
              {activeFilters.priority === 'high' && ' (high priority)'}
              {activeFilters.assigned_to === currentUser?.id && ' assigned to you'}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_STAFF_JobQueue;