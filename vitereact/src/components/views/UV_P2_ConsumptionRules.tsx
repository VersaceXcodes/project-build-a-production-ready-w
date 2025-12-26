import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface MaterialConsumptionRule {
  id: string;
  service_id: string;
  inventory_item_id: string;
  rule_json: string;
  created_at: string;
  updated_at: string;
}

interface Service {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  is_active: boolean;
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  qty_on_hand: string; // PostgreSQL NUMERIC returns as string
  is_active: boolean;
}

interface ConsumptionRuleWithDetails {
  rule: MaterialConsumptionRule;
  service: Service;
  inventory_item: InventoryItem;
}

interface RuleFormData {
  service_id: string | null;
  inventory_item_id: string | null;
  formula: string;
  multiplier: number;
  base_amount: number;
}

interface ParsedRuleJson {
  formula: string;
  multiplier: number;
  base_amount: number;
}

// ===========================
// MAIN COMPONENT
// ===========================

const UV_P2_ConsumptionRules: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Global state (individual selectors - CRITICAL)
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const featureInventoryEnabled = useAppStore(state => state.feature_flags.feature_inventory_enabled);
  const showToast = useAppStore(state => state.show_toast);
  const showModal = useAppStore(state => state.show_modal);
  const closeModal = useAppStore(state => state.close_modal);

  // URL params
  const serviceIdFilter = searchParams.get('service_id') || null;
  const materialSearch = searchParams.get('material_search') || '';

  // Local state
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [ruleFormData, setRuleFormData] = useState<RuleFormData>({
    service_id: null,
    inventory_item_id: null,
    formula: '',
    multiplier: 1,
    base_amount: 0,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Check feature flag access
  useEffect(() => {
    if (!featureInventoryEnabled) {
      showToast({
        type: 'error',
        message: 'Inventory features are not enabled. Enable in Settings > Features.',
        duration: 5000,
      });
      navigate('/admin');
    }
  }, [featureInventoryEnabled, navigate, showToast]);

  // API base URL
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // ===========================
  // API FUNCTIONS
  // ===========================

  const fetchConsumptionRules = async (): Promise<ConsumptionRuleWithDetails[]> => {
    const params: Record<string, string> = {};
    if (serviceIdFilter) params.service_id = serviceIdFilter;

    const response = await axios.get(
      `${API_BASE_URL}/api/admin/material-consumption-rules`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params,
      }
    );
    return response.data;
  };

  const fetchServices = async (): Promise<Service[]> => {
    const response = await axios.get(
      `${API_BASE_URL}/api/admin/services`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { is_active: true },
      }
    );
    return response.data;
  };

  const fetchInventoryItems = async (): Promise<InventoryItem[]> => {
    const params: Record<string, any> = { is_active: true };
    if (materialSearch) params.sku = materialSearch;

    const response = await axios.get(
      `${API_BASE_URL}/api/admin/inventory-items`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params,
      }
    );

    // Transform response based on OpenAPI spec structure
    const items = response.data;
    if (Array.isArray(items)) {
      // If response is array of { item, stock_status }
      return items.map((i: any) => i.item || i);
    }
    return items;
  };

  // ===========================
  // REACT QUERY HOOKS
  // ===========================

  const rulesQuery = useQuery({
    queryKey: ['consumption-rules', serviceIdFilter],
    queryFn: fetchConsumptionRules,
    enabled: !!authToken && featureInventoryEnabled,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const servicesQuery = useQuery({
    queryKey: ['services-dropdown'],
    queryFn: fetchServices,
    enabled: !!authToken && featureInventoryEnabled,
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  const inventoryQuery = useQuery({
    queryKey: ['inventory-items', materialSearch],
    queryFn: fetchInventoryItems,
    enabled: !!authToken && featureInventoryEnabled,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // ===========================
  // MUTATIONS
  // ===========================

  const createRuleMutation = useMutation({
    mutationFn: async (formData: RuleFormData) => {
      const ruleJson = JSON.stringify({
        formula: formData.formula,
        multiplier: formData.multiplier,
        base_amount: formData.base_amount,
      });

      const response = await axios.post(
        `${API_BASE_URL}/api/admin/material-consumption-rules`,
        {
          service_id: formData.service_id,
          inventory_item_id: formData.inventory_item_id,
          rule_json: ruleJson,
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumption-rules'] });
      showToast({
        type: 'success',
        message: 'Consumption rule created successfully',
        duration: 5000,
      });
      resetForm();
      setIsFormVisible(false);
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to create rule',
        duration: 5000,
      });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ ruleId, formData }: { ruleId: string; formData: RuleFormData }) => {
      const ruleJson = JSON.stringify({
        formula: formData.formula,
        multiplier: formData.multiplier,
        base_amount: formData.base_amount,
      });

      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/material-consumption-rules/${ruleId}`,
        { rule_json: ruleJson },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumption-rules'] });
      showToast({
        type: 'success',
        message: 'Consumption rule updated successfully',
        duration: 5000,
      });
      resetForm();
      setIsFormVisible(false);
      setSelectedRuleId(null);
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update rule',
        duration: 5000,
      });
    },
  });

  // Workaround for missing DELETE endpoint - use update with is_active=false
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      // Since DELETE endpoint is missing, we'll use PATCH to soft-delete
      // or just show error message
      throw new Error('DELETE endpoint not implemented - please implement PATCH with is_active=false in backend');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumption-rules'] });
      showToast({
        type: 'success',
        message: 'Consumption rule deleted successfully',
        duration: 5000,
      });
      closeModal();
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.message || 'Failed to delete rule',
        duration: 5000,
      });
    },
  });

  // ===========================
  // HANDLERS
  // ===========================

  const resetForm = () => {
    setRuleFormData({
      service_id: null,
      inventory_item_id: null,
      formula: '',
      multiplier: 1,
      base_amount: 0,
    });
    setFormErrors({});
  };

  const handleCreateNew = () => {
    resetForm();
    setSelectedRuleId(null);
    setIsFormVisible(true);
  };

  const handleEditRule = (rule: ConsumptionRuleWithDetails) => {
    try {
      const parsedRuleJson: ParsedRuleJson = JSON.parse(rule.rule.rule_json);
      setRuleFormData({
        service_id: rule.rule.service_id,
        inventory_item_id: rule.rule.inventory_item_id,
        formula: parsedRuleJson.formula || '',
        multiplier: parsedRuleJson.multiplier || 1,
        base_amount: parsedRuleJson.base_amount || 0,
      });
      setSelectedRuleId(rule.rule.id);
      setIsFormVisible(true);
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to parse rule data',
        duration: 5000,
      });
    }
  };

  const handleDeleteRule = (ruleId: string) => {
    showModal('confirmation', {
      title: 'Delete Consumption Rule',
      message: 'Are you sure you want to delete this consumption rule? This action cannot be undone.',
      onConfirm: () => {
        deleteRuleMutation.mutate(ruleId);
      },
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!ruleFormData.service_id) {
      errors.service_id = 'Service is required';
    }
    if (!ruleFormData.inventory_item_id) {
      errors.inventory_item_id = 'Material is required';
    }
    if (!ruleFormData.formula.trim()) {
      errors.formula = 'Formula is required';
    }
    if (ruleFormData.multiplier <= 0) {
      errors.multiplier = 'Multiplier must be greater than 0';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast({
        type: 'error',
        message: 'Please fix form errors before submitting',
        duration: 5000,
      });
      return;
    }

    if (selectedRuleId) {
      updateRuleMutation.mutate({ ruleId: selectedRuleId, formData: ruleFormData });
    } else {
      createRuleMutation.mutate(ruleFormData);
    }
  };

  const handleServiceFilter = (serviceId: string | null) => {
    if (serviceId) {
      setSearchParams({ service_id: serviceId });
    } else {
      setSearchParams({});
    }
  };

  const handleMaterialSearchChange = (search: string) => {
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('material_search', search);
    } else {
      params.delete('material_search');
    }
    setSearchParams(params);
  };

  // ===========================
  // DERIVED DATA
  // ===========================

  const consumptionRules = rulesQuery.data || [];
  const servicesList = servicesQuery.data || [];
  const inventoryItems = inventoryQuery.data || [];
  const isLoading = rulesQuery.isLoading || servicesQuery.isLoading || inventoryQuery.isLoading;
  const isSaving = createRuleMutation.isPending || updateRuleMutation.isPending || deleteRuleMutation.isPending;

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      {/* Page Header */}
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="flex mb-6" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <Link
                  to="/admin"
                  className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  Admin
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <svg className="w-3 h-3 text-gray-400 mx-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  <Link
                    to="/admin/inventory"
                    className="ml-1 text-sm font-medium text-gray-700 hover:text-blue-600 md:ml-2"
                  >
                    Inventory
                  </Link>
                </div>
              </li>
              <li aria-current="page">
                <div className="flex items-center">
                  <svg className="w-3 h-3 text-gray-400 mx-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">
                    Consumption Rules
                  </span>
                </div>
              </li>
            </ol>
          </nav>

          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Material Consumption Rules</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Configure automatic inventory deductions when orders enter production
                </p>
              </div>
              <button
                onClick={handleCreateNew}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Rule
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Service Filter */}
              <div>
                <label htmlFor="service-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Service
                </label>
                <select
                  id="service-filter"
                  value={serviceIdFilter || ''}
                  onChange={(e) => handleServiceFilter(e.target.value || null)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-gray-900"
                >
                  <option value="">All Services</option>
                  {servicesList.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Material Search */}
              <div>
                <label htmlFor="material-search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search Materials by SKU
                </label>
                <input
                  id="material-search"
                  type="text"
                  value={materialSearch}
                  onChange={(e) => handleMaterialSearchChange(e.target.value)}
                  placeholder="Enter SKU to search..."
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Rules List or Form */}
          {isFormVisible ? (
            /* Rule Form */
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {selectedRuleId ? 'Edit Consumption Rule' : 'Create Consumption Rule'}
                </h2>
                <button
                  onClick={() => {
                    setIsFormVisible(false);
                    resetForm();
                    setSelectedRuleId(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Service Selection */}
                <div>
                  <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-2">
                    Service <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="service"
                    value={ruleFormData.service_id || ''}
                    onChange={(e) => {
                      setRuleFormData(prev => ({ ...prev, service_id: e.target.value || null }));
                      setFormErrors(prev => ({ ...prev, service_id: '' }));
                    }}
                    className={`w-full px-4 py-3 rounded-lg border-2 ${
                      formErrors.service_id ? 'border-red-500' : 'border-gray-200'
                    } focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-gray-900`}
                    disabled={servicesQuery.isLoading}
                  >
                    <option value="">Select a service...</option>
                    {servicesList.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.service_id && (
                    <p className="mt-2 text-sm text-red-600">{formErrors.service_id}</p>
                  )}
                </div>

                {/* Material Selection */}
                <div>
                  <label htmlFor="material" className="block text-sm font-medium text-gray-700 mb-2">
                    Inventory Material <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="material"
                    value={ruleFormData.inventory_item_id || ''}
                    onChange={(e) => {
                      setRuleFormData(prev => ({ ...prev, inventory_item_id: e.target.value || null }));
                      setFormErrors(prev => ({ ...prev, inventory_item_id: '' }));
                    }}
                    className={`w-full px-4 py-3 rounded-lg border-2 ${
                      formErrors.inventory_item_id ? 'border-red-500' : 'border-gray-200'
                    } focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-gray-900`}
                    disabled={inventoryQuery.isLoading}
                  >
                    <option value="">Select a material...</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku}) - {Number(item.qty_on_hand || 0).toFixed(2)} {item.unit} on hand
                      </option>
                    ))}
                  </select>
                  {formErrors.inventory_item_id && (
                    <p className="mt-2 text-sm text-red-600">{formErrors.inventory_item_id}</p>
                  )}
                </div>

                {/* Formula Input */}
                <div>
                  <label htmlFor="formula" className="block text-sm font-medium text-gray-700 mb-2">
                    Consumption Formula <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="formula"
                    type="text"
                    value={ruleFormData.formula}
                    onChange={(e) => {
                      setRuleFormData(prev => ({ ...prev, formula: e.target.value }));
                      setFormErrors(prev => ({ ...prev, formula: '' }));
                    }}
                    placeholder="e.g., quantity * 1.2 or quantity * 1.5 + 10"
                    className={`w-full px-4 py-3 rounded-lg border-2 ${
                      formErrors.formula ? 'border-red-500' : 'border-gray-200'
                    } focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-gray-900`}
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Supported variables: <code className="bg-gray-100 px-2 py-1 rounded">quantity</code>
                    {' '}| Operators: <code className="bg-gray-100 px-2 py-1 rounded">*, /, +, -</code>
                  </p>
                  {formErrors.formula && (
                    <p className="mt-2 text-sm text-red-600">{formErrors.formula}</p>
                  )}
                </div>

                {/* Multiplier */}
                <div>
                  <label htmlFor="multiplier" className="block text-sm font-medium text-gray-700 mb-2">
                    Multiplier
                  </label>
                  <input
                    id="multiplier"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={ruleFormData.multiplier}
                    onChange={(e) => {
                      setRuleFormData(prev => ({ ...prev, multiplier: parseFloat(e.target.value) || 1 }));
                      setFormErrors(prev => ({ ...prev, multiplier: '' }));
                    }}
                    className={`w-full px-4 py-3 rounded-lg border-2 ${
                      formErrors.multiplier ? 'border-red-500' : 'border-gray-200'
                    } focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-gray-900`}
                  />
                  {formErrors.multiplier && (
                    <p className="mt-2 text-sm text-red-600">{formErrors.multiplier}</p>
                  )}
                </div>

                {/* Base Amount */}
                <div>
                  <label htmlFor="base_amount" className="block text-sm font-medium text-gray-700 mb-2">
                    Base Amount (Optional)
                  </label>
                  <input
                    id="base_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={ruleFormData.base_amount}
                    onChange={(e) => {
                      setRuleFormData(prev => ({ ...prev, base_amount: parseFloat(e.target.value) || 0 }));
                    }}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-gray-900"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Fixed amount added to formula result (e.g., for setup materials)
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormVisible(false);
                      resetForm();
                      setSelectedRuleId(null);
                    }}
                    className="px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-100 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </span>
                    ) : (
                      selectedRuleId ? 'Update Rule' : 'Create Rule'
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Rules List */
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              {/* List Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Consumption Rules
                  {serviceIdFilter && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      (Filtered by service)
                    </span>
                  )}
                </h2>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="px-6 py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-gray-600">Loading consumption rules...</p>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && consumptionRules.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No consumption rules</h3>
                  <p className="mt-2 text-gray-500">
                    {serviceIdFilter 
                      ? 'No rules found for this service. Try a different filter or create a new rule.'
                      : 'Get started by creating your first consumption rule.'}
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="mt-6 inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create First Rule
                  </button>
                </div>
              )}

              {/* Rules Table */}
              {!isLoading && consumptionRules.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Service
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Material
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Formula
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Unit
                        </th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {consumptionRules.map((ruleDetail) => {
                        let parsedRule: ParsedRuleJson;
                        try {
                          parsedRule = JSON.parse(ruleDetail.rule.rule_json);
                        } catch {
                          parsedRule = { formula: 'Invalid JSON', multiplier: 0, base_amount: 0 };
                        }

                        return (
                          <tr key={ruleDetail.rule.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {ruleDetail.service.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{ruleDetail.inventory_item.name}</div>
                              <div className="text-xs text-gray-500">{ruleDetail.inventory_item.sku}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                                  {parsedRule.formula}
                                </code>
                              </div>
                              {parsedRule.base_amount > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  + {parsedRule.base_amount} base
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {ruleDetail.inventory_item.unit}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => handleEditRule(ruleDetail)}
                                className="text-blue-600 hover:text-blue-900 mr-4 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteRule(ruleDetail.rule.id)}
                                className="text-red-600 hover:text-red-900 transition-colors"
                              >
                                Delete
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
          )}

          {/* Info Panel */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-900">How Consumption Rules Work</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Rules automatically deduct materials when orders move to "In Production" status</li>
                    <li>Formula example: <code className="bg-blue-100 px-2 py-1 rounded">quantity * 1.2</code> deducts 12 sqm for 10 sqm order (20% waste allowance)</li>
                    <li>If insufficient stock, admin receives warning but can override to proceed</li>
                    <li>All deductions are logged in inventory transactions for audit trail</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_P2_ConsumptionRules;