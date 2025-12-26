import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface B2BAccount {
  id: string;
  company_name: string;
  main_contact_user_id: string;
  contract_start: string | null;
  contract_end: string | null;
  terms: string | null;
  payment_terms: 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MainContact {
  id: string;
  name: string;
  email: string;
}

interface B2BAccountListItem {
  account: B2BAccount;
  main_contact: MainContact;
  locations_count: number;
}

interface AvailableContact {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface CreateB2BAccountInput {
  company_name: string;
  main_contact_user_id: string;
  contract_start: string | null;
  contract_end: string | null;
  terms: string | null;
  payment_terms: 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60';
}

// ===========================
// MAIN COMPONENT
// ===========================

const UV_P2_B2BAccountsList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // ===========================
  // GLOBAL STATE ACCESS (Individual Selectors)
  // ===========================
  
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const feature_b2b_enabled = useAppStore(state => state.feature_flags.feature_b2b_enabled);
  const show_toast = useAppStore(state => state.show_toast);

  // ===========================
  // LOCAL STATE
  // ===========================

  const [search_query, set_search_query] = useState<string>(searchParams.get('search') || '');
  const [create_account_modal_open, set_create_account_modal_open] = useState<boolean>(false);
  const [create_form, set_create_form] = useState<CreateB2BAccountInput>({
    company_name: '',
    main_contact_user_id: '',
    contract_start: null,
    contract_end: null,
    terms: null,
    payment_terms: 'NET_30',
  });
  const [form_errors, set_form_errors] = useState<Record<string, string>>({});

  // ===========================
  // FEATURE FLAG CHECK
  // ===========================

  useEffect(() => {
    if (!feature_b2b_enabled) {
      show_toast({
        type: 'error',
        message: 'B2B features are not enabled. Enable in Settings > Features.',
        duration: 5000,
      });
      navigate('/admin');
    }
  }, [feature_b2b_enabled, navigate, show_toast]);

  // ===========================
  // URL PARAM SYNC
  // ===========================

  useEffect(() => {
    const search_param = searchParams.get('search') || '';
    if (search_param !== search_query) {
      set_search_query(search_param);
    }
  }, [searchParams]);

  const update_search_param = (query: string) => {
    const new_params = new URLSearchParams(searchParams);
    if (query) {
      new_params.set('search', query);
    } else {
      new_params.delete('search');
    }
    setSearchParams(new_params);
  };

  // ===========================
  // API BASE URL
  // ===========================

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // ===========================
  // FETCH B2B ACCOUNTS (React Query)
  // ===========================

  const {
    data: b2b_accounts = [],
    isLoading: is_loading,
    error: fetch_error,
    refetch,
  } = useQuery<B2BAccountListItem[]>({
    queryKey: ['b2b-accounts', search_query],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/b2b-accounts`, {
        params: { search: search_query || undefined },
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return response.data.map((item: any) => ({
        account: {
          id: item.account.id,
          company_name: item.account.company_name,
          main_contact_user_id: item.account.main_contact_user_id,
          contract_start: item.account.contract_start,
          contract_end: item.account.contract_end,
          terms: item.account.terms,
          payment_terms: item.account.payment_terms,
          is_active: item.account.is_active,
          created_at: item.account.created_at,
          updated_at: item.account.updated_at,
        },
        main_contact: item.main_contact,
        locations_count: item.locations_count,
      }));
    },
    enabled: !!auth_token && feature_b2b_enabled,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // ===========================
  // FETCH AVAILABLE CONTACTS (React Query)
  // ===========================

  const {
    data: available_contacts = [],
    isLoading: is_loading_contacts,
  } = useQuery<AvailableContact[]>({
    queryKey: ['customer-users', 'active'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/users`, {
        params: { role: 'CUSTOMER', status: 'active' },
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return response.data.users.map((user: any) => ({
        id: user.user?.id || user.id,
        name: user.user?.name || user.name,
        email: user.user?.email || user.email,
        role: user.user?.role || user.role,
      }));
    },
    enabled: create_account_modal_open && !!auth_token,
    staleTime: 300000, // 5 minutes
  });

  // ===========================
  // CREATE B2B ACCOUNT MUTATION
  // ===========================

  const create_mutation = useMutation({
    mutationFn: async (data: CreateB2BAccountInput) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/admin/b2b-accounts`,
        data,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-accounts'] });
      set_create_account_modal_open(false);
      reset_create_form();
      show_toast({
        type: 'success',
        message: 'B2B account created successfully',
        duration: 5000,
      });
    },
    onError: (error: any) => {
      const error_message = error.response?.data?.message || 'Failed to create B2B account';
      show_toast({
        type: 'error',
        message: error_message,
        duration: 5000,
      });
    },
  });

  // ===========================
  // FORM HANDLERS
  // ===========================

  const reset_create_form = () => {
    set_create_form({
      company_name: '',
      main_contact_user_id: '',
      contract_start: null,
      contract_end: null,
      terms: null,
      payment_terms: 'NET_30',
    });
    set_form_errors({});
  };

  const handle_form_change = (field: keyof CreateB2BAccountInput, value: any) => {
    set_create_form(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (form_errors[field]) {
      set_form_errors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const validate_create_form = (): boolean => {
    const errors: Record<string, string> = {};

    if (!create_form.company_name.trim()) {
      errors.company_name = 'Company name is required';
    }

    if (!create_form.main_contact_user_id) {
      errors.main_contact_user_id = 'Main contact is required';
    }

    if (create_form.contract_start && create_form.contract_end) {
      if (new Date(create_form.contract_start) > new Date(create_form.contract_end)) {
        errors.contract_end = 'Contract end date must be after start date';
      }
    }

    set_form_errors(errors);
    return Object.keys(errors).length === 0;
  };

  const handle_create_submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate_create_form()) {
      return;
    }

    create_mutation.mutate(create_form);
  };

  const handle_modal_close = () => {
    set_create_account_modal_open(false);
    reset_create_form();
  };

  // ===========================
  // SEARCH HANDLER (Debounced via URL)
  // ===========================

  const handle_search_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    set_search_query(query);
    
    // Debounce: Update URL param after user stops typing (300ms)
    const debounce_timer = setTimeout(() => {
      update_search_param(query);
    }, 300);

    return () => clearTimeout(debounce_timer);
  };

  // ===========================
  // FORMAT HELPERS
  // ===========================

  const format_date = (date_string: string | null): string => {
    if (!date_string) return 'N/A';
    return new Date(date_string).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const format_payment_terms = (terms: string): string => {
    return terms.replace('NET_', 'Net ');
  };

  // ===========================
  // AUTHORIZATION CHECK
  // ===========================

  if (!current_user || current_user.role !== 'ADMIN') {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">You do not have permission to view this page.</p>
            <Link
              to="/admin"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">B2B Accounts</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage enterprise customer accounts with specialized pricing and multi-location support
                </p>
              </div>
              <button
                onClick={() => set_create_account_modal_open(true)}
                className="inline-flex items-center justify-center px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create B2B Account
              </button>
            </div>

            {/* Search Bar */}
            <div className="mt-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by company name or contact..."
                  value={search_query}
                  onChange={handle_search_change}
                  className="w-full px-4 py-3 pl-12 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                />
                <svg
                  className="absolute left-4 top-3.5 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading State */}
          {is_loading && (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="ml-3 text-gray-600">Loading B2B accounts...</span>
            </div>
          )}

          {/* Error State */}
          {fetch_error && !is_loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-700 font-medium mb-4">Failed to load B2B accounts</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!is_loading && !fetch_error && b2b_accounts.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No B2B Accounts Yet</h3>
              <p className="text-gray-600 mb-6">
                {search_query ? 'No accounts match your search.' : 'Create your first B2B account to get started.'}
              </p>
              {!search_query && (
                <button
                  onClick={() => set_create_account_modal_open(true)}
                  className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors"
                >
                  Create B2B Account
                </button>
              )}
            </div>
          )}

          {/* Accounts Table (Desktop) */}
          {!is_loading && !fetch_error && b2b_accounts.length > 0 && (
            <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Company Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Main Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Contract Period
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Payment Terms
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Locations
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {b2b_accounts.map((item) => (
                    <tr
                      key={item.account.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/b2b/${item.account.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {item.account.company_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.main_contact.name}</div>
                        <div className="text-sm text-gray-500">{item.main_contact.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format_date(item.account.contract_start)} - {format_date(item.account.contract_end)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {format_payment_terms(item.account.payment_terms)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{item.locations_count}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.account.is_active ? (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={`/admin/b2b/${item.account.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-900 font-semibold"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Accounts Cards (Mobile/Tablet) */}
          {!is_loading && !fetch_error && b2b_accounts.length > 0 && (
            <div className="lg:hidden space-y-4">
              {b2b_accounts.map((item) => (
                <div
                  key={item.account.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {item.account.company_name}
                      </h3>
                      <p className="text-sm text-gray-600">{item.main_contact.name}</p>
                      <p className="text-sm text-gray-500">{item.main_contact.email}</p>
                    </div>
                    {item.account.is_active ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm">
                      <span className="text-gray-500 w-32">Contract Period:</span>
                      <span className="text-gray-900">
                        {format_date(item.account.contract_start)} - {format_date(item.account.contract_end)}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="text-gray-500 w-32">Payment Terms:</span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {format_payment_terms(item.account.payment_terms)}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="text-gray-500 w-32">Locations:</span>
                      <span className="text-gray-900">{item.locations_count}</span>
                    </div>
                  </div>

                  <Link
                    to={`/admin/b2b/${item.account.id}`}
                    className="block w-full text-center px-4 py-2 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    View Details
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Account Modal */}
        {create_account_modal_open && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Overlay */}
            <div className="fixed inset-0 bg-black bg-opacity-60 transition-opacity" onClick={handle_modal_close}></div>

            {/* Modal */}
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full p-8">
                {/* Close Button */}
                <button
                  onClick={handle_modal_close}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Modal Header */}
                <div className="mb-6">
                  <h2 id="modal-title" className="text-2xl font-bold text-gray-900 mb-2">
                    Create B2B Account
                  </h2>
                  <p className="text-sm text-gray-600">
                    Set up a new enterprise customer account with specialized pricing and multi-location support.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handle_create_submit} className="space-y-6">
                  {/* Company Name */}
                  <div>
                    <label htmlFor="company_name" className="block text-sm font-semibold text-gray-900 mb-2">
                      Company Name <span className="text-yellow-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="company_name"
                      required
                      value={create_form.company_name}
                      onChange={(e) => handle_form_change('company_name', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      placeholder="Enter company name"
                    />
                    {form_errors.company_name && (
                      <p className="mt-1 text-sm text-red-600">{form_errors.company_name}</p>
                    )}
                  </div>

                  {/* Main Contact */}
                  <div>
                    <label htmlFor="main_contact_user_id" className="block text-sm font-semibold text-gray-900 mb-2">
                      Main Contact <span className="text-yellow-500">*</span>
                    </label>
                    {is_loading_contacts ? (
                      <div className="flex items-center px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                        <svg className="animate-spin h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span className="text-gray-500 text-sm">Loading contacts...</span>
                      </div>
                    ) : (
                      <select
                        id="main_contact_user_id"
                        required
                        value={create_form.main_contact_user_id}
                        onChange={(e) => handle_form_change('main_contact_user_id', e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      >
                        <option value="">Select a customer</option>
                        {available_contacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {contact.name} ({contact.email})
                          </option>
                        ))}
                      </select>
                    )}
                    {form_errors.main_contact_user_id && (
                      <p className="mt-1 text-sm text-red-600">{form_errors.main_contact_user_id}</p>
                    )}
                  </div>

                  {/* Contract Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contract_start" className="block text-sm font-semibold text-gray-900 mb-2">
                        Contract Start Date
                      </label>
                      <input
                        type="date"
                        id="contract_start"
                        value={create_form.contract_start || ''}
                        onChange={(e) => handle_form_change('contract_start', e.target.value || null)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="contract_end" className="block text-sm font-semibold text-gray-900 mb-2">
                        Contract End Date
                      </label>
                      <input
                        type="date"
                        id="contract_end"
                        value={create_form.contract_end || ''}
                        onChange={(e) => handle_form_change('contract_end', e.target.value || null)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                      {form_errors.contract_end && (
                        <p className="mt-1 text-sm text-red-600">{form_errors.contract_end}</p>
                      )}
                    </div>
                  </div>

                  {/* Payment Terms */}
                  <div>
                    <label htmlFor="payment_terms" className="block text-sm font-semibold text-gray-900 mb-2">
                      Payment Terms <span className="text-yellow-500">*</span>
                    </label>
                    <select
                      id="payment_terms"
                      required
                      value={create_form.payment_terms}
                      onChange={(e) => handle_form_change('payment_terms', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    >
                      <option value="NET_15">Net 15 (Payment due in 15 days)</option>
                      <option value="NET_30">Net 30 (Payment due in 30 days)</option>
                      <option value="NET_45">Net 45 (Payment due in 45 days)</option>
                      <option value="NET_60">Net 60 (Payment due in 60 days)</option>
                    </select>
                  </div>

                  {/* Terms & Notes */}
                  <div>
                    <label htmlFor="terms" className="block text-sm font-semibold text-gray-900 mb-2">
                      Contract Terms & Notes
                    </label>
                    <textarea
                      id="terms"
                      rows={4}
                      value={create_form.terms || ''}
                      onChange={(e) => handle_form_change('terms', e.target.value || null)}
                      placeholder="Enter additional contract details, special agreements, or internal notes..."
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-vertical"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={handle_modal_close}
                      className="px-6 py-3 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={create_mutation.isPending}
                      className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {create_mutation.isPending ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Creating...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_P2_B2BAccountsList;