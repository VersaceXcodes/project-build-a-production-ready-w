import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface JobListItem {
  order: {
    id: string;
    customer_id: string;
    tier_id: string;
    status: string;
    due_at: string | null;
    revision_count: number;
    assigned_staff_id: string | null;
    created_at: string;
    updated_at: string;
  };
  customer_name: string;
  service_name: string;
  tier_name: string;
  is_overdue: boolean;
  priority_level: string;
}

interface BookingItem {
  id: string;
  quote_id: string;
  customer_id: string;
  start_at: string;
  end_at: string;
  status: string;
  is_emergency: boolean;
  service_name?: string;
  customer_name?: string;
}

interface JobSummary {
  assigned_jobs_count: number;
  awaiting_action_count: number;
  due_today_count: number;
  overdue_count: number;
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchStaffJobs = async (auth_token: string | null): Promise<JobListItem[]> => {
  if (!auth_token) throw new Error('No auth token');

  const response = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/staff/jobs`,
    {
      headers: { Authorization: `Bearer ${auth_token}` }
    }
  );

  return response.data;
};

const fetchTodaysBookings = async (auth_token: string | null): Promise<BookingItem[]> => {
  if (!auth_token) throw new Error('No auth token');

  const response = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings`,
    {
      params: { status: 'CONFIRMED' },
      headers: { Authorization: `Bearer ${auth_token}` }
    }
  );

  return response.data;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_STAFF_Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // CRITICAL: Individual selectors, no object destructuring
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const current_user = useAppStore(state => state.authentication_state.current_user);

  // Fetch staff jobs with React Query
  const {
    data: jobs_data = [],
    isLoading: jobs_loading,
    error: jobs_error,
    refetch: refetch_jobs
  } = useQuery({
    queryKey: ['staff', 'jobs', current_user?.id],
    queryFn: () => fetchStaffJobs(auth_token),
    enabled: !!auth_token && !!current_user,
    refetchInterval: 60000, // Auto-refresh every 60 seconds
    staleTime: 30000,
    retry: 1
  });

  // Fetch today's bookings with React Query
  const {
    data: bookings_data = [],
    isLoading: bookings_loading,
    error: bookings_error,
    refetch: refetch_bookings
  } = useQuery({
    queryKey: ['staff', 'bookings', 'today'],
    queryFn: () => fetchTodaysBookings(auth_token),
    enabled: !!auth_token && !!current_user,
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 1
  });

  // Calculate job summary from jobs data
  const job_summary: JobSummary = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const assigned_jobs = jobs_data.filter(job => 
      job.order.assigned_staff_id === current_user?.id
    );

    return {
      assigned_jobs_count: assigned_jobs.length,
      awaiting_action_count: assigned_jobs.filter(job => 
        job.order.status === 'IN_PRODUCTION' || job.order.status === 'PROOF_SENT'
      ).length,
      due_today_count: assigned_jobs.filter(job => 
        job.order.due_at && job.order.due_at.split('T')[0] === today
      ).length,
      overdue_count: assigned_jobs.filter(job => 
        job.order.due_at && new Date(job.order.due_at) < now
      ).length
    };
  }, [jobs_data, current_user?.id]);

  // Get priority jobs (top 5, sorted by priority)
  const priority_jobs = useMemo(() => {
    const now = new Date();
    
    return [...jobs_data]
      .sort((a, b) => {
        // Priority: overdue > enterprise tier > due soonest
        const a_overdue = a.order.due_at ? new Date(a.order.due_at) < now : false;
        const b_overdue = b.order.due_at ? new Date(b.order.due_at) < now : false;
        
        if (a_overdue && !b_overdue) return -1;
        if (!a_overdue && b_overdue) return 1;
        
        // Enterprise tier priority
        const a_enterprise = a.tier_name?.toLowerCase() === 'enterprise';
        const b_enterprise = b.tier_name?.toLowerCase() === 'enterprise';
        
        if (a_enterprise && !b_enterprise) return -1;
        if (!a_enterprise && b_enterprise) return 1;
        
        // Sort by due date (soonest first)
        if (a.order.due_at && b.order.due_at) {
          return new Date(a.order.due_at).getTime() - new Date(b.order.due_at).getTime();
        }
        if (a.order.due_at) return -1;
        if (b.order.due_at) return 1;
        
        return 0;
      })
      .slice(0, 5);
  }, [jobs_data]);

  // Filter today's bookings
  const todays_bookings = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    return bookings_data.filter(booking => 
      booking.start_at.split('T')[0] === today
    ).sort((a, b) => 
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
  }, [bookings_data]);

  // Calculate days until due
  const getDaysUntilDue = (due_at: string | null): number | null => {
    if (!due_at) return null;
    const now = new Date();
    const due = new Date(due_at);
    const diff = due.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Format time from ISO timestamp
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const is_loading = jobs_loading || bookings_loading;
  const error = jobs_error || bookings_error;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {current_user?.name}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Staff Dashboard - Manage your assigned jobs and today's schedule
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Error State */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700">
                    Failed to load dashboard data. Please try again.
                  </p>
                </div>
                <button
                  onClick={() => {
                    refetch_jobs();
                    refetch_bookings();
                  }}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm font-medium hover:bg-red-200 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Assigned Jobs Card */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">My Assigned Jobs</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {is_loading ? (
                        <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded"></span>
                      ) : (
                        job_summary.assigned_jobs_count
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <Link
                  to="/staff/jobs"
                  className="mt-4 block text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  View All →
                </Link>
              </div>
            </div>

            {/* Awaiting Action Card */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Awaiting My Action</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {is_loading ? (
                        <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded"></span>
                      ) : (
                        job_summary.awaiting_action_count
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <Link
                  to="/staff/jobs?status=IN_PRODUCTION"
                  className="mt-4 block text-sm text-yellow-600 hover:text-yellow-700 font-medium transition-colors"
                >
                  View All →
                </Link>
              </div>
            </div>

            {/* Due Today Card */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Due Today</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {is_loading ? (
                        <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded"></span>
                      ) : (
                        job_summary.due_today_count
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <svg className="h-8 w-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <Link
                  to="/staff/jobs"
                  className="mt-4 block text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors"
                >
                  View All →
                </Link>
              </div>
            </div>

            {/* Overdue Card */}
            <div className="bg-white rounded-xl shadow-lg border border-red-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Overdue</p>
                    <p className="mt-2 text-3xl font-bold text-red-600">
                      {is_loading ? (
                        <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded"></span>
                      ) : (
                        job_summary.overdue_count
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-lg">
                    <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <Link
                  to="/staff/jobs"
                  className="mt-4 block text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                >
                  View All →
                </Link>
              </div>
            </div>
          </div>

          {/* Priority Jobs Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900">Top Priority Jobs</h2>
              <p className="text-sm text-gray-600 mt-1">
                Sorted by urgency: overdue → Enterprise tier → earliest due date
              </p>
            </div>

            {is_loading ? (
              <div className="p-6">
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-lg"></div>
                  ))}
                </div>
              </div>
            ) : priority_jobs.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="h-16 w-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 text-lg">No jobs assigned yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {priority_jobs.map((job) => {
                  const days_until_due = getDaysUntilDue(job.order.due_at);
                  const is_overdue = job.is_overdue;
                  const is_enterprise = job.tier_name?.toLowerCase() === 'enterprise';

                  return (
                    <div
                      key={job.order.id}
                      className={`p-6 hover:bg-gray-50 transition-colors cursor-pointer ${
                        is_overdue ? 'bg-red-50 border-l-4 border-red-600' : ''
                      }`}
                      onClick={() => navigate(`/staff/jobs/${job.order.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="text-sm font-medium text-gray-500">
                              #{job.order.id.slice(-8).toUpperCase()}
                            </span>
                            
                            {is_enterprise && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                ⭐ Enterprise
                              </span>
                            )}
                            
                            {is_overdue && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                🚨 Overdue
                              </span>
                            )}
                            
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              job.order.status === 'IN_PRODUCTION' 
                                ? 'bg-blue-100 text-blue-800'
                                : job.order.status === 'PROOF_SENT'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {job.order.status.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {job.customer_name}
                          </h3>
                          
                          <p className="text-sm text-gray-600 mb-2">
                            {job.service_name} • {job.tier_name} Tier
                          </p>

                          {job.order.due_at && (
                            <p className={`text-sm font-medium ${
                              is_overdue 
                                ? 'text-red-600'
                                : days_until_due !== null && days_until_due <= 2
                                ? 'text-orange-600'
                                : 'text-gray-600'
                            }`}>
                              {is_overdue
                                ? `Overdue by ${Math.abs(days_until_due || 0)} day${Math.abs(days_until_due || 0) !== 1 ? 's' : ''}`
                                : days_until_due !== null
                                ? `Due in ${days_until_due} day${days_until_due !== 1 ? 's' : ''}`
                                : 'Due date not set'
                              }
                            </p>
                          )}
                        </div>

                        <div className="ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/staff/jobs/${job.order.id}`);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                          >
                            View Job
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions and Today's Schedule Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
              </div>
              <div className="p-6 space-y-4">
                <Link
                  to="/staff/jobs"
                  className="block w-full px-6 py-4 bg-yellow-500 text-black rounded-lg text-center font-semibold hover:bg-yellow-600 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  View All Jobs
                </Link>
                
                <Link
                  to="/staff/calendar"
                  className="block w-full px-6 py-4 bg-gray-100 text-gray-900 rounded-lg text-center font-semibold hover:bg-gray-200 transition-all duration-200 border border-gray-300"
                >
                  View Calendar
                </Link>
              </div>
            </div>

            {/* Today's Schedule */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-xl font-semibold text-gray-900">Today's Bookings</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {is_loading ? (
                <div className="p-6">
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-gray-200 animate-pulse rounded-lg"></div>
                    ))}
                  </div>
                </div>
              ) : todays_bookings.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="h-12 w-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500">No bookings scheduled for today</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {todays_bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                            </span>
                            {booking.is_emergency && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                ⚡ Emergency
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 font-medium">
                            {booking.customer_name || 'Customer'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {booking.service_name || 'Service'}
                          </p>
                        </div>
                        <Link
                          to={`/staff/jobs/${booking.quote_id}`}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                          View Job →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_STAFF_Dashboard;