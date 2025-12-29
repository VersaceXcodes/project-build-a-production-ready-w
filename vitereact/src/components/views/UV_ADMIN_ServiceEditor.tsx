import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  type: 'TEXT' | 'SELECT' | 'CHECKBOX' | 'NUMBER';
  required: boolean;
  choices: string | null;
  pricing_impact: string | null;
  help_text: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceFormData {
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  requires_booking: boolean;
  requires_proof: boolean;
  is_top_seller: boolean;
  is_active: boolean;
  slot_duration_hours: number;
}

interface NewOptionFormData {
  key: string;
  label: string;
  type: 'TEXT' | 'SELECT' | 'CHECKBOX' | 'NUMBER';
  required: boolean;
  choices: string | null;
  help_text: string | null;
  sort_order: number;
}

// ===========================
// MAIN COMPONENT
// ===========================

const UV_ADMIN_ServiceEditor: React.FC = () => {
  const { id: service_id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Global state (individual selectors)
  const auth_token = useAppStore((state) => state.authentication_state.auth_token);
  const current_user = useAppStore((state) => state.authentication_state.current_user);
  const show_toast = useAppStore((state) => state.show_toast);
  const show_modal = useAppStore((state) => state.show_modal);
  const close_modal = useAppStore((state) => state.close_modal);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Check if creating new service
  const is_new_service = service_id === 'new';

  // Local state
  const [service_form, set_service_form] = useState<ServiceFormData>({
    category_id: '',
    name: '',
    slug: '',
    description: null,
    requires_booking: false,
    requires_proof: false,
    is_top_seller: false,
    is_active: true,
    slot_duration_hours: 2,
  });

  const [new_option_form, set_new_option_form] = useState<NewOptionFormData>({
    key: '',
    label: '',
    type: 'TEXT',
    required: false,
    choices: null,
    help_text: null,
    sort_order: 0,
  });

  const [option_choices_input, set_option_choices_input] = useState('');
  const [show_option_form, set_show_option_form] = useState(false);
  const [edit_option_id, set_edit_option_id] = useState<string | null>(null);
  const [validation_errors, set_validation_errors] = useState<{
    service: Record<string, string>;
    option: Record<string, string>;
  }>({
    service: {},
    option: {},
  });

  // ===========================
  // API CALLS
  // ===========================

  // Fetch service categories
  const { data: categories_data } = useQuery<ServiceCategory[]>({
    queryKey: ['admin-service-categories'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/service-categories`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return response.data;
    },
    staleTime: 300000, // 5 minutes
  });

  const service_categories = categories_data || [];

  // Fetch service details (if editing)
  const { data: service_data, isLoading: is_loading_service } = useQuery<{
    service: Service;
    service_options: ServiceOption[];
  }>({
    queryKey: ['admin-service', service_id],
    queryFn: async () => {
      // First get service by ID to get slug
      const servicesResponse = await axios.get(`${API_BASE_URL}/api/admin/services`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      
      const serviceItem = servicesResponse.data.find((s: any) => s.service.id === service_id);
      if (!serviceItem) throw new Error('Service not found');

      // The admin services endpoint already returns full details with options
      return {
        service: serviceItem.service,
        service_options: serviceItem.options || [],
      };
    },
    enabled: !is_new_service && !!auth_token,
    staleTime: 60000,
  });

  // Sync service data to form when loaded
  useEffect(() => {
    if (service_data?.service && !is_new_service) {
      set_service_form({
        category_id: service_data.service.category_id,
        name: service_data.service.name,
        slug: service_data.service.slug,
        description: service_data.service.description,
        requires_booking: service_data.service.requires_booking,
        requires_proof: service_data.service.requires_proof,
        is_top_seller: service_data.service.is_top_seller,
        is_active: service_data.service.is_active,
        slot_duration_hours: service_data.service.slot_duration_hours,
      });
    }
  }, [service_data, is_new_service]);

  const service_options = service_data?.service_options || [];

  // Create service mutation
  const create_service_mutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/admin/services`,
        data,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Service created successfully',
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      navigate('/admin/services');
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to create service',
        duration: 5000,
      });
    },
  });

  // Update service mutation
  const update_service_mutation = useMutation({
    mutationFn: async (data: Partial<ServiceFormData>) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/services/${service_id}`,
        data,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Service updated successfully',
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-service', service_id] });
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update service',
        duration: 5000,
      });
    },
  });

  // Create option mutation
  const create_option_mutation = useMutation({
    mutationFn: async (data: Omit<NewOptionFormData, 'sort_order'> & { service_id: string; sort_order: number }) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/admin/service-options`,
        data,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Option added successfully',
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-service', service_id] });
      reset_option_form();
      set_show_option_form(false);
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to add option',
        duration: 5000,
      });
    },
  });

  // Update option mutation
  const update_option_mutation = useMutation({
    mutationFn: async ({ option_id, data }: { option_id: string; data: Partial<ServiceOption> }) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/service-options/${option_id}`,
        data,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Option updated successfully',
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-service', service_id] });
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update option',
        duration: 5000,
      });
    },
  });

  // Delete option mutation
  const delete_option_mutation = useMutation({
    mutationFn: async (option_id: string) => {
      await axios.delete(
        `${API_BASE_URL}/api/admin/service-options/${option_id}`,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
    },
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Option deleted successfully',
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-service', service_id] });
      close_modal();
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to delete option',
        duration: 5000,
      });
    },
  });

  // ===========================
  // HELPER FUNCTIONS
  // ===========================

  const generate_slug_from_name = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
  };

  const validate_service_form = (): boolean => {
    const errors: Record<string, string> = {};

    if (!service_form.name.trim()) {
      errors.name = 'Service name is required';
    }

    if (!service_form.slug.trim()) {
      errors.slug = 'Slug is required';
    } else if (!/^[a-z0-9-]+$/.test(service_form.slug)) {
      errors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
    }

    if (!service_form.category_id) {
      errors.category_id = 'Category is required';
    }

    if (service_form.slot_duration_hours <= 0) {
      errors.slot_duration_hours = 'Slot duration must be positive';
    }

    set_validation_errors((prev) => ({ ...prev, service: errors }));
    return Object.keys(errors).length === 0;
  };

  const validate_option_form = (): boolean => {
    const errors: Record<string, string> = {};

    if (!new_option_form.key.trim()) {
      errors.key = 'Key is required';
    } else if (!/^[a-z_]+$/.test(new_option_form.key)) {
      errors.key = 'Key must contain only lowercase letters and underscores';
    }

    if (!new_option_form.label.trim()) {
      errors.label = 'Label is required';
    }

    if (new_option_form.type === 'SELECT' && !option_choices_input.trim()) {
      errors.choices = 'Choices are required for SELECT type';
    }

    // Validate JSON if provided
    if (new_option_form.type === 'SELECT' && option_choices_input.trim()) {
      try {
        const parsed = JSON.parse(option_choices_input);
        if (!Array.isArray(parsed)) {
          errors.choices = 'Choices must be a JSON array';
        }
      } catch {
        errors.choices = 'Invalid JSON format';
      }
    }

    set_validation_errors((prev) => ({ ...prev, option: errors }));
    return Object.keys(errors).length === 0;
  };

  const reset_option_form = () => {
    set_new_option_form({
      key: '',
      label: '',
      type: 'TEXT',
      required: false,
      choices: null,
      help_text: null,
      sort_order: 0,
    });
    set_option_choices_input('');
    set_edit_option_id(null);
    set_validation_errors((prev) => ({ ...prev, option: {} }));
  };

  // ===========================
  // EVENT HANDLERS
  // ===========================

  const handle_service_form_change = (
    field: keyof ServiceFormData,
    value: string | boolean | number | null
  ) => {
    set_service_form((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    set_validation_errors((prev) => ({
      ...prev,
      service: { ...prev.service, [field]: undefined } as Record<string, string>,
    }));
  };

  const handle_name_blur = () => {
    if (!service_form.slug && service_form.name) {
      const auto_slug = generate_slug_from_name(service_form.name);
      set_service_form((prev) => ({ ...prev, slug: auto_slug }));
    }
  };

  const handle_save_service = async () => {
    if (!validate_service_form()) {
      show_toast({
        type: 'error',
        message: 'Please fix validation errors',
        duration: 5000,
      });
      return;
    }

    if (is_new_service) {
      await create_service_mutation.mutateAsync(service_form);
    } else {
      await update_service_mutation.mutateAsync({
        name: service_form.name,
        description: service_form.description,
        is_top_seller: service_form.is_top_seller,
        is_active: service_form.is_active,
      });
    }
  };

  const handle_add_option = async () => {
    if (!validate_option_form()) {
      return;
    }

    if (!service_data?.service) {
      show_toast({
        type: 'error',
        message: 'Service must be saved before adding options',
        duration: 5000,
      });
      return;
    }

    const next_sort_order = service_options.length > 0
      ? Math.max(...service_options.map((o) => o.sort_order)) + 1
      : 0;

    await create_option_mutation.mutateAsync({
      service_id: service_data.service.id,
      key: new_option_form.key,
      label: new_option_form.label,
      type: new_option_form.type,
      required: new_option_form.required,
      choices: new_option_form.type === 'SELECT' ? option_choices_input : null,
      help_text: new_option_form.help_text || null,
      sort_order: next_sort_order,
    });
  };

  const handle_delete_option = (option_id: string, option_label: string) => {
    show_modal('confirmation', {
      title: 'Delete Option',
      message: `Are you sure you want to delete "${option_label}"? This cannot be undone.`,
      confirm_text: 'Delete',
      cancel_text: 'Cancel',
      on_confirm: async () => {
        await delete_option_mutation.mutateAsync(option_id);
      },
    });
  };

  const handle_toggle_option_required = async (option: ServiceOption) => {
    await update_option_mutation.mutateAsync({
      option_id: option.id,
      data: { required: !option.required },
    });
  };

  const handle_option_form_change = (
    field: keyof NewOptionFormData,
    value: string | boolean | number | null
  ) => {
    set_new_option_form((prev) => ({ ...prev, [field]: value }));
    set_validation_errors((prev) => ({
      ...prev,
      option: { ...prev.option, [field]: undefined } as Record<string, string>,
    }));
  };

  // ===========================
  // LOADING STATE
  // ===========================

  const is_loading = !is_new_service && is_loading_service;
  const is_saving = create_service_mutation.isPending || update_service_mutation.isPending;

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow border-b-2 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <nav className="text-sm text-gray-500 mb-2">
                  <Link to="/admin" className="hover:text-gray-700">Admin</Link>
                  <span className="mx-2">/</span>
                  <Link to="/admin/services" className="hover:text-gray-700">Services</Link>
                  <span className="mx-2">/</span>
                  <span className="text-gray-900">{is_new_service ? 'New Service' : 'Edit Service'}</span>
                </nav>
                <h1 className="text-3xl font-bold text-gray-900">
                  {is_new_service ? 'Create New Service' : `Edit: ${service_form.name || 'Service'}`}
                </h1>
              </div>
              <div className="flex items-center space-x-3">
                <Link
                  to="/admin/services"
                  className="px-6 py-3 border-2 border-black text-black rounded-lg font-medium hover:bg-black hover:text-white transition-all duration-200"
                >
                  Cancel
                </Link>
                <button
                  onClick={handle_save_service}
                  disabled={is_saving}
                  className="px-6 py-3 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {is_saving ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    is_new_service ? 'Create Service' : 'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {is_loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-3 text-gray-600">Loading service...</span>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Basic Information Section */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
                  <p className="text-sm text-gray-600 mt-1">Configure the service name, category, and core settings</p>
                </div>
                
                <div className="p-8 space-y-6">
                  {/* Category Selection */}
                  <div>
                    <label htmlFor="category_id" className="block text-sm font-medium text-gray-900 mb-2">
                      Service Category <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="category_id"
                      value={service_form.category_id}
                      onChange={(e) => handle_service_form_change('category_id', e.target.value)}
                      disabled={!is_new_service}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-100 ${
                        validation_errors.service.category_id
                          ? 'border-red-500'
                          : 'border-gray-200 focus:border-yellow-400'
                      } ${!is_new_service ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    >
                      <option value="">Select a category</option>
                      {service_categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    {validation_errors.service.category_id && (
                      <p className="mt-2 text-sm text-red-600">{validation_errors.service.category_id}</p>
                    )}
                    {!is_new_service && (
                      <p className="mt-2 text-sm text-gray-500">Category cannot be changed after creation</p>
                    )}
                  </div>

                  {/* Service Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
                      Service Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={service_form.name}
                      onChange={(e) => handle_service_form_change('name', e.target.value)}
                      onBlur={handle_name_blur}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-100 ${
                        validation_errors.service.name
                          ? 'border-red-500'
                          : 'border-gray-200 focus:border-yellow-400'
                      }`}
                      placeholder="e.g., Business Cards"
                    />
                    {validation_errors.service.name && (
                      <p className="mt-2 text-sm text-red-600">{validation_errors.service.name}</p>
                    )}
                  </div>

                  {/* Slug */}
                  <div>
                    <label htmlFor="slug" className="block text-sm font-medium text-gray-900 mb-2">
                      URL Slug <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="slug"
                      type="text"
                      value={service_form.slug}
                      onChange={(e) => handle_service_form_change('slug', e.target.value.toLowerCase())}
                      disabled={!is_new_service}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-100 ${
                        validation_errors.service.slug
                          ? 'border-red-500'
                          : 'border-gray-200 focus:border-yellow-400'
                      } ${!is_new_service ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      placeholder="e.g., business-cards"
                    />
                    {validation_errors.service.slug && (
                      <p className="mt-2 text-sm text-red-600">{validation_errors.service.slug}</p>
                    )}
                    {!is_new_service && (
                      <p className="mt-2 text-sm text-gray-500">Slug cannot be changed after creation</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-900 mb-2">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={4}
                      value={service_form.description || ''}
                      onChange={(e) => handle_service_form_change('description', e.target.value || null)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-100 focus:border-yellow-400 resize-vertical"
                      placeholder="Detailed service description for customers"
                    />
                  </div>

                  {/* Settings Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Slot Duration */}
                    <div>
                      <label htmlFor="slot_duration_hours" className="block text-sm font-medium text-gray-900 mb-2">
                        Booking Slot Duration (hours)
                      </label>
                      <input
                        id="slot_duration_hours"
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={service_form.slot_duration_hours}
                        onChange={(e) => handle_service_form_change('slot_duration_hours', parseFloat(e.target.value))}
                        className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-100 ${
                          validation_errors.service.slot_duration_hours
                            ? 'border-red-500'
                            : 'border-gray-200 focus:border-yellow-400'
                        }`}
                      />
                      {validation_errors.service.slot_duration_hours && (
                        <p className="mt-2 text-sm text-red-600">{validation_errors.service.slot_duration_hours}</p>
                      )}
                    </div>
                  </div>

                  {/* Toggle Settings */}
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-900">Requires Booking</label>
                        <p className="text-sm text-gray-500">Customer must book appointment for this service</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handle_service_form_change('requires_booking', !service_form.requires_booking)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          service_form.requires_booking ? 'bg-yellow-400' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            service_form.requires_booking ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-900">Requires Proof</label>
                        <p className="text-sm text-gray-500">Design proof needed before production</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handle_service_form_change('requires_proof', !service_form.requires_proof)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          service_form.requires_proof ? 'bg-yellow-400' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            service_form.requires_proof ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-900">Top Seller</label>
                        <p className="text-sm text-gray-500">Display on homepage as featured service</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handle_service_form_change('is_top_seller', !service_form.is_top_seller)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          service_form.is_top_seller ? 'bg-yellow-400' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            service_form.is_top_seller ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-900">Active</label>
                        <p className="text-sm text-gray-500">Service available for quote requests</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handle_service_form_change('is_active', !service_form.is_active)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          service_form.is_active ? 'bg-yellow-400' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            service_form.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuration Options Section */}
              {!is_new_service && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="px-8 py-6 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">Configuration Options</h2>
                        <p className="text-sm text-gray-600 mt-1">
                          Define form fields that customers will fill in the quote wizard
                        </p>
                      </div>
                      <button
                        onClick={() => set_show_option_form(true)}
                        className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-500 transition-all duration-200"
                      >
                        + Add Option
                      </button>
                    </div>
                  </div>

                  <div className="p-8">
                    {/* Options List */}
                    {service_options.length === 0 ? (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No configuration options</h3>
                        <p className="mt-1 text-sm text-gray-500">Get started by adding your first option field.</p>
                        <button
                          onClick={() => set_show_option_form(true)}
                          className="mt-4 px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-500 transition-all duration-200"
                        >
                          Add First Option
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {service_options
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((option) => (
                            <div
                              key={option.id}
                              className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-yellow-400 transition-all duration-200"
                            >
                              <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                  <h3 className="text-base font-semibold text-gray-900">{option.label}</h3>
                                  <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                                    {option.type}
                                  </span>
                                  {option.required && (
                                    <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">
                                      REQUIRED
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">Key: {option.key}</p>
                                {option.help_text && (
                                  <p className="text-sm text-gray-500 mt-1">{option.help_text}</p>
                                )}
                                {option.type === 'SELECT' && option.choices && (
                                  <div className="mt-2">
                                    <p className="text-xs text-gray-500">Choices:</p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {JSON.parse(option.choices).map((choice: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded"
                                        >
                                          {choice}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handle_toggle_option_required(option)}
                                  disabled={update_option_mutation.isPending}
                                  className="px-3 py-2 text-sm border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-all duration-200 disabled:opacity-50"
                                  title={option.required ? 'Make optional' : 'Make required'}
                                >
                                  {option.required ? 'Required' : 'Optional'}
                                </button>
                                <button
                                  onClick={() => handle_delete_option(option.id, option.label)}
                                  disabled={delete_option_mutation.isPending}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 disabled:opacity-50"
                                  title="Delete option"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Add Option Form */}
                    {show_option_form && (
                      <div className="mt-6 p-6 border-2 border-yellow-400 rounded-lg bg-yellow-50">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Option</h3>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="option_key" className="block text-sm font-medium text-gray-900 mb-2">
                                Key <span className="text-red-600">*</span>
                              </label>
                              <input
                                id="option_key"
                                type="text"
                                value={new_option_form.key}
                                onChange={(e) => handle_option_form_change('key', e.target.value.toLowerCase())}
                                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-200 ${
                                  validation_errors.option.key
                                    ? 'border-red-500'
                                    : 'border-gray-200 focus:border-yellow-400'
                                }`}
                                placeholder="e.g., quantity"
                              />
                              {validation_errors.option.key && (
                                <p className="mt-1 text-sm text-red-600">{validation_errors.option.key}</p>
                              )}
                              <p className="mt-1 text-xs text-gray-500">Lowercase letters and underscores only</p>
                            </div>

                            <div>
                              <label htmlFor="option_label" className="block text-sm font-medium text-gray-900 mb-2">
                                Label <span className="text-red-600">*</span>
                              </label>
                              <input
                                id="option_label"
                                type="text"
                                value={new_option_form.label}
                                onChange={(e) => handle_option_form_change('label', e.target.value)}
                                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-200 ${
                                  validation_errors.option.label
                                    ? 'border-red-500'
                                    : 'border-gray-200 focus:border-yellow-400'
                                }`}
                                placeholder="e.g., Quantity"
                              />
                              {validation_errors.option.label && (
                                <p className="mt-1 text-sm text-red-600">{validation_errors.option.label}</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="option_type" className="block text-sm font-medium text-gray-900 mb-2">
                                Field Type
                              </label>
                              <select
                                id="option_type"
                                value={new_option_form.type}
                                onChange={(e) => handle_option_form_change('type', e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-200 focus:border-yellow-400"
                              >
                                <option value="TEXT">Text Input</option>
                                <option value="SELECT">Dropdown Select</option>
                                <option value="CHECKBOX">Checkbox</option>
                                <option value="NUMBER">Number Input</option>
                              </select>
                            </div>

                            <div className="flex items-center">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={new_option_form.required}
                                  onChange={(e) => handle_option_form_change('required', e.target.checked)}
                                  className="w-5 h-5 text-yellow-400 border-2 border-gray-300 rounded focus:ring-yellow-400"
                                />
                                <span className="text-sm font-medium text-gray-900">Required Field</span>
                              </label>
                            </div>
                          </div>

                          {/* Choices (for SELECT type) */}
                          {new_option_form.type === 'SELECT' && (
                            <div>
                              <label htmlFor="option_choices" className="block text-sm font-medium text-gray-900 mb-2">
                                Choices (JSON Array) <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                id="option_choices"
                                rows={3}
                                value={option_choices_input}
                                onChange={(e) => set_option_choices_input(e.target.value)}
                                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-200 resize-vertical font-mono text-sm ${
                                  validation_errors.option.choices
                                    ? 'border-red-500'
                                    : 'border-gray-200 focus:border-yellow-400'
                                }`}
                                placeholder='["Option 1", "Option 2", "Option 3"]'
                              />
                              {validation_errors.option.choices && (
                                <p className="mt-1 text-sm text-red-600">{validation_errors.option.choices}</p>
                              )}
                              <p className="mt-1 text-xs text-gray-500">Enter a valid JSON array of strings</p>
                            </div>
                          )}

                          {/* Help Text */}
                          <div>
                            <label htmlFor="option_help_text" className="block text-sm font-medium text-gray-900 mb-2">
                              Help Text (Optional)
                            </label>
                            <input
                              id="option_help_text"
                              type="text"
                              value={new_option_form.help_text || ''}
                              onChange={(e) => handle_option_form_change('help_text', e.target.value || null)}
                              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-200 focus:border-yellow-400"
                              placeholder="Additional guidance for customers"
                            />
                          </div>

                          <div className="flex items-center justify-end space-x-3 pt-4">
                            <button
                              onClick={() => {
                                set_show_option_form(false);
                                reset_option_form();
                              }}
                              className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handle_add_option}
                              disabled={create_option_mutation.isPending}
                              className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {create_option_mutation.isPending ? (
                                <span className="flex items-center">
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Adding...
                                </span>
                              ) : (
                                'Add Option'
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Help Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-900">Configuration Tips</h3>
                    <ul className="mt-2 text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>Use descriptive labels that customers will understand</li>
                      <li>Add help text to clarify complex options</li>
                      <li>Mark critical fields as required to ensure complete quotes</li>
                      <li>For SELECT type, provide clear choice options</li>
                      <li>Configuration options appear in Step 2 of the quote wizard</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_ADMIN_ServiceEditor;