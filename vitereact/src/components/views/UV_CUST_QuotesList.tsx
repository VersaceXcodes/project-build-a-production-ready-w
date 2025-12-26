import React, { useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  created_at: string;
  updated_at: string;
}

interface QuoteListItem {
  quote: Quote;
  service: {
    id: string;
    name: string;
  };
  tier: {
    id: string;
    name: string;
  };
}

interface QuotesListResponse {
  quotes: QuoteListItem[];
  total: number;
}

interface QuotesSummary {
  all: number;
  pending: number;
  finalized: number;
  converted: number;
  cancelled: number;
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchQuotesList = async (
  authToken: string,
  status: string | null,
  page: number
): Promise<QuotesListResponse> => {
  const params: Record<string, any> = {
    page,
    limit: 20,
  };
  
  if (status) {
    params.status = status;
  }

  const response = await axios.get<QuotesListResponse>(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/quotes`,
    {
      params,
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  return response.data;
};

const fetchQuotesSummary = async (authToken: string): Promise<QuotesSummary> => {
  const response = await axios.get<QuotesListResponse>(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/quotes`,
    {
      params: { limit: 1000 },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  // Aggregate quotes by status
  const summary: QuotesSummary = {
    all: 0,
    pending: 0,
    finalized: 0,
    converted: 0,
    cancelled: 0,
  };

  response.data.quotes.forEach((item) => {
    summary.all++;
    
    const status = item.quote.status;
    if (status === 'SUBMITTED' || status === 'IN_REVIEW') {
      summary.pending++;
    } else if (status === 'APPROVED') {
      summary.finalized++;
    } else if (status === 'REJECTED') {
      summary.cancelled++;
    }
  });

  return summary;
};

// ===========================
// HELPER FUNCTIONS
// ===========================

const getStatusBadgeClasses = (status: Quote['status']): string => {
  const baseClasses = 'px-3 py-1 rounded-full text-xs font-semibold uppercase';
  
  switch (status) {
    case 'SUBMITTED':
      return `${baseClasses} bg-gray-200 text-gray-900`;
    case 'IN_REVIEW':
      return `${baseClasses} bg-yellow-400 text-gray-900`;
    case 'APPROVED':
      return `${baseClasses} bg-green-600 text-white`;
    case 'REJECTED':
      return `${baseClasses} bg-red-600 text-white`;
    default:
      return `${baseClasses} bg-gray-200 text-gray-900`;
  }
};

const getStatusLabel = (status: Quote['status']): string => {
  switch (status) {
    case 'SUBMITTED':
      return 'Submitted';
    case 'IN_REVIEW':
      return 'Under Review';
    case 'APPROVED':
      return 'Finalized';
    case 'REJECTED':
      return 'Cancelled';
    default:
      return status;
  }
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }
};

const formatPrice = (price: number | null): string => {
  if (price === null) return 'Pending';
  return `€${Number(price).toFixed(2)}`;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_CUST_QuotesList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // CRITICAL: Individual Zustand selectors
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUserId = useAppStore(state => state.authentication_state.current_user?.id);
  const showToast = useAppStore(state => state.show_toast);

  // Parse URL parameters
  const statusParam = searchParams.get('status');
  const pageParam = searchParams.get('page');
  
  const active_status_filter = statusParam || null;
  const current_page = pageParam ? parseInt(pageParam, 10) : 1;

  // ===========================
  // REACT QUERY - QUOTES LIST
  // ===========================

  const {
    data: quotesData,
    isLoading: isLoadingQuotes,
    error: quotesError,
    refetch: refetchQuotes,
  } = useQuery({
    queryKey: ['quotes', active_status_filter, current_page],
    queryFn: () => fetchQuotesList(authToken!, active_status_filter, current_page),
    enabled: !!authToken,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  // ===========================
  // REACT QUERY - QUOTES SUMMARY
  // ===========================

  const {
    data: summaryData,
    isLoading: isLoadingSummary,
  } = useQuery({
    queryKey: ['quotes-summary'],
    queryFn: () => fetchQuotesSummary(authToken!),
    enabled: !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Derived data
  const quotes_list = quotesData?.quotes || [];
  const total_quotes = quotesData?.total || 0;
  const total_pages = Math.ceil(total_quotes / 20);
  const has_next_page = total_quotes > current_page * 20;
  const has_prev_page = current_page > 1;
  
  const quotes_summary = summaryData || {
    all: 0,
    pending: 0,
    finalized: 0,
    converted: 0,
    cancelled: 0,
  };

  // ===========================
  // FILTER ACTIONS
  // ===========================

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

  const changePage = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);

    // Scroll to top on page change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToQuoteDetail = (quoteId: string) => {
    navigate(`/app/quotes/${quoteId}`);
  };

  const navigateToNewQuote = () => {
    navigate('/app/quotes/new');
  };

  const refreshQuotesData = () => {
    refetchQuotes();
    showToast({
      type: 'info',
      message: 'Refreshing quotes...',
      duration: 2000,
    });
  };

  // ===========================
  // ERROR HANDLING
  // ===========================

  useEffect(() => {
    if (quotesError) {
      showToast({
        type: 'error',
        message: 'Failed to load quotes. Please try again.',
        duration: 5000,
      });
    }
  }, [quotesError, showToast]);

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Quotes</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Track all your quote requests and their status
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={refreshQuotesData}
                  disabled={isLoadingQuotes}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className={`w-4 h-4 inline-block mr-2 ${isLoadingQuotes ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
                
                <button
                  onClick={navigateToNewQuote}
                  className="px-6 py-2 bg-yellow-400 text-gray-900 rounded-lg text-sm font-semibold hover:bg-yellow-500 transition-colors shadow-md"
                >
                  + New Quote
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex overflow-x-auto space-x-1 sm:space-x-2">
              <button
                onClick={() => applyStatusFilter(null)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  active_status_filter === null
                    ? 'border-yellow-400 text-gray-900'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                All
                {!isLoadingSummary && (
                  <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                    {quotes_summary.all}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => applyStatusFilter('SUBMITTED')}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  active_status_filter === 'SUBMITTED'
                    ? 'border-yellow-400 text-gray-900'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Pending
                {!isLoadingSummary && (
                  <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                    {quotes_summary.pending}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => applyStatusFilter('APPROVED')}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  active_status_filter === 'APPROVED'
                    ? 'border-yellow-400 text-gray-900'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Finalized
                {!isLoadingSummary && (
                  <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                    {quotes_summary.finalized}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => applyStatusFilter('REJECTED')}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  active_status_filter === 'REJECTED'
                    ? 'border-yellow-400 text-gray-900'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Cancelled
                {!isLoadingSummary && (
                  <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                    {quotes_summary.cancelled}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading State */}
          {isLoadingQuotes && quotes_list.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg className="animate-spin h-10 w-10 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-600">Loading quotes...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {quotesError && !isLoadingQuotes && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <p className="text-red-800 font-medium mb-3">Failed to load quotes</p>
              <button
                onClick={refreshQuotesData}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingQuotes && !quotesError && quotes_list.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No quotes yet
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                You haven't requested any quotes yet. Start by exploring our services and creating your first quote request.
              </p>
              <button
                onClick={navigateToNewQuote}
                className="px-8 py-3 bg-yellow-400 text-gray-900 rounded-lg font-semibold hover:bg-yellow-500 transition-colors shadow-lg hover:shadow-xl"
              >
                Get a Quote
              </button>
            </div>
          )}

          {/* Desktop: Table Layout */}
          {!isLoadingQuotes && !quotesError && quotes_list.length > 0 && (
            <>
              {/* Desktop Table (hidden on mobile) */}
              <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Quote ID
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Service
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Tier
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Date Submitted
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Estimated Price
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {quotes_list.map((item) => (
                      <tr
                        key={item.quote.id}
                        onClick={() => navigateToQuoteDetail(item.quote.id)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono text-gray-600">
                            #{item.quote.id.slice(0, 8).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {item.service.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {item.tier.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={getStatusBadgeClasses(item.quote.status)}>
                            {getStatusLabel(item.quote.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {formatDate(item.quote.created_at)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {formatPrice(item.quote.final_subtotal || item.quote.estimate_subtotal)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToQuoteDetail(item.quote.id);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Card List (visible on mobile only) */}
              <div className="md:hidden space-y-4">
                {quotes_list.map((item) => (
                  <div
                    key={item.quote.id}
                    onClick={() => navigateToQuoteDetail(item.quote.id)}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-xs font-mono text-gray-500">
                          #{item.quote.id.slice(0, 8).toUpperCase()}
                        </span>
                        <h3 className="text-lg font-semibold text-gray-900 mt-1">
                          {item.service.name}
                        </h3>
                      </div>
                      <span className={getStatusBadgeClasses(item.quote.status)}>
                        {getStatusLabel(item.quote.status)}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Tier:</span>
                        <span className="font-medium text-gray-900">{item.tier.name}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Submitted:</span>
                        <span className="font-medium text-gray-900">
                          {formatDate(item.quote.created_at)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Estimated Price:</span>
                        <span className="font-semibold text-gray-900">
                          {formatPrice(item.quote.final_subtotal || item.quote.estimate_subtotal)}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToQuoteDetail(item.quote.id);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {total_pages > 1 && (
                <div className="mt-8 flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-100 px-4 py-3 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => changePage(current_page - 1)}
                      disabled={!has_prev_page}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => changePage(current_page + 1)}
                      disabled={!has_next_page}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing{' '}
                        <span className="font-medium">{(current_page - 1) * 20 + 1}</span>
                        {' '}to{' '}
                        <span className="font-medium">
                          {Math.min(current_page * 20, total_quotes)}
                        </span>
                        {' '}of{' '}
                        <span className="font-medium">{total_quotes}</span>
                        {' '}quotes
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => changePage(current_page - 1)}
                          disabled={!has_prev_page}
                          className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        
                        {Array.from({ length: Math.min(total_pages, 5) }, (_, i) => {
                          const pageNumber = i + 1;
                          return (
                            <button
                              key={pageNumber}
                              onClick={() => changePage(pageNumber)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                current_page === pageNumber
                                  ? 'z-10 bg-yellow-400 border-yellow-400 text-gray-900'
                                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {pageNumber}
                            </button>
                          );
                        })}
                        
                        {total_pages > 5 && current_page < total_pages && (
                          <>
                            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                              ...
                            </span>
                            <button
                              onClick={() => changePage(total_pages)}
                              className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              {total_pages}
                            </button>
                          </>
                        )}
                        
                        <button
                          onClick={() => changePage(current_page + 1)}
                          disabled={!has_next_page}
                          className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
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

export default UV_CUST_QuotesList;