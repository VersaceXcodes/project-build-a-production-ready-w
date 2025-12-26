import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

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

interface TierWithStats {
  tier: TierPackage;
  features_count: number;
  orders_count: number;
  feature_groups: {
    group_name: string;
    features: TierFeature[];
  }[];
}

interface ComparisonMatrix {
  feature_groups: {
    group_name: string;
    features: {
      feature_label: string;
      basic: string;
      standard: string;
      gold: string;
      enterprise: string;
    }[];
  }[];
}

interface NewTierForm {
  name: string;
  slug: string;
  description: string;
  is_open: boolean;
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchTiersWithFeatures = async (authToken: string): Promise<TierWithStats[]> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  const response = await axios.get(`${API_BASE_URL}/api/admin/tiers`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  // Transform response to include feature counts and groupings
  return response.data.map((tierData: { tier: TierPackage; features: TierFeature[] }) => {
    const features = tierData.features || [];
    
    // Group features by group_name
    const feature_groups = features.reduce((groups, feature) => {
      const existing_group = groups.find(g => g.group_name === feature.group_name);
      if (existing_group) {
        existing_group.features.push(feature);
      } else {
        groups.push({
          group_name: feature.group_name,
          features: [feature],
        });
      }
      return groups;
    }, [] as { group_name: string; features: TierFeature[] }[]);

    return {
      tier: tierData.tier,
      features_count: features.length,
      orders_count: 0, // Would need separate API call or joined data
      feature_groups,
    };
  });
};

const createTier = async (authToken: string, tierData: { name: string; slug: string; description: string | null; sort_order: number }) => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  const response = await axios.post(
    `${API_BASE_URL}/api/admin/tiers`,
    tierData,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

const updateTier = async (
  authToken: string,
  tierId: string,
  updates: { sort_order?: number; is_active?: boolean; name?: string; description?: string }
) => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  const response = await axios.patch(
    `${API_BASE_URL}/api/admin/tiers/${tierId}`,
    updates,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

// ===========================
// HELPER FUNCTIONS
// ===========================

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

const buildComparisonMatrix = (tiersWithStats: TierWithStats[]): ComparisonMatrix => {
  // Get all unique group names
  const all_groups = new Set<string>();
  tiersWithStats.forEach(tierData => {
    tierData.feature_groups.forEach(group => {
      all_groups.add(group.group_name);
    });
  });

  // Build matrix by group
  const feature_groups = Array.from(all_groups).map(group_name => {
    // Get all unique features in this group across all tiers
    const all_features_in_group = new Set<string>();
    tiersWithStats.forEach(tierData => {
      const group = tierData.feature_groups.find(g => g.group_name === group_name);
      if (group) {
        group.features.forEach(f => all_features_in_group.add(f.feature_label));
      }
    });

    // Build feature rows
    const features = Array.from(all_features_in_group).map(feature_label => {
      const row: any = { feature_label };
      
      tiersWithStats.forEach(tierData => {
        const group = tierData.feature_groups.find(g => g.group_name === group_name);
        const feature = group?.features.find(f => f.feature_label === feature_label);
        
        const tier_slug = tierData.tier.slug;
        if (feature) {
          row[tier_slug] = feature.is_included 
            ? (feature.feature_value || '✓') 
            : '✗';
        } else {
          row[tier_slug] = '—';
        }
      });

      return row;
    });

    return { group_name, features };
  });

  return { feature_groups };
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_ADMIN_TiersManager: React.FC = () => {
  // Global state - CRITICAL: Individual selectors to avoid infinite loops
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);
  
  // Local state
  const [is_reordering, setIsReordering] = useState(false);
  const [selected_tier_id, setSelectedTierId] = useState<string | null>(null);
  const [error_message, setErrorMessage] = useState<string | null>(null);
  const [new_tier_form, setNewTierForm] = useState<NewTierForm>({
    name: '',
    slug: '',
    description: '',
    is_open: false,
  });
  const [show_comparison_matrix, setShowComparisonMatrix] = useState(false);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Verify admin role
  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      navigate('/admin');
      showToast({
        type: 'error',
        message: 'Admin access required',
        duration: 5000,
      });
    }
  }, [currentUser, navigate, showToast]);

  // ===========================
  // DATA FETCHING
  // ===========================

  const {
    data: tier_packages = [],
    isLoading: is_loading,
    error: fetch_error,
  } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: () => fetchTiersWithFeatures(authToken!),
    enabled: !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // ===========================
  // MUTATIONS
  // ===========================

  const createTierMutation = useMutation({
    mutationFn: (tierData: { name: string; slug: string; description: string | null; sort_order: number }) =>
      createTier(authToken!, tierData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tiers'] });
      showToast({
        type: 'success',
        message: 'Tier created successfully',
        duration: 5000,
      });
      setNewTierForm({ name: '', slug: '', description: '', is_open: false });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to create tier';
      showToast({
        type: 'error',
        message,
        duration: 5000,
      });
      setErrorMessage(message);
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: ({ tierId, updates }: { tierId: string; updates: any }) =>
      updateTier(authToken!, tierId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tiers'] });
      showToast({
        type: 'success',
        message: 'Tier updated successfully',
        duration: 5000,
      });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to update tier';
      showToast({
        type: 'error',
        message,
        duration: 5000,
      });
      setErrorMessage(message);
    },
  });

  // ===========================
  // HANDLERS
  // ===========================

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const source_index = result.source.index;
    const destination_index = result.destination.index;

    if (source_index === destination_index) return;

    // Reorder tiers array
    const reordered_tiers = Array.from(tier_packages);
    const [moved_tier] = reordered_tiers.splice(source_index, 1);
    reordered_tiers.splice(destination_index, 0, moved_tier);

    // Update sort_order for all affected tiers
    setIsReordering(true);
    
    try {
      const update_promises = reordered_tiers.map((tierData, index) => {
        if (tierData.tier.sort_order !== index) {
          return updateTier(authToken!, tierData.tier.id, { sort_order: index });
        }
        return Promise.resolve();
      });

      await Promise.all(update_promises);
      
      queryClient.invalidateQueries({ queryKey: ['admin-tiers'] });
      showToast({
        type: 'success',
        message: 'Tier order updated successfully',
        duration: 5000,
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        message: 'Failed to update tier order',
        duration: 5000,
      });
    } finally {
      setIsReordering(false);
    }
  };

  const handleToggleActive = async (tierId: string, currentActiveState: boolean) => {
    setSelectedTierId(tierId);
    await updateTierMutation.mutateAsync({
      tierId,
      updates: { is_active: !currentActiveState },
    });
    setSelectedTierId(null);
  };

  const handleCreateTier = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!new_tier_form.name.trim()) {
      setErrorMessage('Tier name is required');
      return;
    }

    const tierData = {
      name: new_tier_form.name.trim(),
      slug: new_tier_form.slug || generateSlug(new_tier_form.name),
      description: new_tier_form.description.trim() || null,
      sort_order: tier_packages.length,
    };

    await createTierMutation.mutateAsync(tierData);
  };

  const handleNewTierNameChange = (name: string) => {
    setNewTierForm(prev => ({
      ...prev,
      name,
      slug: generateSlug(name), // Auto-generate slug
    }));
    setErrorMessage(null);
  };

  const openCreateTierModal = () => {
    setNewTierForm({
      name: '',
      slug: '',
      description: '',
      is_open: true,
    });
    setErrorMessage(null);
  };

  const closeCreateTierModal = () => {
    setNewTierForm({
      name: '',
      slug: '',
      description: '',
      is_open: false,
    });
    setErrorMessage(null);
  };

  // ===========================
  // COMPUTED VALUES
  // ===========================

  const comparison_matrix = React.useMemo(() => {
    if (!tier_packages || tier_packages.length === 0) {
      return { feature_groups: [] };
    }

    // Extract all unique group names
    const all_groups = new Set<string>();
    tier_packages.forEach(tierData => {
      tierData.feature_groups.forEach(group => {
        all_groups.add(group.group_name);
      });
    });

    // Build matrix
    const feature_groups = Array.from(all_groups).map(group_name => {
      // Get all unique feature_labels in this group
      const all_feature_labels = new Set<string>();
      tier_packages.forEach(tierData => {
        const group = tierData.feature_groups.find(g => g.group_name === group_name);
        if (group) {
          group.features.forEach(f => all_feature_labels.add(f.feature_label));
        }
      });

      // Build rows for this group
      const features = Array.from(all_feature_labels).map(feature_label => {
        const row: any = { feature_label };

        tier_packages.forEach(tierData => {
          const group = tierData.feature_groups.find(g => g.group_name === group_name);
          const feature = group?.features.find(f => f.feature_label === feature_label);
          
          const tier_slug = tierData.tier.slug;
          if (feature) {
            row[tier_slug] = feature.is_included 
              ? (feature.feature_value || '✓') 
              : '✗';
          } else {
            row[tier_slug] = '—';
          }
        });

        return row;
      });

      return { group_name, features };
    });

    return { feature_groups };
  }, [tier_packages]);

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Service Tiers Management</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Configure tier packages, features, and comparison matrix for public pricing page
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowComparisonMatrix(true)}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2m0 10V7" />
                  </svg>
                  Preview Matrix
                </button>
                <button
                  onClick={openCreateTierModal}
                  className="inline-flex items-center justify-center px-6 py-2 bg-yellow-400 text-black rounded-lg text-sm font-semibold hover:bg-yellow-500 transition-all shadow-sm"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Tier
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading State */}
          {is_loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-600 font-medium">Loading tiers...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {fetch_error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Failed to load tiers</h3>
                  <p className="mt-1 text-sm text-red-700">
                    {fetch_error instanceof Error ? fetch_error.message : 'An error occurred'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tiers Grid */}
          {!is_loading && !fetch_error && (
            <>
              {tier_packages.length === 0 ? (
                /* Empty State */
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No tiers configured</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by creating your first tier package.</p>
                  <div className="mt-6">
                    <button
                      onClick={openCreateTierModal}
                      className="inline-flex items-center px-6 py-3 bg-yellow-400 text-black rounded-lg text-sm font-semibold hover:bg-yellow-500 transition-all"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create First Tier
                    </button>
                  </div>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="tiers-list">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                      >
                        {tier_packages.map((tierData, index) => (
                          <Draggable
                            key={tierData.tier.id}
                            draggableId={tierData.tier.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
                                  snapshot.isDragging
                                    ? 'border-yellow-400 shadow-2xl scale-105'
                                    : tierData.tier.is_active
                                    ? 'border-gray-200 shadow-lg hover:shadow-xl'
                                    : 'border-gray-200 shadow-sm opacity-60'
                                }`}
                              >
                                {/* Drag Handle */}
                                <div
                                  {...provided.dragHandleProps}
                                  className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200 cursor-grab active:cursor-grabbing"
                                >
                                  <div className="flex items-center space-x-2">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                    </svg>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Tier {index + 1}
                                    </span>
                                  </div>
                                  
                                  {/* Active Toggle */}
                                  <button
                                    onClick={() => handleToggleActive(tierData.tier.id, tierData.tier.is_active)}
                                    disabled={selected_tier_id === tierData.tier.id}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 ${
                                      tierData.tier.is_active ? 'bg-green-600' : 'bg-gray-300'
                                    } ${selected_tier_id === tierData.tier.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    aria-label={`Toggle ${tierData.tier.name} active state`}
                                  >
                                    <span
                                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        tierData.tier.is_active ? 'translate-x-6' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </div>

                                {/* Card Content */}
                                <div className="p-6">
                                  {/* Tier Name and Slug */}
                                  <div className="mb-4">
                                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                                      {tierData.tier.name}
                                    </h3>
                                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                                      {tierData.tier.slug}
                                    </span>
                                  </div>

                                  {/* Description */}
                                  {tierData.tier.description && (
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                      {tierData.tier.description}
                                    </p>
                                  )}

                                  {/* Statistics */}
                                  <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="bg-blue-50 rounded-lg p-3">
                                      <div className="text-2xl font-bold text-blue-700">
                                        {tierData.features_count}
                                      </div>
                                      <div className="text-xs text-blue-600 mt-1">Features</div>
                                    </div>
                                    <div className="bg-purple-50 rounded-lg p-3">
                                      <div className="text-2xl font-bold text-purple-700">
                                        {tierData.orders_count}
                                      </div>
                                      <div className="text-xs text-purple-600 mt-1">Orders</div>
                                    </div>
                                  </div>

                                  {/* Feature Groups Preview */}
                                  {tierData.feature_groups.length > 0 && (
                                    <div className="mb-4">
                                      <div className="text-xs font-semibold text-gray-700 mb-2">Feature Groups:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {tierData.feature_groups.slice(0, 3).map(group => (
                                          <span
                                            key={group.group_name}
                                            className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                                          >
                                            {group.group_name}
                                          </span>
                                        ))}
                                        {tierData.feature_groups.length > 3 && (
                                          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                            +{tierData.feature_groups.length - 3} more
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Actions */}
                                  <Link
                                    to={`/admin/tiers/${tierData.tier.id}/edit`}
                                    className="block w-full text-center px-4 py-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
                                  >
                                    Edit Tier Details
                                  </Link>
                                </div>

                                {/* Status Badge */}
                                {!tierData.tier.is_active && (
                                  <div className="absolute top-16 right-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      Inactive
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}

              {/* Reordering Indicator */}
              {is_reordering && (
                <div className="fixed bottom-8 right-8 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 z-50">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="font-medium">Updating tier order...</span>
                </div>
              )}

              {/* Comparison Matrix Preview Section */}
              {tier_packages.length > 0 && comparison_matrix.feature_groups.length > 0 && (
                <div className="mt-12">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                      <h2 className="text-xl font-bold text-gray-900">Tier Comparison Preview</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        This table appears on the public pricing page
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Feature
                            </th>
                            {tier_packages.map(tierData => (
                              <th
                                key={tierData.tier.id}
                                className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider"
                              >
                                {tierData.tier.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {comparison_matrix.feature_groups.map((group, groupIndex) => (
                            <React.Fragment key={group.group_name}>
                              {/* Group Header Row */}
                              <tr className="bg-gray-100">
                                <td
                                  colSpan={tier_packages.length + 1}
                                  className="px-6 py-3 text-sm font-bold text-gray-900"
                                >
                                  {group.group_name}
                                </td>
                              </tr>
                              
                              {/* Feature Rows */}
                              {group.features.map((feature, featureIndex) => (
                                <tr key={`${groupIndex}-${featureIndex}`} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 text-sm text-gray-900">
                                    {feature.feature_label}
                                  </td>
                                  {tier_packages.map(tierData => {
                                    const value = feature[tierData.tier.slug as keyof typeof feature] as string;
                                    return (
                                      <td
                                        key={tierData.tier.id}
                                        className="px-6 py-4 text-center text-sm"
                                      >
                                        {value === '✓' ? (
                                          <span className="text-green-600 text-lg">✓</span>
                                        ) : value === '✗' ? (
                                          <span className="text-red-500 text-lg">✗</span>
                                        ) : (
                                          <span className="text-gray-700">{value}</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* Create Tier Modal */}
        {new_tier_form.is_open && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Overlay */}
              <div
                className="fixed inset-0 bg-black bg-opacity-60 transition-opacity"
                onClick={closeCreateTierModal}
              />

              {/* Modal Panel */}
              <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-6 pt-6 pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-2xl font-bold text-gray-900">Create New Tier</h3>
                    <button
                      onClick={closeCreateTierModal}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={handleCreateTier} className="space-y-4">
                    {error_message && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {error_message}
                      </div>
                    )}

                    {/* Tier Name */}
                    <div>
                      <label htmlFor="tier-name" className="block text-sm font-semibold text-gray-700 mb-2">
                        Tier Name <span className="text-yellow-500">*</span>
                      </label>
                      <input
                        id="tier-name"
                        type="text"
                        required
                        value={new_tier_form.name}
                        onChange={(e) => {
                          setErrorMessage(null);
                          handleNewTierNameChange(e.target.value);
                        }}
                        placeholder="e.g., Premium, Enterprise"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-base"
                      />
                    </div>

                    {/* Tier Slug (auto-generated) */}
                    <div>
                      <label htmlFor="tier-slug" className="block text-sm font-semibold text-gray-700 mb-2">
                        Slug (URL-friendly identifier)
                      </label>
                      <input
                        id="tier-slug"
                        type="text"
                        value={new_tier_form.slug}
                        onChange={(e) => {
                          setErrorMessage(null);
                          setNewTierForm(prev => ({ ...prev, slug: e.target.value }));
                        }}
                        placeholder="auto-generated"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-base bg-gray-50"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Auto-generated from name. Must be lowercase with hyphens.
                      </p>
                    </div>

                    {/* Description */}
                    <div>
                      <label htmlFor="tier-description" className="block text-sm font-semibold text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        id="tier-description"
                        rows={3}
                        value={new_tier_form.description}
                        onChange={(e) => {
                          setErrorMessage(null);
                          setNewTierForm(prev => ({ ...prev, description: e.target.value }));
                        }}
                        placeholder="Brief description of this tier's value proposition"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-base resize-vertical"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={closeCreateTierModal}
                        disabled={createTierMutation.isPending}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createTierMutation.isPending || !new_tier_form.name.trim()}
                        className="px-6 py-2 bg-yellow-400 text-black rounded-lg text-sm font-semibold hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                      >
                        {createTierMutation.isPending ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating...
                          </>
                        ) : (
                          'Create Tier'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Matrix Full Modal */}
        {show_comparison_matrix && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Overlay */}
              <div
                className="fixed inset-0 bg-black bg-opacity-60 transition-opacity"
                onClick={() => setShowComparisonMatrix(false)}
              />

              {/* Modal Panel */}
              <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
                <div className="bg-white">
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-gray-900">Tier Comparison Matrix</h3>
                    <button
                      onClick={() => setShowComparisonMatrix(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Feature
                            </th>
                            {tier_packages.map(tierData => (
                              <th
                                key={tierData.tier.id}
                                className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider"
                              >
                                {tierData.tier.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {comparison_matrix.feature_groups.map((group, groupIndex) => (
                            <React.Fragment key={group.group_name}>
                              {/* Group Header */}
                              <tr className="bg-gray-100">
                                <td
                                  colSpan={tier_packages.length + 1}
                                  className="px-6 py-3 text-sm font-bold text-gray-900"
                                >
                                  {group.group_name}
                                </td>
                              </tr>
                              
                              {/* Features */}
                              {group.features.map((feature, featureIndex) => (
                                <tr key={`${groupIndex}-${featureIndex}`} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                    {feature.feature_label}
                                  </td>
                                  {tier_packages.map(tierData => {
                                    const value = feature[tierData.tier.slug as keyof typeof feature] as string;
                                    return (
                                      <td
                                        key={tierData.tier.id}
                                        className="px-6 py-4 text-center text-sm"
                                      >
                                        {value === '✓' ? (
                                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
                                            <span className="text-green-600 text-lg font-bold">✓</span>
                                          </span>
                                        ) : value === '✗' ? (
                                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100">
                                            <span className="text-red-500 text-lg font-bold">✗</span>
                                          </span>
                                        ) : (
                                          <span className="text-gray-700 font-medium">{value}</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      To edit individual features, go to the specific tier editor
                    </p>
                    <button
                      onClick={() => setShowComparisonMatrix(false)}
                      className="px-6 py-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
                    >
                      Close Preview
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_ADMIN_TiersManager;