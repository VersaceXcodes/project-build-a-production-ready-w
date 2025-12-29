import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Service {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  requires_booking: boolean;
  requires_proof: boolean;
  is_top_seller: boolean;
  is_active: boolean;
  slot_duration_hours: number;
  created_at: string;
  updated_at: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceOption {
  id: string;
  service_id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  choices: string | null;
  pricing_impact: string | null;
  help_text: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceWithDetails {
  service: Service;
  category: ServiceCategory;
  options: ServiceOption[];
}

interface CreateServiceFormData {
  category_id: string;
  name: string;
  slug: string;
  description: string;
  requires_booking: boolean;
  requires_proof: boolean;
  is_top_seller: boolean;
  slot_duration_hours: number;
}

interface CreateCategoryFormData {
  name: string;
  slug: string;
  sort_order: number;
}

// ===========================
// MAIN COMPONENT
// ===========================

const UV_ADMIN_ServicesManager: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // CRITICAL: Individual selectors, no object destructuring
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const show_toast = useAppStore(state => state.show_toast);

  // Local state
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || null,
    active: searchParams.get('active') === 'true' ? true : searchParams.get('active') === 'false' ? false : null,
    search: ''
  });

  const [create_service_modal_open, set_create_service_modal_open] = useState(false);
  const [create_category_modal_open, set_create_category_modal_open] = useState(false);

  const [create_service_form, set_create_service_form] = useState<CreateServiceFormData>({
    category_id: '',
    name: '',
    slug: '',
    description: '',
    requires_booking: false,
    requires_proof: false,
    is_top_seller: false,
    slot_duration_hours: 2
  });

  const [create_category_form, set_create_category_form] = useState<CreateCategoryFormData>({
    name: '',
    slug: '',
    sort_order: 0
  });

  const [selected_service_ids, set_selected_service_ids] = useState<string[]>([]);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.active !== null) params.set('active', String(filters.active));
    setSearchParams(params);
  }, [filters.category, filters.active, setSearchParams]);

  // Auto-generate slug from name
  useEffect(() => {
    if (create_service_form.name && !create_service_form.slug) {
      const auto_slug = create_service_form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      set_create_service_form(prev => ({ ...prev, slug: auto_slug }));
    }
  }, [create_service_form.name]);

  useEffect(() => {
    if (create_category_form.name && !create_category_form.slug) {
      const auto_slug = create_category_form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      set_create_category_form(prev => ({ ...prev, slug: auto_slug }));
    }
  }, [create_category_form.name]);

  // ===========================
  // DATA FETCHING
  // ===========================

  // Fetch service categories
  const { data: service_categories = [], isLoading: is_loading_categories } = useQuery({
    queryKey: ['admin-service-categories'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/service-categories`, {
        headers: { Authorization: `Bearer ${auth_token}` }
      });
      return response.data as ServiceCategory[];
    },
    enabled: !!auth_token,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false
  });

  // Fetch services with filtering
  const { data: services = [], isLoading: is_loading_services, error: fetch_error } = useQuery({
    queryKey: ['admin-services', filters.category, filters.active],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.active !== null) params.set('is_active', String(filters.active));
      
      const response = await axios.get(`${API_BASE_URL}/api/admin/services?${params.toString()}`, {
        headers: { Authorization: `Bearer ${auth_token}` }
      });
      
      // Transform to expected format
      return response.data.map((item: any) => ({
        service: item.service || item,
        category: item.category || { id: item.category_id, name: item.category_name, slug: '' },
        options: item.options || []
      })) as ServiceWithDetails[];
    },
    enabled: !!auth_token,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
    retry: 1
  });

  // ===========================
  // MUTATIONS
  // ===========================

  // Create service mutation
  const create_service_mutation = useMutation({
    mutationFn: async (data: CreateServiceFormData) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/admin/services`,
        data,
        { headers: { Authorization: `Bearer ${auth_token}`, 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      set_create_service_modal_open(false);
      set_create_service_form({
        category_id: '',
        name: '',
        slug: '',
        description: '',
        requires_booking: false,
        requires_proof: false,
        is_top_seller: false,
        slot_duration_hours: 2
      });
      show_toast({
        type: 'success',
        message: 'Service created successfully',
        duration: 5000
      });
    },
    onError: (error: any) => {
      const error_message = error.response?.data?.message || 'Failed to create service';
      show_toast({
        type: 'error',
        message: error_message,
        duration: 5000
      });
    }
  });

  // Create category mutation
  const create_category_mutation = useMutation({
    mutationFn: async (data: CreateCategoryFormData) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/admin/service-categories`,
        data,
        { headers: { Authorization: `Bearer ${auth_token}`, 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      set_create_category_modal_open(false);
      set_create_category_form({
        name: '',
        slug: '',
        sort_order: service_categories.length
      });
      show_toast({
        type: 'success',
        message: 'Category created successfully',
        duration: 5000
      });
    },
    onError: (error: any) => {
      const error_message = error.response?.data?.message || 'Failed to create category';
      show_toast({
        type: 'error',
        message: error_message,
        duration: 5000
      });
    }
  });

  // Toggle service active mutation
  const toggle_active_mutation = useMutation({
    mutationFn: async ({ service_id, is_active }: { service_id: string; is_active: boolean }) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/services/${service_id}`,
        { is_active },
        { headers: { Authorization: `Bearer ${auth_token}`, 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onMutate: async ({ service_id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-services'] });
      const previous_services = queryClient.getQueryData(['admin-services', filters.category, filters.active]);
      
      queryClient.setQueryData(['admin-services', filters.category, filters.active], (old: ServiceWithDetails[] = []) =>
        old.map(item =>
          item.service.id === service_id
            ? { ...item, service: { ...item.service, is_active } }
            : item
        )
      );
      
      return { previous_services };
    },
    onError: (error: any, variables, context) => {
      if (context?.previous_services) {
        queryClient.setQueryData(['admin-services', filters.category, filters.active], context.previous_services);
      }
      show_toast({
        type: 'error',
        message: 'Failed to update service status',
        duration: 5000
      });
    },
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Service status updated',
        duration: 3000
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    }
  });

  // Toggle top seller mutation
  const toggle_top_seller_mutation = useMutation({
    mutationFn: async ({ service_id, is_top_seller }: { service_id: string; is_top_seller: boolean }) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/services/${service_id}`,
        { is_top_seller },
        { headers: { Authorization: `Bearer ${auth_token}`, 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onMutate: async ({ service_id, is_top_seller }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-services'] });
      const previous_services = queryClient.getQueryData(['admin-services', filters.category, filters.active]);
      
      queryClient.setQueryData(['admin-services', filters.category, filters.active], (old: ServiceWithDetails[] = []) =>
        old.map(item =>
          item.service.id === service_id
            ? { ...item, service: { ...item.service, is_top_seller } }
            : item
        )
      );
      
      return { previous_services };
    },
    onError: (error: any, variables, context) => {
      if (context?.previous_services) {
        queryClient.setQueryData(['admin-services', filters.category, filters.active], context.previous_services);
      }
      show_toast({
        type: 'error',
        message: 'Failed to update top seller status',
        duration: 5000
      });
    },
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Top seller status updated',
        duration: 3000
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    }
  });

  // ===========================
  // EVENT HANDLERS
  // ===========================

  const handle_filter_change = (filter_key: 'category' | 'active', value: string | boolean | null) => {
    setFilters(prev => ({ ...prev, [filter_key]: value }));
  };

  const handle_search_change = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const handle_create_service_submit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!create_service_form.category_id || !create_service_form.name || !create_service_form.slug) {
      show_toast({
        type: 'error',
        message: 'Please fill in all required fields',
        duration: 5000
      });
      return;
    }

    create_service_mutation.mutate(create_service_form);
  };

  const handle_create_category_submit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!create_category_form.name || !create_category_form.slug) {
      show_toast({
        type: 'error',
        message: 'Please fill in all required fields',
        duration: 5000
      });
      return;
    }

    create_category_mutation.mutate(create_category_form);
  };

  const handle_toggle_active = (service_id: string, current_active: boolean) => {
    toggle_active_mutation.mutate({ service_id, is_active: !current_active });
  };

  const handle_toggle_top_seller = (service_id: string, current_top_seller: boolean) => {
    toggle_top_seller_mutation.mutate({ service_id, is_top_seller: !current_top_seller });
  };

  const handle_navigate_to_editor = (service_id: string) => {
    navigate(`/admin/services/${service_id}`);
  };

  // Filter services by search query (client-side)
  const filtered_services = services.filter(item => {
    if (!filters.search) return true;
    const search_lower = filters.search.toLowerCase();
    return (
      item.service.name.toLowerCase().includes(search_lower) ||
      item.service.description?.toLowerCase().includes(search_lower) ||
      item.category.name.toLowerCase().includes(search_lower)
    );
  });

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Services & Categories</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Manage your service catalog and configure quote wizard fields
                </p>
              </div>
              <div className="mt-4 sm:mt-0 flex space-x-3">
                <button
                  onClick={() => set_create_category_modal_open(true)}
                  className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors border border-gray-300"
                >
                  Add Category
                </button>
                <button
                  onClick={() => set_create_service_modal_open(true)}
                  className="px-6 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors shadow-sm"
                >
                  Add Service
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search Input */}
              <div className="md:col-span-2">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search Services
                </label>
                <input
                  id="search"
                  type="text"
                  value={filters.search}
                  onChange={(e) => handle_search_change(e.target.value)}
                  placeholder="Search by name, description..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                />
              </div>

              {/* Category Filter */}
              <div>
                <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  id="category-filter"
                  value={filters.category || ''}
                  onChange={(e) => handle_filter_change('category', e.target.value || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {service_categories.map(cat => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Filter */}
              <div>
                <label htmlFor="active-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="active-filter"
                  value={filters.active === null ? '' : String(filters.active)}
                  onChange={(e) => handle_filter_change('active', e.target.value === '' ? null : e.target.value === 'true')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                >
                  <option value="">All Services</option>
                  <option value="true">Active Only</option>
                  <option value="false">Inactive Only</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading State */}
          {is_loading_services && (
            <div className="flex justify-center py-12">
              <div className="flex items-center space-x-3">
                <svg className="animate-spin h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-600">Loading services...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {fetch_error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">Failed to load services. Please try again.</p>
            </div>
          )}

          {/* Empty State */}
          {!is_loading_services && filtered_services.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No services found</h3>
              <p className="text-gray-600 mb-6">
                {filters.search || filters.category || filters.active !== null
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first service'}
              </p>
              {(!filters.search && !filters.category && filters.active === null) && (
                <button
                  onClick={() => set_create_service_modal_open(true)}
                  className="px-6 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
                >
                  Create First Service
                </button>
              )}
            </div>
          )}

          {/* Services Table */}
          {!is_loading_services && filtered_services.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Service
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Configuration
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtered_services.map((item) => (
                      <tr key={item.service.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <div className="text-sm font-semibold text-gray-900">
                              {item.service.name}
                            </div>
                            {item.service.description && (
                              <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                                {item.service.description}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {item.category.name}
                          </span>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {item.service.requires_booking && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                                📅 Booking
                              </span>
                            )}
                            {item.service.requires_proof && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                                🎨 Proof
                              </span>
                            )}
                            {item.options.length > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                                {item.options.length} fields
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={() => handle_toggle_active(item.service.id, item.service.is_active)}
                              disabled={toggle_active_mutation.isPending}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                                item.service.is_active
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                              }`}
                            >
                              {item.service.is_active ? '✓ Active' : '✗ Inactive'}
                            </button>
                            
                            {item.service.is_top_seller && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                ⭐ Top Seller
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handle_toggle_top_seller(item.service.id, item.service.is_top_seller)}
                              disabled={toggle_top_seller_mutation.isPending}
                              className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                              title={item.service.is_top_seller ? "Remove from top sellers" : "Mark as top seller"}
                            >
                              <svg className="w-5 h-5" fill={item.service.is_top_seller ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                            
                            <button
                              onClick={() => handle_navigate_to_editor(item.service.id)}
                              className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Create Service Modal */}
        {create_service_modal_open && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div 
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                aria-hidden="true"
                onClick={() => set_create_service_modal_open(false)}
              ></div>

              {/* Modal panel */}
              <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <form onSubmit={handle_create_service_submit}>
                  <div className="bg-white px-6 pt-6 pb-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-gray-900" id="modal-title">
                        Create New Service
                      </h3>
                      <button
                        type="button"
                        onClick={() => set_create_service_modal_open(false)}
                        className="text-gray-400 hover:text-gray-500"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Category Selection */}
                      <div>
                        <label htmlFor="service-category" className="block text-sm font-semibold text-gray-700 mb-1">
                          Category *
                        </label>
                        <select
                          id="service-category"
                          required
                          value={create_service_form.category_id}
                          onChange={(e) => set_create_service_form(prev => ({ ...prev, category_id: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                        >
                          <option value="">Select a category</option>
                          {service_categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Service Name */}
                      <div>
                        <label htmlFor="service-name" className="block text-sm font-semibold text-gray-700 mb-1">
                          Service Name *
                        </label>
                        <input
                          id="service-name"
                          type="text"
                          required
                          value={create_service_form.name}
                          onChange={(e) => set_create_service_form(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Business Cards"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                        />
                      </div>

                      {/* Slug */}
                      <div>
                        <label htmlFor="service-slug" className="block text-sm font-semibold text-gray-700 mb-1">
                          URL Slug *
                        </label>
                        <input
                          id="service-slug"
                          type="text"
                          required
                          value={create_service_form.slug}
                          onChange={(e) => set_create_service_form(prev => ({ ...prev, slug: e.target.value }))}
                          placeholder="business-cards"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Auto-generated from name, but you can customize</p>
                      </div>

                      {/* Description */}
                      <div>
                        <label htmlFor="service-description" className="block text-sm font-semibold text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          id="service-description"
                          rows={3}
                          value={create_service_form.description}
                          onChange={(e) => set_create_service_form(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Brief description of this service..."
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none"
                        />
                      </div>

                      {/* Slot Duration */}
                      <div>
                        <label htmlFor="slot-duration" className="block text-sm font-semibold text-gray-700 mb-1">
                          Booking Slot Duration (hours)
                        </label>
                        <input
                          id="slot-duration"
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={create_service_form.slot_duration_hours}
                          onChange={(e) => set_create_service_form(prev => ({ ...prev, slot_duration_hours: parseFloat(e.target.value) }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                        />
                      </div>

                      {/* Checkboxes */}
                      <div className="space-y-3 pt-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={create_service_form.requires_booking}
                            onChange={(e) => set_create_service_form(prev => ({ ...prev, requires_booking: e.target.checked }))}
                            className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Requires booking appointment</span>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={create_service_form.requires_proof}
                            onChange={(e) => set_create_service_form(prev => ({ ...prev, requires_proof: e.target.checked }))}
                            className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Requires design proof</span>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={create_service_form.is_top_seller}
                            onChange={(e) => set_create_service_form(prev => ({ ...prev, is_top_seller: e.target.checked }))}
                            className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Feature as top seller on homepage</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => set_create_service_modal_open(false)}
                      className="px-4 py-2 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors border border-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={create_service_mutation.isPending}
                      className="px-6 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {create_service_mutation.isPending ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating...
                        </span>
                      ) : 'Create Service'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Create Category Modal */}
        {create_category_modal_open && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="category-modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div 
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                aria-hidden="true"
                onClick={() => set_create_category_modal_open(false)}
              ></div>

              {/* Modal panel */}
              <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <form onSubmit={handle_create_category_submit}>
                  <div className="bg-white px-6 pt-6 pb-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-gray-900" id="category-modal-title">
                        Create New Category
                      </h3>
                      <button
                        type="button"
                        onClick={() => set_create_category_modal_open(false)}
                        className="text-gray-400 hover:text-gray-500"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Category Name */}
                      <div>
                        <label htmlFor="category-name" className="block text-sm font-semibold text-gray-700 mb-1">
                          Category Name *
                        </label>
                        <input
                          id="category-name"
                          type="text"
                          required
                          value={create_category_form.name}
                          onChange={(e) => set_create_category_form(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Business Printing"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                        />
                      </div>

                      {/* Category Slug */}
                      <div>
                        <label htmlFor="category-slug" className="block text-sm font-semibold text-gray-700 mb-1">
                          URL Slug *
                        </label>
                        <input
                          id="category-slug"
                          type="text"
                          required
                          value={create_category_form.slug}
                          onChange={(e) => set_create_category_form(prev => ({ ...prev, slug: e.target.value }))}
                          placeholder="business-printing"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Auto-generated from name, but you can customize</p>
                      </div>

                      {/* Sort Order */}
                      <div>
                        <label htmlFor="category-sort" className="block text-sm font-semibold text-gray-700 mb-1">
                          Sort Order
                        </label>
                        <input
                          id="category-sort"
                          type="number"
                          min="0"
                          value={create_category_form.sort_order}
                          onChange={(e) => set_create_category_form(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => set_create_category_modal_open(false)}
                      className="px-4 py-2 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors border border-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={create_category_mutation.isPending}
                      className="px-6 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {create_category_mutation.isPending ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating...
                        </span>
                      ) : 'Create Category'}
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

export default UV_ADMIN_ServicesManager;