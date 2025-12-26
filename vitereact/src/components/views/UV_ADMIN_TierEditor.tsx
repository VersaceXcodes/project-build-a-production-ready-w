import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { ChevronDown, ChevronUp, Plus, Trash2, GripVertical, Edit2, Check, X, Save, ArrowLeft } from 'lucide-react';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface TierPackage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface TierFeature {
  id: string;
  tier_id: string;
  group_name: string;
  feature_key: string;
  feature_label: string;
  feature_value: string | null;
  is_included: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface FeatureGroup {
  group_name: string;
  features: TierFeature[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// ===========================
// API FUNCTIONS
// ===========================

const fetchAllTiers = async (auth_token: string) => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/tiers`, {
    headers: { Authorization: `Bearer ${auth_token}` }
  });
  return response.data;
};

const updateTierPackage = async (tier_id: string, data: any, auth_token: string) => {
  const response = await axios.patch(
    `${API_BASE_URL}/api/admin/tiers/${tier_id}`,
    data,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
  return response.data;
};

const createTierFeature = async (data: any, auth_token: string) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/admin/tier-features`,
    data,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
  return response.data;
};

const updateTierFeature = async (feature_id: string, data: any, auth_token: string) => {
  const response = await axios.patch(
    `${API_BASE_URL}/api/admin/tier-features/${feature_id}`,
    data,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
  return response.data;
};

const deleteTierFeature = async (feature_id: string, auth_token: string) => {
  await axios.delete(
    `${API_BASE_URL}/api/admin/tier-features/${feature_id}`,
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
};

// ===========================
// HELPER FUNCTIONS
// ===========================

const groupFeaturesByName = (features: TierFeature[]): FeatureGroup[] => {
  const groups: FeatureGroup[] = [];
  
  features.forEach(feature => {
    const existing = groups.find(g => g.group_name === feature.group_name);
    if (existing) {
      existing.features.push(feature);
    } else {
      groups.push({
        group_name: feature.group_name,
        features: [feature]
      });
    }
  });
  
  // Sort features within each group by sort_order
  groups.forEach(group => {
    group.features.sort((a, b) => a.sort_order - b.sort_order);
  });
  
  return groups;
};

const validateSlug = (slug: string): boolean => {
  return /^[a-z0-9-]+$/.test(slug);
};

const validateFeatureKey = (key: string): boolean => {
  return /^[a-z_]+$/.test(key);
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_ADMIN_TierEditor: React.FC = () => {
  const { tier_id } = useParams<{ tier_id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Global state access - INDIVIDUAL SELECTORS
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const show_toast = useAppStore(state => state.show_toast);
  const show_modal = useAppStore(state => state.show_modal);
  const close_modal = useAppStore(state => state.close_modal);
  
  // Local state
  const [tier_package, set_tier_package] = useState<TierPackage | null>(null);
  const [tier_features, set_tier_features] = useState<TierFeature[]>([]);
  const [feature_groups, set_feature_groups] = useState<FeatureGroup[]>([]);
  const [tier_form, set_tier_form] = useState({
    name: '',
    slug: '',
    description: null as string | null,
    is_active: true
  });
  const [new_feature_form, set_new_feature_form] = useState({
    group_name: '',
    feature_key: '',
    feature_label: '',
    feature_value: null as string | null,
    is_included: true
  });
  const [form_errors, set_form_errors] = useState<{
    tier: Record<string, string>;
    feature: Record<string, string>;
  }>({
    tier: {},
    feature: {}
  });
  const [expanded_groups, set_expanded_groups] = useState<Record<string, boolean>>({});
  const [editing_feature_id, set_editing_feature_id] = useState<string | null>(null);
  const [editing_field, set_editing_field] = useState<'label' | 'value' | null>(null);
  const [editing_value, set_editing_value] = useState('');
  const [show_add_feature_modal, set_show_add_feature_modal] = useState(false);
  
  const is_new_tier = tier_id === 'new';
  
  // Authorization check
  useEffect(() => {
    if (!current_user || current_user.role !== 'ADMIN') {
      navigate('/admin');
      show_toast({
        type: 'error',
        message: 'Insufficient permissions',
        duration: 5000
      });
    }
  }, [current_user, navigate, show_toast]);
  
  // Fetch tier data
  const { data: tierDataList, isLoading: is_loading, error } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: () => fetchAllTiers(auth_token || ''),
    enabled: !!auth_token && !is_new_tier,
  });

  useEffect(() => {
    if (error) {
      show_toast({
        type: 'error',
        message: (error as any).response?.data?.message || 'Failed to load tier',
        duration: 5000
      });
    }
  }, [error, show_toast]);

  useEffect(() => {
    if (tierDataList) {
      const tierData = tierDataList.find((t: any) => t.tier.id === tier_id);
      if (!tierData) {
        show_toast({
          type: 'error',
          message: 'Tier not found',
          duration: 5000
        });
        navigate('/admin/tiers');
        return;
      }
      
      set_tier_package(tierData.tier);
      set_tier_features(tierData.features || []);
      set_feature_groups(groupFeaturesByName(tierData.features || []));
      set_tier_form({
        name: tierData.tier.name,
        slug: tierData.tier.slug,
        description: tierData.tier.description,
        is_active: tierData.tier.is_active
      });
      
      // Expand all groups by default
      const initial_expanded: Record<string, boolean> = {};
      groupFeaturesByName(tierData.features || []).forEach(group => {
        initial_expanded[group.group_name] = true;
      });
      set_expanded_groups(initial_expanded);
    }
  }, [tierDataList, tier_id, show_toast, navigate]);
  
  // Mutations
  const save_tier_mutation = useMutation({
    mutationFn: (data: any) => updateTierPackage(tier_id || '', data, auth_token || ''),
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Tier updated successfully',
        duration: 5000
      });
      queryClient.invalidateQueries(['admin-tiers']);
    },
    onError: (err: any) => {
      show_toast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update tier',
        duration: 5000
      });
    }
  });
  
  const create_feature_mutation = useMutation({
    mutationFn: (data: any) => createTierFeature(data, auth_token || ''),
    onSuccess: (new_feature) => {
      const updated_features = [...tier_features, new_feature];
      set_tier_features(updated_features);
      set_feature_groups(groupFeaturesByName(updated_features));
      
      set_new_feature_form({
        group_name: '',
        feature_key: '',
        feature_label: '',
        feature_value: null,
        is_included: true
      });
      set_show_add_feature_modal(false);
      
      show_toast({
        type: 'success',
        message: `Feature "${new_feature.feature_label}" added`,
        duration: 5000
      });
      
      queryClient.invalidateQueries(['admin-tiers']);
    },
    onError: (err: any) => {
      show_toast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to create feature',
        duration: 5000
      });
    }
  });
  
  const update_feature_mutation = useMutation({
    mutationFn: ({ feature_id, data }: { feature_id: string; data: any }) => 
      updateTierFeature(feature_id, data, auth_token || ''),
    onSuccess: (updated_feature) => {
      const updated_features = tier_features.map(f => 
        f.id === updated_feature.id ? updated_feature : f
      );
      set_tier_features(updated_features);
      set_feature_groups(groupFeaturesByName(updated_features));
      
      set_editing_feature_id(null);
      set_editing_field(null);
      
      show_toast({
        type: 'success',
        message: 'Feature updated',
        duration: 3000
      });
      
      queryClient.invalidateQueries(['admin-tiers']);
    },
    onError: (err: any) => {
      show_toast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update feature',
        duration: 5000
      });
      
      set_editing_feature_id(null);
      set_editing_field(null);
    }
  });
  
  const delete_feature_mutation = useMutation({
    mutationFn: (feature_id: string) => deleteTierFeature(feature_id, auth_token || ''),
    onSuccess: (_, feature_id) => {
      const updated_features = tier_features.filter(f => f.id !== feature_id);
      set_tier_features(updated_features);
      set_feature_groups(groupFeaturesByName(updated_features));
      
      show_toast({
        type: 'success',
        message: 'Feature removed',
        duration: 3000
      });
      
      queryClient.invalidateQueries(['admin-tiers']);
    },
    onError: (err: any) => {
      show_toast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete feature',
        duration: 5000
      });
    }
  });
  
  // ===========================
  // HANDLERS
  // ===========================
  
  const handle_tier_form_change = (field: string, value: any) => {
    set_tier_form(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (form_errors.tier[field]) {
      set_form_errors(prev => ({
        ...prev,
        tier: { ...prev.tier, [field]: '' }
      }));
    }
  };
  
  const validate_tier_form = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!tier_form.name.trim()) {
      errors.name = 'Tier name is required';
    }
    
    if (!tier_form.slug.trim()) {
      errors.slug = 'Tier slug is required';
    } else if (!validateSlug(tier_form.slug)) {
      errors.slug = 'Slug must be lowercase letters, numbers, and hyphens only';
    }
    
    set_form_errors(prev => ({ ...prev, tier: errors }));
    return Object.keys(errors).length === 0;
  };
  
  const handle_save_tier = async () => {
    if (!validate_tier_form()) return;
    
    save_tier_mutation.mutate({
      name: tier_form.name,
      description: tier_form.description,
      is_active: tier_form.is_active
    });
  };
  
  const validate_feature_form = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!new_feature_form.group_name.trim()) {
      errors.group_name = 'Group name is required';
    }
    
    if (!new_feature_form.feature_key.trim()) {
      errors.feature_key = 'Feature key is required';
    } else if (!validateFeatureKey(new_feature_form.feature_key)) {
      errors.feature_key = 'Feature key must be lowercase letters and underscores only';
    }
    
    if (!new_feature_form.feature_label.trim()) {
      errors.feature_label = 'Feature label is required';
    }
    
    set_form_errors(prev => ({ ...prev, feature: errors }));
    return Object.keys(errors).length === 0;
  };
  
  const handle_add_feature = async () => {
    if (!validate_feature_form() || !tier_package) return;
    
    create_feature_mutation.mutate({
      tier_id: tier_package.id,
      group_name: new_feature_form.group_name,
      feature_key: new_feature_form.feature_key,
      feature_label: new_feature_form.feature_label,
      feature_value: new_feature_form.feature_value,
      is_included: new_feature_form.is_included
    });
  };
  
  const handle_start_edit = (feature_id: string, field: 'label' | 'value', current_value: string) => {
    set_editing_feature_id(feature_id);
    set_editing_field(field);
    set_editing_value(current_value || '');
  };
  
  const handle_save_edit = async () => {
    if (!editing_feature_id || !editing_field) return;
    
    const update_data: any = {};
    if (editing_field === 'label') {
      update_data.feature_label = editing_value;
    } else {
      update_data.feature_value = editing_value || null;
    }
    
    update_feature_mutation.mutate({
      feature_id: editing_feature_id,
      data: update_data
    });
  };
  
  const handle_cancel_edit = () => {
    set_editing_feature_id(null);
    set_editing_field(null);
    set_editing_value('');
  };
  
  const handle_toggle_inclusion = async (feature: TierFeature) => {
    update_feature_mutation.mutate({
      feature_id: feature.id,
      data: { is_included: !feature.is_included }
    });
  };
  
  const handle_delete_feature = (feature: TierFeature) => {
    const confirmed = window.confirm(`Delete feature "${feature.feature_label}"? This cannot be undone.`);
    if (confirmed) {
      delete_feature_mutation.mutate(feature.id);
    }
  };
  
  const toggle_group_expansion = (group_name: string) => {
    set_expanded_groups(prev => ({
      ...prev,
      [group_name]: !prev[group_name]
    }));
  };
  
  const handle_new_feature_form_change = (field: string, value: any) => {
    set_new_feature_form(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (form_errors.feature[field]) {
      set_form_errors(prev => ({
        ...prev,
        feature: { ...prev.feature, [field]: '' }
      }));
    }
  };
  
  // ===========================
  // RENDER
  // ===========================
  
  if (is_loading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading tier configuration...</p>
          </div>
        </div>
      </>
    );
  }
  
  if (error) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <p className="text-red-700 font-medium">Failed to load tier configuration</p>
              <p className="text-red-600 text-sm mt-2">Please try again or contact support.</p>
              <Link
                to="/admin/tiers"
                className="mt-4 inline-block bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                Back to Tiers
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }
  
  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Breadcrumb */}
            <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
              <Link to="/admin" className="hover:text-gray-700">Admin</Link>
              <span>›</span>
              <Link to="/admin/tiers" className="hover:text-gray-700">Tiers</Link>
              <span>›</span>
              <span className="text-gray-900 font-medium">
                {is_new_tier ? 'New Tier' : tier_package?.name || 'Edit Tier'}
              </span>
            </nav>
            
            {/* Header actions */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {is_new_tier ? 'Create New Tier' : `Configure ${tier_package?.name} Tier`}
                </h1>
                <p className="text-gray-600 mt-1">
                  Define tier features and deliverables for customer selection and staff checklists
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <Link
                  to="/admin/tiers"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Tiers
                </Link>
                
                <button
                  onClick={handle_save_tier}
                  disabled={save_tier_mutation.isPending}
                  className="inline-flex items-center px-6 py-2 bg-yellow-400 text-black rounded-lg text-sm font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {save_tier_mutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Tier
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Tier Information Card */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Tier Information</h2>
                
                <div className="space-y-6">
                  {/* Name Input */}
                  <div>
                    <label htmlFor="tier_name" className="block text-sm font-semibold text-gray-700 mb-2">
                      Tier Name <span className="text-yellow-500">*</span>
                    </label>
                    <input
                      id="tier_name"
                      type="text"
                      value={tier_form.name}
                      onChange={(e) => handle_tier_form_change('name', e.target.value)}
                      placeholder="e.g., Basic, Standard, Gold"
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                        form_errors.tier.name 
                          ? 'border-red-500 focus:border-red-500' 
                          : 'border-gray-200 focus:border-blue-500'
                      }`}
                    />
                    {form_errors.tier.name && (
                      <p className="mt-1 text-sm text-red-600">{form_errors.tier.name}</p>
                    )}
                  </div>
                  
                  {/* Slug Input */}
                  <div>
                    <label htmlFor="tier_slug" className="block text-sm font-semibold text-gray-700 mb-2">
                      URL Slug <span className="text-yellow-500">*</span>
                    </label>
                    <input
                      id="tier_slug"
                      type="text"
                      value={tier_form.slug}
                      onChange={(e) => handle_tier_form_change('slug', e.target.value.toLowerCase())}
                      placeholder="e.g., basic, standard, premium"
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                        form_errors.tier.slug 
                          ? 'border-red-500 focus:border-red-500' 
                          : 'border-gray-200 focus:border-blue-500'
                      }`}
                    />
                    <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, and hyphens only</p>
                    {form_errors.tier.slug && (
                      <p className="mt-1 text-sm text-red-600">{form_errors.tier.slug}</p>
                    )}
                  </div>
                  
                  {/* Description Textarea */}
                  <div>
                    <label htmlFor="tier_description" className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      id="tier_description"
                      rows={4}
                      value={tier_form.description || ''}
                      onChange={(e) => handle_tier_form_change('description', e.target.value || null)}
                      placeholder="Brief description of this tier..."
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 resize-none"
                    />
                  </div>
                  
                  {/* Active Toggle */}
                  <div className="flex items-center justify-between">
                    <label htmlFor="tier_active" className="block text-sm font-semibold text-gray-700">
                      Active Status
                    </label>
                    <button
                      type="button"
                      onClick={() => handle_tier_form_change('is_active', !tier_form.is_active)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        tier_form.is_active ? 'bg-yellow-400' : 'bg-gray-300'
                      }`}
                    >
                      <span className="sr-only">Toggle active status</span>
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                          tier_form.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {tier_package && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        Created: {new Date(tier_package.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Last updated: {new Date(tier_package.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Features Section */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Tier Features & Deliverables</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Features appear in customer tier selection and staff job checklists
                      </p>
                    </div>
                    
                    <button
                      onClick={() => set_show_add_feature_modal(true)}
                      disabled={!tier_package}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Feature
                    </button>
                  </div>
                </div>
                
                <div className="p-6">
                  {feature_groups.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                        <Plus className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-medium">No features configured yet</p>
                      <p className="text-gray-500 text-sm mt-1">Add your first feature to define this tier's offerings</p>
                      <button
                        onClick={() => set_show_add_feature_modal(true)}
                        disabled={!tier_package}
                        className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Feature
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {feature_groups.map((group) => (
                        <div key={group.group_name} className="border border-gray-200 rounded-lg overflow-hidden">
                          {/* Group Header */}
                          <button
                            onClick={() => toggle_group_expansion(group.group_name)}
                            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              {expanded_groups[group.group_name] ? (
                                <ChevronUp className="w-5 h-5 text-gray-500" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                              )}
                              <span className="font-semibold text-gray-900">{group.group_name}</span>
                              <span className="text-sm text-gray-500">({group.features.length} features)</span>
                            </div>
                          </button>
                          
                          {/* Group Features */}
                          {expanded_groups[group.group_name] && (
                            <div className="divide-y divide-gray-200">
                              {group.features.map((feature) => (
                                <div key={feature.id} className="p-4 hover:bg-gray-50 transition-colors">
                                  <div className="flex items-start space-x-4">
                                    <div className="flex-shrink-0">
                                      <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                      {/* Feature Label */}
                                      <div className="mb-2">
                                        {editing_feature_id === feature.id && editing_field === 'label' ? (
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="text"
                                              value={editing_value}
                                              onChange={(e) => set_editing_value(e.target.value)}
                                              className="flex-1 px-3 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-100"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handle_save_edit();
                                                if (e.key === 'Escape') handle_cancel_edit();
                                              }}
                                            />
                                            <button
                                              onClick={handle_save_edit}
                                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                                            >
                                              <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={handle_cancel_edit}
                                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center space-x-2">
                                            <span className="font-medium text-gray-900">{feature.feature_label}</span>
                                            <button
                                              onClick={() => handle_start_edit(feature.id, 'label', feature.feature_label)}
                                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Feature Value */}
                                      <div className="mb-2">
                                        {editing_feature_id === feature.id && editing_field === 'value' ? (
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="text"
                                              value={editing_value}
                                              onChange={(e) => set_editing_value(e.target.value)}
                                              placeholder="Feature value (optional)"
                                              className="flex-1 px-3 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handle_save_edit();
                                                if (e.key === 'Escape') handle_cancel_edit();
                                              }}
                                            />
                                            <button
                                              onClick={handle_save_edit}
                                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                                            >
                                              <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={handle_cancel_edit}
                                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center space-x-2">
                                            <span className="text-sm text-gray-600">
                                              {feature.feature_value || (
                                                <span className="text-gray-400 italic">No value set</span>
                                              )}
                                            </span>
                                            <button
                                              onClick={() => handle_start_edit(feature.id, 'value', feature.feature_value || '')}
                                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Feature Key (read-only) */}
                                      <div>
                                        <span className="text-xs text-gray-400 font-mono">{feature.feature_key}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex-shrink-0 flex items-center space-x-2">
                                      {/* Included Toggle */}
                                      <button
                                        onClick={() => handle_toggle_inclusion(feature)}
                                        disabled={update_feature_mutation.isPending}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                          feature.is_included
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        {feature.is_included ? '✓ Included' : '✗ Excluded'}
                                      </button>
                                      
                                      {/* Delete Button */}
                                      <button
                                        onClick={() => handle_delete_feature(feature)}
                                        disabled={delete_feature_mutation.isPending}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Delete feature"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Add Feature Modal */}
        {show_add_feature_modal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">
                    Add Feature to {tier_package?.name}
                  </h3>
                  <button
                    onClick={() => {
                      set_show_add_feature_modal(false);
                      set_new_feature_form({
                        group_name: '',
                        feature_key: '',
                        feature_label: '',
                        feature_value: null,
                        is_included: true
                      });
                      set_form_errors(prev => ({ ...prev, feature: {} }));
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Group Name */}
                <div>
                  <label htmlFor="feature_group" className="block text-sm font-semibold text-gray-700 mb-2">
                    Feature Group <span className="text-yellow-500">*</span>
                  </label>
                  <input
                    id="feature_group"
                    type="text"
                    list="existing_groups"
                    value={new_feature_form.group_name}
                    onChange={(e) => handle_new_feature_form_change('group_name', e.target.value)}
                    placeholder="e.g., Turnaround, Design Services, Support"
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                      form_errors.feature.group_name 
                        ? 'border-red-500 focus:border-red-500' 
                        : 'border-gray-200 focus:border-blue-500'
                    }`}
                  />
                  <datalist id="existing_groups">
                    {feature_groups.map(group => (
                      <option key={group.group_name} value={group.group_name} />
                    ))}
                  </datalist>
                  <p className="mt-1 text-xs text-gray-500">Enter new group or select existing from suggestions</p>
                  {form_errors.feature.group_name && (
                    <p className="mt-1 text-sm text-red-600">{form_errors.feature.group_name}</p>
                  )}
                </div>
                
                {/* Feature Key */}
                <div>
                  <label htmlFor="feature_key" className="block text-sm font-semibold text-gray-700 mb-2">
                    Feature Key <span className="text-yellow-500">*</span>
                  </label>
                  <input
                    id="feature_key"
                    type="text"
                    value={new_feature_form.feature_key}
                    onChange={(e) => handle_new_feature_form_change('feature_key', e.target.value.toLowerCase())}
                    placeholder="e.g., turnaround_days, revision_limit"
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 font-mono text-sm ${
                      form_errors.feature.feature_key 
                        ? 'border-red-500 focus:border-red-500' 
                        : 'border-gray-200 focus:border-blue-500'
                    }`}
                  />
                  <p className="mt-1 text-xs text-gray-500">Lowercase letters and underscores only (used internally)</p>
                  {form_errors.feature.feature_key && (
                    <p className="mt-1 text-sm text-red-600">{form_errors.feature.feature_key}</p>
                  )}
                </div>
                
                {/* Feature Label */}
                <div>
                  <label htmlFor="feature_label" className="block text-sm font-semibold text-gray-700 mb-2">
                    Feature Label <span className="text-yellow-500">*</span>
                  </label>
                  <input
                    id="feature_label"
                    type="text"
                    value={new_feature_form.feature_label}
                    onChange={(e) => handle_new_feature_form_change('feature_label', e.target.value)}
                    placeholder="e.g., Standard Turnaround, Unlimited Revisions"
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                      form_errors.feature.feature_label 
                        ? 'border-red-500 focus:border-red-500' 
                        : 'border-gray-200 focus:border-blue-500'
                    }`}
                  />
                  <p className="mt-1 text-xs text-gray-500">Customer-facing display name</p>
                  {form_errors.feature.feature_label && (
                    <p className="mt-1 text-sm text-red-600">{form_errors.feature.feature_label}</p>
                  )}
                </div>
                
                {/* Feature Value */}
                <div>
                  <label htmlFor="feature_value" className="block text-sm font-semibold text-gray-700 mb-2">
                    Feature Value
                  </label>
                  <input
                    id="feature_value"
                    type="text"
                    value={new_feature_form.feature_value || ''}
                    onChange={(e) => handle_new_feature_form_change('feature_value', e.target.value || null)}
                    placeholder="e.g., 3 days, 2 revisions, 24/7 support"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Specific detail or quantity (optional)</p>
                </div>
                
                {/* Included Toggle */}
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700">
                    Include in Tier
                  </label>
                  <button
                    type="button"
                    onClick={() => handle_new_feature_form_change('is_included', !new_feature_form.is_included)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      new_feature_form.is_included ? 'bg-yellow-400' : 'bg-gray-300'
                    }`}
                  >
                    <span className="sr-only">Toggle inclusion</span>
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                        new_feature_form.is_included ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    set_show_add_feature_modal(false);
                    set_new_feature_form({
                      group_name: '',
                      feature_key: '',
                      feature_label: '',
                      feature_value: null,
                      is_included: true
                    });
                    set_form_errors(prev => ({ ...prev, feature: {} }));
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                
                <button
                  onClick={handle_add_feature}
                  disabled={create_feature_mutation.isPending}
                  className="px-6 py-2 bg-yellow-400 text-black rounded-lg text-sm font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {create_feature_mutation.isPending ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 inline mr-2" />
                      Add Feature
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_ADMIN_TierEditor;