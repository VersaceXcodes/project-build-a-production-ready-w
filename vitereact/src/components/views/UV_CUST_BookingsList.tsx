import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Booking {
  id: string;
  quote_id: string;
  customer_id: string;
  start_at: string;
  end_at: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  is_emergency: boolean;
  urgent_fee_pct: number;
  created_at: string;
  updated_at: string;
}

interface BookingResponse {
  booking: Booking;
  quote: {
    id: string;
    service_id: string;
  };
  service: {
    id: string;
    name: string;
  };
}

interface BookingWithService extends Booking {
  service_name: string;
}

type FilterType = 'upcoming' | 'past' | 'cancelled' | null;

// ===========================
// API FUNCTIONS
// ===========================

const fetchCustomerBookings = async (
  auth_token: string,
  status_filter?: string
): Promise<BookingWithService[]> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  const params = new URLSearchParams();
  if (status_filter) {
    params.append('status', status_filter);
  }
  
  const query_string = params.toString() ? `?${params.toString()}` : '';
  
  const response = await axios.get<BookingResponse[]>(
    `${API_BASE_URL}/api/bookings${query_string}`,
    {
      headers: {
        'Authorization': `Bearer ${auth_token}`
      }
    }
  );
  
  // Transform response to include service_name at booking level
  return response.data.map((item) => ({
    id: item.booking.id,
    quote_id: item.booking.quote_id,
    customer_id: item.booking.customer_id,
    start_at: item.booking.start_at,
    end_at: item.booking.end_at,
    status: item.booking.status,
    is_emergency: item.booking.is_emergency,
    urgent_fee_pct: item.booking.urgent_fee_pct,
    service_name: item.service.name,
    created_at: item.booking.created_at,
    updated_at: item.booking.updated_at,
  }));
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_CUST_BookingsList: React.FC = () => {
  // URL params
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Global state (individual selectors to prevent infinite loops)
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const show_toast = useAppStore(state => state.show_toast);
  
  // Local state
  const [active_filter, set_active_filter] = useState<FilterType>(
    (searchParams.get('status') as FilterType) || null
  );
  
  // Fetch bookings with React Query
  const {
    data: bookings = [],
    isLoading: is_loading,
    error,
    refetch
  } = useQuery<BookingWithService[], Error>({
    queryKey: ['customer_bookings', auth_token],
    queryFn: () => fetchCustomerBookings(auth_token || ''),
    enabled: !!auth_token,
    staleTime: 60000, // Cache for 60 seconds
    refetchOnWindowFocus: false,
    retry: 1,
  });
  
  // Sync URL params with state on mount
  useEffect(() => {
    const status_param = searchParams.get('status') as FilterType;
    if (status_param !== active_filter) {
      set_active_filter(status_param);
    }
  }, [searchParams]);
  
  // Show error toast if fetch fails
  useEffect(() => {
    if (error) {
      show_toast({
        type: 'error',
        message: error.message || 'Failed to load bookings',
        duration: 5000,
      });
    }
  }, [error, show_toast]);
  
  // Categorize bookings into upcoming, past, cancelled
  const categorized_bookings = useMemo(() => {
    const now = new Date();
    
    return {
      upcoming: bookings.filter(b => 
        ['CONFIRMED', 'PENDING'].includes(b.status) && 
        new Date(b.start_at) > now
      ).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
      
      past: bookings.filter(b => 
        b.status === 'COMPLETED' || 
        (new Date(b.start_at) < now && b.status !== 'CANCELLED')
      ).sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()),
      
      cancelled: bookings.filter(b => b.status === 'CANCELLED')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    };
  }, [bookings]);
  
  // Get filtered bookings based on active filter
  const filtered_bookings = useMemo(() => {
    if (!active_filter) {
      return categorized_bookings.upcoming;
    }
    return categorized_bookings[active_filter] || [];
  }, [active_filter, categorized_bookings]);
  
  // Handle filter change
  const apply_status_filter = (filter: FilterType) => {
    set_active_filter(filter);
    
    // Update URL params
    if (filter) {
      searchParams.set('status', filter);
    } else {
      searchParams.delete('status');
    }
    setSearchParams(searchParams);
  };
  
  // Format date for display
  const format_booking_date = (start_at: string, end_at: string) => {
    const start = new Date(start_at);
    const end = new Date(end_at);
    
    const date_str = start.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const time_str = `${start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })} - ${end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`;
    
    return { date_str, time_str };
  };
  
  // Get status badge classes
  const get_status_badge_classes = (status: string) => {
    const status_map = {
      'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'CONFIRMED': 'bg-green-100 text-green-800 border-green-200',
      'COMPLETED': 'bg-blue-100 text-blue-800 border-blue-200',
      'CANCELLED': 'bg-red-100 text-red-800 border-red-200'
    };
    
    return status_map[status as keyof typeof status_map] || 'bg-gray-100 text-gray-800 border-gray-200';
  };
  
  // Format status text
  const format_status_text = (status: string) => {
    const status_labels = {
      'PENDING': 'Pending Confirmation',
      'CONFIRMED': 'Confirmed',
      'COMPLETED': 'Completed',
      'CANCELLED': 'Cancelled'
    };
    
    return status_labels[status as keyof typeof status_labels] || status;
  };
  
  // Get filter tab counts
  const filter_counts = useMemo(() => ({
    upcoming: categorized_bookings.upcoming.length,
    past: categorized_bookings.past.length,
    cancelled: categorized_bookings.cancelled.length
  }), [categorized_bookings]);

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Page Header */}
        <div className="bg-white border-b-2 border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
                <p className="mt-2 text-base text-gray-600">
                  View and manage your scheduled appointments
                </p>
              </div>
              
              <div className="mt-4 sm:mt-0">
                <Link
                  to="/app/quotes/new"
                  className="inline-flex items-center px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
                >
                  <svg 
                    className="w-5 h-5 mr-2" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 4v16m8-8H4" 
                    />
                  </svg>
                  New Quote
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
              <button
                onClick={() => apply_status_filter(null)}
                className={`whitespace-nowrap py-4 px-1 border-b-3 font-semibold text-base transition-colors duration-200 ${
                  active_filter === null
                    ? 'border-yellow-400 text-black'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Upcoming
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                  active_filter === null 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {filter_counts.upcoming}
                </span>
              </button>
              
              <button
                onClick={() => apply_status_filter('past')}
                className={`whitespace-nowrap py-4 px-1 border-b-3 font-semibold text-base transition-colors duration-200 ${
                  active_filter === 'past'
                    ? 'border-yellow-400 text-black'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Past
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                  active_filter === 'past' 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {filter_counts.past}
                </span>
              </button>
              
              <button
                onClick={() => apply_status_filter('cancelled')}
                className={`whitespace-nowrap py-4 px-1 border-b-3 font-semibold text-base transition-colors duration-200 ${
                  active_filter === 'cancelled'
                    ? 'border-yellow-400 text-black'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Cancelled
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                  active_filter === 'cancelled' 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {filter_counts.cancelled}
                </span>
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading State */}
          {is_loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="h-10 w-32 bg-gray-200 rounded-lg"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !is_loading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg 
                    className="w-6 h-6 text-red-600 mr-3" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                  <div>
                    <h3 className="text-base font-semibold text-red-900">
                      Failed to load bookings
                    </h3>
                    <p className="text-sm text-red-700 mt-1">
                      {error.message || 'An error occurred while fetching your bookings'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!is_loading && !error && filtered_bookings.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <svg 
                  className="w-8 h-8 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No bookings yet
              </h3>
              <p className="text-base text-gray-600 mb-6 max-w-md mx-auto">
                {active_filter === 'past' && 'You don\'t have any past bookings.'}
                {active_filter === 'cancelled' && 'No cancelled bookings found.'}
                {!active_filter && 'You haven\'t scheduled any appointments yet. Get started by requesting a quote!'}
              </p>
              {!active_filter && (
                <Link
                  to="/app/quotes/new"
                  className="inline-flex items-center px-8 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
                >
                  Get a Quote
                </Link>
              )}
            </div>
          )}

          {/* Desktop: Table Layout */}
          {!is_loading && !error && filtered_bookings.length > 0 && (
            <>
              <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                        Service
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-900 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtered_bookings.map((booking) => {
                      const { date_str, time_str } = format_booking_date(booking.start_at, booking.end_at);
                      
                      return (
                        <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-base font-semibold text-gray-900">
                                  {booking.service_name}
                                </div>
                                {booking.is_emergency && (
                                  <div className="flex items-center mt-1">
                                    <span className="text-yellow-600 text-xl mr-1">⚡</span>
                                    <span className="text-xs font-medium text-yellow-700">
                                      Emergency Booking
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 font-medium">
                              {date_str}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {time_str}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${get_status_badge_classes(booking.status)}`}>
                              {format_status_text(booking.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              to={`/app/orders?quote_id=${booking.quote_id}`}
                              className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg border border-gray-300 transition-colors duration-200"
                            >
                              View Order
                              <svg 
                                className="w-4 h-4 ml-2" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  strokeWidth={2} 
                                  d="M9 5l7 7-7 7" 
                                />
                              </svg>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Card List */}
              <div className="md:hidden space-y-4">
                {filtered_bookings.map((booking) => {
                  const { date_str, time_str } = format_booking_date(booking.start_at, booking.end_at);
                  
                  return (
                    <div 
                      key={booking.id} 
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg"
                    >
                      <div className="p-6">
                        {/* Service Name */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {booking.service_name}
                            </h3>
                            {booking.is_emergency && (
                              <div className="flex items-center mt-2">
                                <span className="text-yellow-600 text-xl mr-1">⚡</span>
                                <span className="text-sm font-medium text-yellow-700">
                                  Emergency Booking
                                </span>
                              </div>
                            )}
                          </div>
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${get_status_badge_classes(booking.status)}`}>
                            {format_status_text(booking.status)}
                          </span>
                        </div>

                        {/* Date & Time */}
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-gray-600">
                            <svg 
                              className="w-5 h-5 mr-2 text-gray-400" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                              />
                            </svg>
                            <span className="font-medium text-gray-900">{date_str}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <svg 
                              className="w-5 h-5 mr-2 text-gray-400" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                              />
                            </svg>
                            <span>{time_str}</span>
                          </div>
                        </div>

                        {/* Action Button */}
                        <Link
                          to={`/app/orders?quote_id=${booking.quote_id}`}
                          className="block w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 text-center font-semibold rounded-lg border border-gray-300 transition-colors duration-200"
                        >
                          View Order
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Booking Count Summary */}
          {!is_loading && !error && filtered_bookings.length > 0 && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Showing {filtered_bookings.length} {filtered_bookings.length === 1 ? 'booking' : 'bookings'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_CUST_BookingsList;