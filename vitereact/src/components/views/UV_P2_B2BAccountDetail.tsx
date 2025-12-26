import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface B2BLocation {
  id: string;
  account_id: string;
  label: string;
  address: string;
  contact_name: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ContractPricing {
  id: string;
  account_id: string;
  service_id: string;
  pricing_json: string;
  created_at: string;
  updated_at: string;
}

interface Service {
  id: string;
  name: string;
  slug: string;
  category_id: string;
}

interface AccountDetailResponse {
  account: B2BAccount;
  main_contact: User;
  locations: B2BLocation[];
  contract_pricing: ContractPricing[];
}

interface PricingData {
  contract_price: number;
  retail_price?: number;
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchAccountDetail = async (account_id: string, auth_token: string): Promise<AccountDetailResponse> => {
  const response = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/b2b-accounts/${account_id}`,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
  return response.data;
};

const fetchAvailableServices = async (auth_token: string): Promise<Service[]> => {
  const response = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/services`,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
  return response.data;
};

const updateAccount = async (
  account_id: string,
  data: Partial<B2BAccount>,
  auth_token: string
): Promise<void> => {
  await axios.patch(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/b2b-accounts/${account_id}`,
    data,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
};

const createLocation = async (
  data: {
    account_id: string;
    label: string;
    address: string;
    contact_name?: string;
    contact_phone?: string;
  },
  auth_token: string
): Promise<void> => {
  await axios.post(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/b2b-locations`,
    data,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
};

const updateLocation = async (
  location_id: string,
  data: Partial<B2BLocation>,
  auth_token: string
): Promise<void> => {
  await axios.patch(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/b2b-locations/${location_id}`,
    data,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
};

const deleteLocation = async (location_id: string, auth_token: string): Promise<void> => {
  await axios.delete(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/b2b-locations/${location_id}`,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
};

const createContractPricing = async (
  data: {
    account_id: string;
    service_id: string;
    pricing_json: string;
  },
  auth_token: string
): Promise<void> => {
  await axios.post(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/contract-pricing`,
    data,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
};

const updateContractPricing = async (
  pricing_id: string,
  data: { pricing_json: string },
  auth_token: string
): Promise<void> => {
  await axios.patch(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/contract-pricing/${pricing_id}`,
    data,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_P2_B2BAccountDetail: React.FC = () => {
  const { account_id } = useParams<{ account_id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Global state access (CRITICAL: Individual selectors)
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const feature_b2b_enabled = useAppStore(state => state.feature_flags.feature_b2b_enabled);
  const show_toast = useAppStore(state => state.show_toast);

  // Local UI state
  const [add_location_modal_open, set_add_location_modal_open] = useState(false);
  const [add_pricing_modal_open, set_add_pricing_modal_open] = useState(false);
  const [edit_account_mode, set_edit_account_mode] = useState(false);
  const [edit_location_id, set_edit_location_id] = useState<string | null>(null);
  const [edit_pricing_id, set_edit_pricing_id] = useState<string | null>(null);

  // Location form state
  const [location_form, set_location_form] = useState({
    label: '',
    address: '',
    contact_name: '',
    contact_phone: '',
  });

  // Pricing form state
  const [pricing_form, set_pricing_form] = useState({
    service_id: '',
    contract_price: '',
  });

  // Account edit form state
  const [account_form, set_account_form] = useState({
    company_name: '',
    contract_end: '',
    terms: '',
    is_active: true,
  });

  // Feature flag check - redirect if B2B not enabled
  React.useEffect(() => {
    if (!feature_b2b_enabled) {
      show_toast({
        type: 'error',
        message: 'B2B features are not enabled. Enable in Settings > Features.',
        duration: 5000,
      });
      navigate('/admin');
    }
  }, [feature_b2b_enabled, navigate, show_toast]);

  // Fetch account details
  const { data: account_data, isLoading: is_loading, error } = useQuery({
    queryKey: ['b2b-account', account_id],
    queryFn: () => fetchAccountDetail(account_id!, auth_token!),
    enabled: !!account_id && !!auth_token && feature_b2b_enabled,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Fetch available services for pricing
  const { data: services_data } = useQuery({
    queryKey: ['admin-services'],
    queryFn: () => fetchAvailableServices(auth_token!),
    enabled: !!auth_token,
    staleTime: 300000,
  });

  // Initialize edit form when account data loads
  React.useEffect(() => {
    if (account_data?.account && !edit_account_mode) {
      set_account_form({
        company_name: account_data.account.company_name,
        contract_end: account_data.account.contract_end || '',
        terms: account_data.account.terms || '',
        is_active: account_data.account.is_active,
      });
    }
  }, [account_data, edit_account_mode]);

  // Update account mutation
  const update_account_mutation = useMutation({
    mutationFn: (data: Partial<B2BAccount>) => 
      updateAccount(account_id!, data, auth_token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-account', account_id] });
      show_toast({ type: 'success', message: 'Account updated successfully', duration: 5000 });
      set_edit_account_mode(false);
    },
    onError: (error: any) => {
      show_toast({ 
        type: 'error', 
        message: error.response?.data?.message || 'Failed to update account', 
        duration: 5000 
      });
    },
  });

  // Add location mutation
  const add_location_mutation = useMutation({
    mutationFn: (data: typeof location_form & { account_id: string }) =>
      createLocation(data, auth_token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-account', account_id] });
      show_toast({ type: 'success', message: 'Location added successfully', duration: 5000 });
      set_add_location_modal_open(false);
      set_location_form({ label: '', address: '', contact_name: '', contact_phone: '' });
    },
    onError: (error: any) => {
      show_toast({ 
        type: 'error', 
        message: error.response?.data?.message || 'Failed to add location', 
        duration: 5000 
      });
    },
  });

  // Update location mutation
  const update_location_mutation = useMutation({
    mutationFn: ({ location_id, data }: { location_id: string; data: Partial<B2BLocation> }) =>
      updateLocation(location_id, data, auth_token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-account', account_id] });
      show_toast({ type: 'success', message: 'Location updated successfully', duration: 5000 });
      set_edit_location_id(null);
      set_location_form({ label: '', address: '', contact_name: '', contact_phone: '' });
    },
    onError: (error: any) => {
      show_toast({ 
        type: 'error', 
        message: error.response?.data?.message || 'Failed to update location', 
        duration: 5000 
      });
    },
  });

  // Delete location mutation
  const delete_location_mutation = useMutation({
    mutationFn: (location_id: string) => deleteLocation(location_id, auth_token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-account', account_id] });
      show_toast({ type: 'success', message: 'Location deleted successfully', duration: 5000 });
    },
    onError: (error: any) => {
      show_toast({ 
        type: 'error', 
        message: error.response?.data?.message || 'Failed to delete location', 
        duration: 5000 
      });
    },
  });

  // Add contract pricing mutation
  const add_pricing_mutation = useMutation({
    mutationFn: (data: { account_id: string; service_id: string; pricing_json: string }) =>
      createContractPricing(data, auth_token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-account', account_id] });
      show_toast({ type: 'success', message: 'Contract pricing created successfully', duration: 5000 });
      set_add_pricing_modal_open(false);
      set_pricing_form({ service_id: '', contract_price: '' });
    },
    onError: (error: any) => {
      show_toast({ 
        type: 'error', 
        message: error.response?.data?.message || 'Failed to create pricing', 
        duration: 5000 
      });
    },
  });

  // Update contract pricing mutation
  const update_pricing_mutation = useMutation({
    mutationFn: ({ pricing_id, data }: { pricing_id: string; data: { pricing_json: string } }) =>
      updateContractPricing(pricing_id, data, auth_token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-account', account_id] });
      show_toast({ type: 'success', message: 'Contract pricing updated successfully', duration: 5000 });
      set_edit_pricing_id(null);
      set_pricing_form({ service_id: '', contract_price: '' });
    },
    onError: (error: any) => {
      show_toast({ 
        type: 'error', 
        message: error.response?.data?.message || 'Failed to update pricing', 
        duration: 5000 
      });
    },
  });

  // ===========================
  // EVENT HANDLERS
  // ===========================

  const handle_submit_account = (e: React.FormEvent) => {
    e.preventDefault();
    update_account_mutation.mutate({
      company_name: account_form.company_name,
      contract_end: account_form.contract_end || null,
      terms: account_form.terms || null,
      is_active: account_form.is_active,
    });
  };

  const handle_submit_location = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!location_form.label || !location_form.address) {
      show_toast({ type: 'error', message: 'Label and address are required', duration: 5000 });
      return;
    }

    if (edit_location_id) {
      update_location_mutation.mutate({
        location_id: edit_location_id,
        data: {
          label: location_form.label,
          address: location_form.address,
          contact_name: location_form.contact_name || null,
          contact_phone: location_form.contact_phone || null,
        },
      });
    } else {
      add_location_mutation.mutate({
        account_id: account_id!,
        label: location_form.label,
        address: location_form.address,
        contact_name: location_form.contact_name || undefined,
        contact_phone: location_form.contact_phone || undefined,
      });
    }
  };

  const handle_edit_location = (location: B2BLocation) => {
    set_edit_location_id(location.id);
    set_location_form({
      label: location.label,
      address: location.address,
      contact_name: location.contact_name || '',
      contact_phone: location.contact_phone || '',
    });
    set_add_location_modal_open(true);
  };

  const handle_delete_location = (location_id: string) => {
    if (window.confirm('Are you sure you want to delete this location?')) {
      delete_location_mutation.mutate(location_id);
    }
  };

  const handle_submit_pricing = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pricing_form.service_id || !pricing_form.contract_price) {
      show_toast({ type: 'error', message: 'Service and contract price are required', duration: 5000 });
      return;
    }

    const pricing_data: PricingData = {
      contract_price: parseFloat(pricing_form.contract_price),
    };

    const pricing_json = JSON.stringify(pricing_data);

    if (edit_pricing_id) {
      update_pricing_mutation.mutate({
        pricing_id: edit_pricing_id,
        data: { pricing_json },
      });
    } else {
      add_pricing_mutation.mutate({
        account_id: account_id!,
        service_id: pricing_form.service_id,
        pricing_json,
      });
    }
  };

  const handle_edit_pricing = (pricing: ContractPricing) => {
    set_edit_pricing_id(pricing.id);
    const pricing_data = JSON.parse(pricing.pricing_json) as PricingData;
    set_pricing_form({
      service_id: pricing.service_id,
      contract_price: pricing_data.contract_price.toString(),
    });
    set_add_pricing_modal_open(true);
  };

  const close_location_modal = () => {
    set_add_location_modal_open(false);
    set_edit_location_id(null);
    set_location_form({ label: '', address: '', contact_name: '', contact_phone: '' });
  };

  const close_pricing_modal = () => {
    set_add_pricing_modal_open(false);
    set_edit_pricing_id(null);
    set_pricing_form({ service_id: '', contract_price: '' });
  };

  // Error state
  if (error) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <h2 className="text-xl font-semibold text-red-900 mb-2">Error Loading Account</h2>
              <p className="text-red-700 mb-4">
                {(error as any).response?.data?.message || 'Failed to load B2B account details'}
              </p>
              <Link
                to="/admin/b2b"
                className="inline-block bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Back to B2B Accounts
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Loading state
  if (is_loading || !account_data) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 py-12 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-12 bg-gray-200 rounded w-1/3"></div>
              <div className="bg-white rounded-xl shadow-lg p-8 space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                <div className="h-6 bg-gray-200 rounded w-2/3"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const { account, main_contact, locations, contract_pricing } = account_data;
  const available_services = services_data || [];

  // Parse pricing data for display
  const pricing_with_service = contract_pricing.map(pricing => {
    const service = available_services.find(s => s.id === pricing.service_id);
    const pricing_data = JSON.parse(pricing.pricing_json) as PricingData;
    return {
      ...pricing,
      service_name: service?.name || 'Unknown Service',
      contract_price: pricing_data.contract_price,
      retail_price: pricing_data.retail_price || null,
    };
  });

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <Link
                  to="/admin/b2b"
                  className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to B2B Accounts
                </Link>
                <div className="flex items-center gap-4 mt-2">
                  <h1 className="text-3xl font-bold text-gray-900">{account.company_name}</h1>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    account.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {account.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => set_edit_account_mode(!edit_account_mode)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {edit_account_mode ? 'Cancel Edit' : 'Edit Account'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Account Details Section */}
            <div className="lg:col-span-2 space-y-6">
              {/* Account Information Card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-xl font-semibold text-gray-900">Account Information</h2>
                </div>
                <div className="p-6">
                  {edit_account_mode ? (
                    <form onSubmit={handle_submit_account} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Company Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={account_form.company_name}
                          onChange={(e) => set_account_form({ ...account_form, company_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contract End Date
                        </label>
                        <input
                          type="date"
                          value={account_form.contract_end}
                          onChange={(e) => set_account_form({ ...account_form, contract_end: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contract Terms
                        </label>
                        <textarea
                          rows={4}
                          value={account_form.terms}
                          onChange={(e) => set_account_form({ ...account_form, terms: e.target.value })}
                          placeholder="Enter contract terms and conditions..."
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="is_active"
                          checked={account_form.is_active}
                          onChange={(e) => set_account_form({ ...account_form, is_active: e.target.checked })}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700">
                          Account Active
                        </label>
                      </div>
                      
                      <div className="flex gap-3 pt-4">
                        <button
                          type="submit"
                          disabled={update_account_mutation.isPending}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {update_account_mutation.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => set_edit_account_mode(false)}
                          className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Company Name</p>
                        <p className="text-base text-gray-900 mt-1">{account.company_name}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Contract Start</p>
                          <p className="text-base text-gray-900 mt-1">
                            {account.contract_start 
                              ? new Date(account.contract_start).toLocaleDateString() 
                              : 'Not set'}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-500">Contract End</p>
                          <p className="text-base text-gray-900 mt-1">
                            {account.contract_end 
                              ? new Date(account.contract_end).toLocaleDateString() 
                              : 'Not set'}
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-500">Payment Terms</p>
                        <p className="text-base text-gray-900 mt-1">{account.payment_terms.replace('_', ' ')}</p>
                      </div>
                      
                      {account.terms && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">Contract Terms</p>
                          <p className="text-base text-gray-900 mt-1 whitespace-pre-wrap">{account.terms}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Locations Section */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Delivery Locations</h2>
                  <button
                    onClick={() => set_add_location_modal_open(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    + Add Location
                  </button>
                </div>
                <div className="p-6">
                  {locations.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="mt-4 text-gray-500">No locations added yet</p>
                      <button
                        onClick={() => set_add_location_modal_open(true)}
                        className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        Add your first location
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {locations.map((location) => (
                        <div
                          key={location.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-gray-900">{location.label}</h3>
                                {!location.is_active && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{location.address}</p>
                              {(location.contact_name || location.contact_phone) && (
                                <div className="text-sm text-gray-500">
                                  {location.contact_name && <p>Contact: {location.contact_name}</p>}
                                  {location.contact_phone && <p>Phone: {location.contact_phone}</p>}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => handle_edit_location(location)}
                                className="text-gray-600 hover:text-blue-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                title="Edit location"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handle_delete_location(location.id)}
                                className="text-gray-600 hover:text-red-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                title="Delete location"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Contract Pricing Section */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Contract Pricing</h2>
                  <button
                    onClick={() => set_add_pricing_modal_open(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    + Add Pricing Rule
                  </button>
                </div>
                <div className="p-6">
                  {pricing_with_service.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="mt-4 text-gray-500">No contract pricing rules configured</p>
                      <button
                        onClick={() => set_add_pricing_modal_open(true)}
                        className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        Add your first pricing rule
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Service
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Contract Price
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Retail Price
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Discount
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pricing_with_service.map((pricing) => {
                            const discount_pct = pricing.retail_price
                              ? ((pricing.retail_price - pricing.contract_price) / pricing.retail_price * 100).toFixed(1)
                              : 'N/A';
                            
                            return (
                              <tr key={pricing.id} className="hover:bg-gray-50">
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {pricing.service_name}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                  €{Number(pricing.contract_price || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {pricing.retail_price ? `€${Number(pricing.retail_price).toFixed(2)}` : 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                  {discount_pct !== 'N/A' ? (
                                    <span className="text-green-600 font-medium">{discount_pct}%</span>
                                  ) : (
                                    <span className="text-gray-400">N/A</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                                  <button
                                    onClick={() => handle_edit_pricing(pricing)}
                                    className="text-blue-600 hover:text-blue-700 font-medium mr-3"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar - Main Contact Info */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-lg font-semibold text-gray-900">Main Contact</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Name</p>
                    <p className="text-base text-gray-900 mt-1">{main_contact.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <a 
                      href={`mailto:${main_contact.email}`}
                      className="text-base text-blue-600 hover:text-blue-700 mt-1 block"
                    >
                      {main_contact.email}
                    </a>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-500">Role</p>
                    <span className="inline-block mt-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                      {main_contact.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Metrics */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-lg font-semibold text-gray-900">Account Metrics</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Locations</span>
                    <span className="text-lg font-semibold text-gray-900">{locations.length}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Pricing Rules</span>
                    <span className="text-lg font-semibold text-gray-900">{contract_pricing.length}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Active Locations</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {locations.filter(l => l.is_active).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add/Edit Location Modal */}
        {add_location_modal_open && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={close_location_modal}></div>
              
              <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full transform transition-all">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {edit_location_id ? 'Edit Location' : 'Add New Location'}
                    </h3>
                    <button
                      onClick={close_location_modal}
                      className="text-gray-400 hover:text-gray-500 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <form onSubmit={handle_submit_location} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location Label *
                    </label>
                    <input
                      type="text"
                      required
                      value={location_form.label}
                      onChange={(e) => set_location_form({ ...location_form, label: e.target.value })}
                      placeholder="e.g., Dublin Store, Cork Warehouse"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={location_form.address}
                      onChange={(e) => set_location_form({ ...location_form, address: e.target.value })}
                      placeholder="Full delivery/installation address"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={location_form.contact_name}
                      onChange={(e) => set_location_form({ ...location_form, contact_name: e.target.value })}
                      placeholder="On-site contact person"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={location_form.contact_phone}
                      onChange={(e) => set_location_form({ ...location_form, contact_phone: e.target.value })}
                      placeholder="+353 87 470 0356"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={add_location_mutation.isPending || update_location_mutation.isPending}
                      className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(add_location_mutation.isPending || update_location_mutation.isPending) 
                        ? 'Saving...' 
                        : edit_location_id ? 'Update Location' : 'Add Location'}
                    </button>
                    <button
                      type="button"
                      onClick={close_location_modal}
                      className="flex-1 bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Contract Pricing Modal */}
        {add_pricing_modal_open && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={close_pricing_modal}></div>
              
              <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full transform transition-all">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {edit_pricing_id ? 'Edit Contract Pricing' : 'Add Contract Pricing'}
                    </h3>
                    <button
                      onClick={close_pricing_modal}
                      className="text-gray-400 hover:text-gray-500 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <form onSubmit={handle_submit_pricing} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Service *
                    </label>
                    <select
                      required
                      value={pricing_form.service_id}
                      onChange={(e) => set_pricing_form({ ...pricing_form, service_id: e.target.value })}
                      disabled={!!edit_pricing_id}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select a service</option>
                      {available_services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contract Price (€) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={pricing_form.contract_price}
                      onChange={(e) => set_pricing_form({ ...pricing_form, contract_price: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This price will override the retail price for this B2B account
                    </p>
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={add_pricing_mutation.isPending || update_pricing_mutation.isPending}
                      className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(add_pricing_mutation.isPending || update_pricing_mutation.isPending)
                        ? 'Saving...'
                        : edit_pricing_id ? 'Update Pricing' : 'Add Pricing'}
                    </button>
                    <button
                      type="button"
                      onClick={close_pricing_modal}
                      className="flex-1 bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cancel
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

export default UV_P2_B2BAccountDetail;