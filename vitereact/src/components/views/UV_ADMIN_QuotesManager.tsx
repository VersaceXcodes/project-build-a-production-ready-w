import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// =====================================================
// TYPES & INTERFACES
// =====================================================

interface QuoteWithDetails {
  quote: {
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
  };
  customer: {
    id: string;
    name: string;
    email: string;
  };
  service: {
    id: string;
    name: string;
  };
  tier: {
    id: string;
    name: string;
  };
}

interface QuoteStats {
  total_quotes: number;
  submitted_count: number;
  in_review_count: number;
  finalized_count: number;
  converted_count: number;
}

interface ServiceOption {
  id: string;
  name: string;
}

interface QuotesResponse {
  quotes: QuoteWithDetails[];
  total: number;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

const UV_ADMIN_QuotesManager: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // CRITICAL: Individual Zustand selectors (no object destructuring)
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);

  // =====================================================
  // LOCAL STATE
  // =====================================================

  // Parse URL params for initial filter state
  const initialStatus = searchParams.get('status') || null;
  const initialCustomer = searchParams.get('customer') || null;
  const initialPage = parseInt(searchParams.get('page') || '1');

  const [filter_state, setFilterState] = useState({
    status: initialStatus,
    customer_search: initialCustomer,
    service_id: null as string | null,
    page: initialPage,
  });

  const [selected_quotes, setSelectedQuotes] = useState<string[]>([]);
  const [is_bulk_processing, setIsBulkProcessing] = useState(false);
  const [sort_config, setSortConfig] = useState({
    sort_by: 'created_at',
    sort_order: 'desc' as 'asc' | 'desc',
  });
  const [customer_search_input, setCustomerSearchInput] = useState(initialCustomer || '');

  // =====================================================
  // API CALLS - REACT QUERY
  // =====================================================

  // Fetch quotes with filtering
  const {
    data: quotes_data,
    isLoading: is_loading,
    error: fetch_error,
    refetch: refetch_quotes,
  } = useQuery<QuotesResponse>({
    queryKey: ['admin-quotes', filter_state.status, filter_state.customer_search, filter_state.service_id, filter_state.page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter_state.status) params.append('status', filter_state.status);
      if (filter_state.customer_search) params.append('customer', filter_state.customer_search);
      if (filter_state.service_id) params.append('service_id', filter_state.service_id);
      params.append('page', filter_state.page.toString());

      const response = await axios.get<QuotesResponse>(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/quotes?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      return response.data;
    },
    enabled: !!authToken,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Fetch services for filter dropdown
  const { data: services_data } = useQuery<ServiceOption[]>({
    queryKey: ['admin-services-filter'],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/services`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      return response.data.map((service: any) => ({
        id: service.id || service.service?.id,
        name: service.name || service.service?.name,
      }));
    },
    enabled: !!authToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // =====================================================
  // COMPUTED VALUES
  // =====================================================

  const quotes_list = quotes_data?.quotes || [];
  const total_items = quotes_data?.total || 0;

  // Calculate stats from quotes
  const quote_stats: QuoteStats = useMemo(() => {
    if (!quotes_list.length) {
      return {
        total_quotes: 0,
        submitted_count: 0,
        in_review_count: 0,
        finalized_count: 0,
        converted_count: 0,
      };
    }

    return quotes_list.reduce(
      (acc, item) => {
        acc.total_quotes++;
        if (item.quote.status === 'SUBMITTED') acc.submitted_count++;
        if (item.quote.status === 'IN_REVIEW') acc.in_review_count++;
        if (item.quote.status === 'APPROVED') acc.finalized_count++;
        // Note: 'CONVERTED' status doesn't exist in OpenAPI spec, using APPROVED as proxy
        return acc;
      },
      {
        total_quotes: 0,
        submitted_count: 0,
        in_review_count: 0,
        finalized_count: 0,
        converted_count: 0,
      }
    );
  }, [quotes_list]);

  const pagination_info = {
    current_page: filter_state.page,
    total_pages: Math.ceil(total_items / 20),
    total_items,
    items_per_page: 20,
  };

  const available_services: ServiceOption[] = services_data || [];

  // =====================================================
  // FILTER & SEARCH FUNCTIONS
  // =====================================================

  const apply_status_filter = (status: string | null) => {
    setFilterState(prev => ({ ...prev, status, page: 1 }));
    setSelectedQuotes([]); // Clear selections on filter change
    
    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    if (status) {
      newParams.set('status', status);
    } else {
      newParams.delete('status');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const apply_customer_search = (search_query: string) => {
    setFilterState(prev => ({ ...prev, customer_search: search_query || null, page: 1 }));
    
    const newParams = new URLSearchParams(searchParams);
    if (search_query) {
      newParams.set('customer', search_query);
    } else {
      newParams.delete('customer');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const apply_service_filter = (service_id: string | null) => {
    setFilterState(prev => ({ ...prev, service_id, page: 1 }));
    setSelectedQuotes([]);
  };

  const change_page = (new_page: number) => {
    setFilterState(prev => ({ ...prev, page: new_page }));
    
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', new_page.toString());
    setSearchParams(newParams);
    
    // Scroll to top on page change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggle_sort = (field: string) => {
    setSortConfig(prev => {
      if (prev.sort_by === field) {
        return { ...prev, sort_order: prev.sort_order === 'asc' ? 'desc' : 'asc' };
      }
      return { sort_by: field, sort_order: 'asc' };
    });
  };

  // =====================================================
  // BULK ACTIONS
  // =====================================================

  const toggle_quote_selection = (quote_id: string) => {
    setSelectedQuotes(prev =>
      prev.includes(quote_id)
        ? prev.filter(id => id !== quote_id)
        : [...prev, quote_id]
    );
  };

  const toggle_select_all = () => {
    if (selected_quotes.length === quotes_list.length) {
      setSelectedQuotes([]);
    } else {
      setSelectedQuotes(quotes_list.map(item => item.quote.id));
    }
  };

  const bulk_export_quotes = () => {
    if (selected_quotes.length === 0) {
      showToast({
        type: 'warning',
        message: 'Please select quotes to export',
        duration: 3000,
      });
      return;
    }

    // Client-side CSV generation
    const selected_data = quotes_list.filter(item => selected_quotes.includes(item.quote.id));
    
    const csv_header = 'Quote ID,Customer Name,Customer Email,Service,Tier,Status,Estimate,Final Price,Created At\n';
    const csv_rows = selected_data.map(item => {
      const estimate = item.quote.estimate_subtotal ? `€${Number(item.quote.estimate_subtotal).toFixed(2)}` : 'N/A';
      const final = item.quote.final_subtotal ? `€${Number(item.quote.final_subtotal).toFixed(2)}` : 'N/A';
      const created = new Date(item.quote.created_at).toLocaleDateString();
      
      return `${item.quote.id},"${item.customer.name}",${item.customer.email},"${item.service.name}","${item.tier.name}",${item.quote.status},${estimate},${final},${created}`;
    }).join('\n');

    const csv_content = csv_header + csv_rows;
    const blob = new Blob([csv_content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `quotes_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast({
      type: 'success',
      message: `${selected_quotes.length} quotes exported successfully`,
      duration: 3000,
    });
  };

  const bulk_assign_staff = async () => {
    if (selected_quotes.length === 0) {
      showToast({
        type: 'warning',
        message: 'Please select quotes to assign',
        duration: 3000,
      });
      return;
    }

    // Note: Full implementation would show modal to select staff member
    // For now, updates status to IN_REVIEW as placeholder
    setIsBulkProcessing(true);

    try {
      await Promise.all(
        selected_quotes.map(quote_id =>
          axios.patch(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/quotes/${quote_id}`,
            { status: 'IN_REVIEW' },
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            }
          )
        )
      );

      showToast({
        type: 'success',
        message: `${selected_quotes.length} quotes updated to In Review`,
        duration: 3000,
      });

      setSelectedQuotes([]);
      refetch_quotes();
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to update quotes',
        duration: 5000,
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // =====================================================
  // CLIENT-SIDE SORTING
  // =====================================================

  const sorted_quotes = useMemo(() => {
    const sorted = [...quotes_list];
    
    sorted.sort((a, b) => {
      let val_a: any;
      let val_b: any;

      switch (sort_config.sort_by) {
        case 'customer_name':
          val_a = a.customer.name;
          val_b = b.customer.name;
          break;
        case 'service_name':
          val_a = a.service.name;
          val_b = b.service.name;
          break;
        case 'created_at':
          val_a = new Date(a.quote.created_at).getTime();
          val_b = new Date(b.quote.created_at).getTime();
          break;
        case 'final_subtotal':
          val_a = a.quote.final_subtotal || 0;
          val_b = b.quote.final_subtotal || 0;
          break;
        default:
          val_a = a.quote.created_at;
          val_b = b.quote.created_at;
      }

      if (val_a < val_b) return sort_config.sort_order === 'asc' ? -1 : 1;
      if (val_a > val_b) return sort_config.sort_order === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [quotes_list, sort_config]);

  // =====================================================
  // EFFECTS
  // =====================================================

  // Debounced customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customer_search_input !== filter_state.customer_search) {
        apply_customer_search(customer_search_input);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [customer_search_input]);

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================

  const get_status_badge_color = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 'bg-gray-100 text-gray-800';
      case 'IN_REVIEW':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const format_currency = (amount: number | null) => {
    if (amount === null || amount === undefined) return 'N/A';
    return `€${Number(amount).toFixed(2)}`;
  };

  const format_date = (date_string: string) => {
    const date = new Date(date_string);
    const now = new Date();
    const diff_ms = now.getTime() - date.getTime();
    const diff_days = Math.floor(diff_ms / (1000 * 60 * 60 * 24));

    if (diff_days === 0) return 'Today';
    if (diff_days === 1) return 'Yesterday';
    if (diff_days < 7) return `${diff_days} days ago`;
    
    return date.toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
                <h1 className="text-3xl font-bold text-gray-900">Quote Management</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Review and finalize customer quote requests
                </p>
              </div>
              <div className="mt-4 flex md:mt-0 md:ml-4">
                <button
                  onClick={() => refetch_quotes()}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <svg className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <button
              onClick={() => apply_status_filter(null)}
              className={`bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left ${
                filter_state.status === null ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-600">All Quotes</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">{quote_stats.total_quotes}</div>
            </button>

            <button
              onClick={() => apply_status_filter('SUBMITTED')}
              className={`bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left ${
                filter_state.status === 'SUBMITTED' ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-600">Submitted</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">{quote_stats.submitted_count}</div>
            </button>

            <button
              onClick={() => apply_status_filter('IN_REVIEW')}
              className={`bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left ${
                filter_state.status === 'IN_REVIEW' ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-600">Under Review</div>
              <div className="mt-2 text-3xl font-bold text-yellow-600">{quote_stats.in_review_count}</div>
            </button>

            <button
              onClick={() => apply_status_filter('APPROVED')}
              className={`bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left ${
                filter_state.status === 'APPROVED' ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-600">Finalized</div>
              <div className="mt-2 text-3xl font-bold text-green-600">{quote_stats.finalized_count}</div>
            </button>

            <button
              onClick={() => apply_status_filter('REJECTED')}
              className={`bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left ${
                filter_state.status === 'REJECTED' ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-600">Rejected</div>
              <div className="mt-2 text-3xl font-bold text-red-600">
                {quotes_list.filter(item => item.quote.status === 'REJECTED').length}
              </div>
            </button>
          </div>

          {/* Filters & Actions Bar */}
          <div className="bg-white rounded-lg shadow mb-6 p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Customer Search */}
              <div className="md:col-span-4">
                <label htmlFor="customer-search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search Customer
                </label>
                <input
                  type="text"
                  id="customer-search"
                  value={customer_search_input}
                  onChange={(e) => setCustomerSearchInput(e.target.value)}
                  placeholder="Name, email, or quote ID..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Service Filter */}
              <div className="md:col-span-3">
                <label htmlFor="service-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Service
                </label>
                <select
                  id="service-filter"
                  value={filter_state.service_id || ''}
                  onChange={(e) => apply_service_filter(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Services</option>
                  {available_services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bulk Actions */}
              <div className="md:col-span-5 flex items-end gap-2">
                <button
                  onClick={bulk_export_quotes}
                  disabled={selected_quotes.length === 0}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  <svg className="inline-block h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export ({selected_quotes.length})
                </button>

                <button
                  onClick={bulk_assign_staff}
                  disabled={selected_quotes.length === 0 || is_bulk_processing}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {is_bulk_processing ? (
                    <>
                      <svg className="inline-block animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="inline-block h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Assign Staff ({selected_quotes.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quotes Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {is_loading ? (
              <div className="p-12 text-center">
                <svg className="animate-spin h-8 w-8 mx-auto text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-4 text-gray-600">Loading quotes...</p>
              </div>
            ) : fetch_error ? (
              <div className="p-12 text-center">
                <div className="text-red-600 mb-4">
                  <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-900 font-medium">Failed to load quotes</p>
                <p className="text-gray-600 text-sm mt-2">Please try refreshing the page</p>
                <button
                  onClick={() => refetch_quotes()}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : sorted_quotes.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-900 font-medium">No quotes found</p>
                <p className="text-gray-600 text-sm mt-2">
                  {filter_state.status || filter_state.customer_search || filter_state.service_id
                    ? 'Try adjusting your filters'
                    : 'Quotes will appear here when customers submit requests'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selected_quotes.length === sorted_quotes.length && sorted_quotes.length > 0}
                            onChange={toggle_select_all}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quote ID
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => toggle_sort('customer_name')}
                        >
                          <div className="flex items-center">
                            Customer
                            {sort_config.sort_by === 'customer_name' && (
                              <svg className={`ml-1 h-4 w-4 ${sort_config.sort_order === 'desc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => toggle_sort('service_name')}
                        >
                          <div className="flex items-center">
                            Service
                            {sort_config.sort_by === 'service_name' && (
                              <svg className={`ml-1 h-4 w-4 ${sort_config.sort_order === 'desc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tier
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => toggle_sort('final_subtotal')}
                        >
                          <div className="flex items-center">
                            Price
                            {sort_config.sort_by === 'final_subtotal' && (
                              <svg className={`ml-1 h-4 w-4 ${sort_config.sort_order === 'desc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => toggle_sort('created_at')}
                        >
                          <div className="flex items-center">
                            Date
                            {sort_config.sort_by === 'created_at' && (
                              <svg className={`ml-1 h-4 w-4 ${sort_config.sort_order === 'desc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sorted_quotes.map((item) => (
                        <tr key={item.quote.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selected_quotes.includes(item.quote.id)}
                              onChange={() => toggle_quote_selection(item.quote.id)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              #{item.quote.id.substring(0, 8)}
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
                            <div className="text-sm text-gray-900">{item.tier.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${get_status_badge_color(item.quote.status)}`}>
                              {item.quote.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {item.quote.final_subtotal 
                                ? format_currency(item.quote.final_subtotal)
                                : item.quote.estimate_subtotal
                                ? `~${format_currency(item.quote.estimate_subtotal)}`
                                : 'Pending'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format_date(item.quote.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              to={`/admin/quotes/${item.quote.id}`}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                            >
                              View Details
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-gray-200">
                  {sorted_quotes.map((item) => (
                    <div key={item.quote.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selected_quotes.includes(item.quote.id)}
                            onChange={() => toggle_quote_selection(item.quote.id)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              #{item.quote.id.substring(0, 8)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {format_date(item.quote.created_at)}
                            </div>
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${get_status_badge_color(item.quote.status)}`}>
                          {item.quote.status}
                        </span>
                      </div>

                      <div className="space-y-2 mb-3">
                        <div>
                          <span className="text-xs text-gray-500">Customer:</span>
                          <div className="text-sm font-medium text-gray-900">{item.customer.name}</div>
                          <div className="text-xs text-gray-500">{item.customer.email}</div>
                        </div>

                        <div>
                          <span className="text-xs text-gray-500">Service:</span>
                          <div className="text-sm text-gray-900">{item.service.name}</div>
                        </div>

                        <div className="flex justify-between">
                          <div>
                            <span className="text-xs text-gray-500">Tier:</span>
                            <div className="text-sm text-gray-900">{item.tier.name}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-500">Price:</span>
                            <div className="text-sm font-medium text-gray-900">
                              {item.quote.final_subtotal 
                                ? format_currency(item.quote.final_subtotal)
                                : item.quote.estimate_subtotal
                                ? `~${format_currency(item.quote.estimate_subtotal)}`
                                : 'Pending'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Link
                        to={`/admin/quotes/${item.quote.id}`}
                        className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        View Details
                      </Link>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination_info.total_pages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => change_page(filter_state.page - 1)}
                        disabled={filter_state.page === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => change_page(filter_state.page + 1)}
                        disabled={filter_state.page >= pagination_info.total_pages}
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
                            {(filter_state.page - 1) * pagination_info.items_per_page + 1}
                          </span>{' '}
                          to{' '}
                          <span className="font-medium">
                            {Math.min(filter_state.page * pagination_info.items_per_page, pagination_info.total_items)}
                          </span>{' '}
                          of{' '}
                          <span className="font-medium">{pagination_info.total_items}</span> results
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                          <button
                            onClick={() => change_page(filter_state.page - 1)}
                            disabled={filter_state.page === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          
                          {[...Array(Math.min(pagination_info.total_pages, 5))].map((_, idx) => {
                            const page_num = idx + 1;
                            return (
                              <button
                                key={page_num}
                                onClick={() => change_page(page_num)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  filter_state.page === page_num
                                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                {page_num}
                              </button>
                            );
                          })}
                          
                          <button
                            onClick={() => change_page(filter_state.page + 1)}
                            disabled={filter_state.page >= pagination_info.total_pages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
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
      </div>
    </>
  );
};

export default UV_ADMIN_QuotesManager;