import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// INTERFACES
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
  category_name?: string;
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

interface Setting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

interface GlobalModifiers {
  rush_fee_percentage: number;
  emergency_booking_fee: number;
  tax_rate: number;
  deposit_percentage: number;
}

interface MaterialCost {
  material_type: string;
  cost_per_unit: number;
  markup_percentage: number;
}

interface PricingRule {
  base_price?: number;
  quantity_discounts?: Record<string, number>;
  rush_multipliers?: Record<string, number>;
  material_costs?: Record<string, number>;
}

// ===========================
// COMPONENT
// ===========================

const UV_ADMIN_PricingRules: React.FC = () => {
  const queryClient = useQueryClient();

  // Global state (CRITICAL: individual selectors)
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);

  // Local state
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [editingModifiers, setEditingModifiers] = useState(false);
  const [editingMaterials, setEditingMaterials] = useState(false);
  const [modifiersForm, setModifiersForm] = useState<GlobalModifiers>({
    rush_fee_percentage: 25,
    emergency_booking_fee: 20,
    tax_rate: 23,
    deposit_percentage: 50,
  });
  const [materialsForm, setMaterialsForm] = useState<MaterialCost[]>([]);
  const [newMaterial, setNewMaterial] = useState<MaterialCost>({
    material_type: '',
    cost_per_unit: 0,
    markup_percentage: 0,
  });

  // API base URL
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // ===========================
  // FETCH SERVICES
  // ===========================

  const {
    data: servicesData,
    isLoading: isLoadingServices,
    error: servicesError,
  } = useQuery({
    queryKey: ['admin-services-pricing'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/services`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return response.data as Service[];
    },
    enabled: !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // ===========================
  // FETCH SETTINGS (GLOBAL MODIFIERS)
  // ===========================

  const {
    data: settingsData,
    isLoading: isLoadingSettings,
    error: settingsError,
  } = useQuery({
    queryKey: ['admin-settings-pricing'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return response.data as Setting[];
    },
    enabled: !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Parse global modifiers from settings
  const globalModifiers = useMemo(() => {
    if (!settingsData) return modifiersForm;

    const settingsMap = settingsData.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    return {
      rush_fee_percentage: parseFloat(settingsMap.rush_fee_percentage || '25'),
      emergency_booking_fee: parseFloat(settingsMap.urgent_fee_pct || '20'),
      tax_rate: parseFloat(settingsMap.tax_rate || '23'),
      deposit_percentage: parseFloat(settingsMap.deposit_pct || '50'),
    };
  }, [settingsData]);

  // Parse material costs from settings
  const materialCosts = useMemo(() => {
    if (!settingsData) return [];

    const materialsSetting = settingsData.find(s => s.key === 'materials_pricing');
    if (!materialsSetting) return [];

    try {
      const parsed = JSON.parse(materialsSetting.value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [settingsData]);

  // Initialize forms when data loads
  useEffect(() => {
    setModifiersForm(globalModifiers);
  }, [globalModifiers]);

  useEffect(() => {
    setMaterialsForm(materialCosts);
  }, [materialCosts]);

  // ===========================
  // UPDATE GLOBAL MODIFIER MUTATION
  // ===========================

  const updateModifierMutation = useMutation({
    mutationFn: async (data: { key: string; value: string }) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/settings/${data.key}`,
        { value: data.value },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings-pricing'] });
      showToast({
        type: 'success',
        message: 'Global modifier updated successfully',
        duration: 3000,
      });
      setEditingModifiers(false);
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update modifier',
        duration: 5000,
      });
    },
  });

  // ===========================
  // UPDATE MATERIALS MUTATION
  // ===========================

  const updateMaterialsMutation = useMutation({
    mutationFn: async (materials: MaterialCost[]) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/settings/materials_pricing`,
        { value: JSON.stringify(materials) },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings-pricing'] });
      showToast({
        type: 'success',
        message: 'Material costs updated successfully',
        duration: 3000,
      });
      setEditingMaterials(false);
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update materials',
        duration: 5000,
      });
    },
  });

  // ===========================
  // HANDLERS
  // ===========================

  const handleSaveModifiers = async () => {
    // Save all modifiers
    try {
      await updateModifierMutation.mutateAsync({
        key: 'rush_fee_percentage',
        value: modifiersForm.rush_fee_percentage.toString(),
      });
      await updateModifierMutation.mutateAsync({
        key: 'urgent_fee_pct',
        value: modifiersForm.emergency_booking_fee.toString(),
      });
      await updateModifierMutation.mutateAsync({
        key: 'tax_rate',
        value: modifiersForm.tax_rate.toString(),
      });
      await updateModifierMutation.mutateAsync({
        key: 'deposit_pct',
        value: modifiersForm.deposit_percentage.toString(),
      });
    } catch (error) {
      console.error('Error saving modifiers:', error);
    }
  };

  const handleSaveMaterials = () => {
    updateMaterialsMutation.mutate(materialsForm);
  };

  const handleAddMaterial = () => {
    if (!newMaterial.material_type || newMaterial.cost_per_unit <= 0) {
      showToast({
        type: 'error',
        message: 'Please enter material type and valid cost',
        duration: 3000,
      });
      return;
    }

    setMaterialsForm([...materialsForm, newMaterial]);
    setNewMaterial({
      material_type: '',
      cost_per_unit: 0,
      markup_percentage: 0,
    });
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterialsForm(materialsForm.filter((_, i) => i !== index));
  };

  const handleMaterialChange = (index: number, field: keyof MaterialCost, value: string | number) => {
    const updated = [...materialsForm];
    updated[index] = { ...updated[index], [field]: value };
    setMaterialsForm(updated);
  };

  const calculateEstimate = (
    basePrice: number,
    quantity: number,
    applyRush: boolean,
    applyEmergency: boolean
  ) => {
    let subtotal = basePrice * quantity;

    // Quantity discount (>50 units = 10% off)
    if (quantity > 50) {
      subtotal *= 0.9;
    }

    // Rush fee
    if (applyRush) {
      subtotal *= (1 + modifiersForm.rush_fee_percentage / 100);
    }

    // Emergency fee
    if (applyEmergency) {
      subtotal *= (1 + modifiersForm.emergency_booking_fee / 100);
    }

    // Tax
    const tax = subtotal * (modifiersForm.tax_rate / 100);
    const total = subtotal + tax;

    // Deposit
    const deposit = total * (modifiersForm.deposit_percentage / 100);

    return {
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      deposit: deposit.toFixed(2),
    };
  };

  // ===========================
  // RENDER
  // ===========================

  const isLoading = isLoadingServices || isLoadingSettings;
  const hasError = servicesError || settingsError;

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Pricing Rules & Materials</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Configure automated pricing logic, material costs, and system-wide modifiers
                </p>
              </div>
              <div className="flex items-center space-x-3">
                {currentUser && (
                  <span className="text-sm text-gray-600">
                    Logged in as <span className="font-semibold">{currentUser.name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading pricing configuration...</span>
            </div>
          )}

          {hasError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
              <p className="font-semibold">Error loading pricing data</p>
              <p className="text-sm mt-1">{(servicesError || settingsError)?.message || 'Unknown error'}</p>
            </div>
          )}

          {!isLoading && !hasError && (
            <div className="space-y-8">
              {/* Global Modifiers Section */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">Global Pricing Modifiers</h2>
                    {!editingModifiers && (
                      <button
                        onClick={() => setEditingModifiers(true)}
                        className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                      >
                        Edit Modifiers
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Rush Fee Percentage */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Rush Fee (%)
                      </label>
                      {editingModifiers ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={modifiersForm.rush_fee_percentage}
                          onChange={(e) =>
                            setModifiersForm({
                              ...modifiersForm,
                              rush_fee_percentage: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      ) : (
                        <div className="text-3xl font-bold text-gray-900">
                          {globalModifiers.rush_fee_percentage}%
                        </div>
                      )}
                      <p className="text-xs text-gray-500">Applied to rush orders</p>
                    </div>

                    {/* Emergency Booking Fee */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Emergency Booking Fee (%)
                      </label>
                      {editingModifiers ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={modifiersForm.emergency_booking_fee}
                          onChange={(e) =>
                            setModifiersForm({
                              ...modifiersForm,
                              emergency_booking_fee: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      ) : (
                        <div className="text-3xl font-bold text-gray-900">
                          {globalModifiers.emergency_booking_fee}%
                        </div>
                      )}
                      <p className="text-xs text-gray-500">Applied to emergency bookings</p>
                    </div>

                    {/* Tax Rate */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Tax Rate / VAT (%)
                      </label>
                      {editingModifiers ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={modifiersForm.tax_rate}
                          onChange={(e) =>
                            setModifiersForm({
                              ...modifiersForm,
                              tax_rate: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      ) : (
                        <div className="text-3xl font-bold text-gray-900">
                          {globalModifiers.tax_rate}%
                        </div>
                      )}
                      <p className="text-xs text-gray-500">Applied to all invoices</p>
                    </div>

                    {/* Deposit Percentage */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Deposit Requirement (%)
                      </label>
                      {editingModifiers ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={modifiersForm.deposit_percentage}
                          onChange={(e) =>
                            setModifiersForm({
                              ...modifiersForm,
                              deposit_percentage: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      ) : (
                        <div className="text-3xl font-bold text-gray-900">
                          {globalModifiers.deposit_percentage}%
                        </div>
                      )}
                      <p className="text-xs text-gray-500">Required upfront payment</p>
                    </div>
                  </div>

                  {editingModifiers && (
                    <div className="mt-6 flex items-center justify-end space-x-3">
                      <button
                        onClick={() => {
                          setModifiersForm(globalModifiers);
                          setEditingModifiers(false);
                        }}
                        className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveModifiers}
                        disabled={updateModifierMutation.isPending}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        {updateModifierMutation.isPending && (
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Material Costs Section */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">Material Costs & Markup</h2>
                    {!editingMaterials && (
                      <button
                        onClick={() => setEditingMaterials(true)}
                        className="px-4 py-2 bg-white text-green-600 rounded-lg font-medium hover:bg-green-50 transition-colors"
                      >
                        Edit Materials
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Material Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cost per Unit (€)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Markup (%)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Final Price (€)
                          </th>
                          {editingMaterials && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {materialsForm.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                              No materials configured. Add a material to get started.
                            </td>
                          </tr>
                        )}
                        
                        {materialsForm.map((material, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingMaterials ? (
                                <input
                                  type="text"
                                  value={material.material_type}
                                  onChange={(e) =>
                                    handleMaterialChange(index, 'material_type', e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              ) : (
                                <span className="text-sm font-medium text-gray-900">
                                  {material.material_type}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingMaterials ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={material.cost_per_unit}
                                  onChange={(e) =>
                                    handleMaterialChange(index, 'cost_per_unit', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              ) : (
                                <span className="text-sm text-gray-900">
                                  €{Number(material.cost_per_unit || 0).toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingMaterials ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="1000"
                                  step="1"
                                  value={material.markup_percentage}
                                  onChange={(e) =>
                                    handleMaterialChange(index, 'markup_percentage', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              ) : (
                                <span className="text-sm text-gray-900">
                                  {Number(material.markup_percentage || 0).toFixed(0)}%
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-semibold text-green-600">
                                €{(Number(material.cost_per_unit || 0) * (1 + Number(material.markup_percentage || 0) / 100)).toFixed(2)}
                              </span>
                            </td>
                            {editingMaterials && (
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleRemoveMaterial(index)}
                                  className="text-red-600 hover:text-red-800 font-medium text-sm"
                                >
                                  Remove
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {editingMaterials && (
                    <div className="mt-6 space-y-4">
                      {/* Add New Material Form */}
                      <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Material</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <input
                            type="text"
                            placeholder="Material Type"
                            value={newMaterial.material_type}
                            onChange={(e) =>
                              setNewMaterial({ ...newMaterial, material_type: e.target.value })
                            }
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="number"
                            placeholder="Cost per Unit (€)"
                            min="0"
                            step="0.01"
                            value={newMaterial.cost_per_unit || ''}
                            onChange={(e) =>
                              setNewMaterial({
                                ...newMaterial,
                                cost_per_unit: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="number"
                            placeholder="Markup (%)"
                            min="0"
                            max="1000"
                            step="1"
                            value={newMaterial.markup_percentage || ''}
                            onChange={(e) =>
                              setNewMaterial({
                                ...newMaterial,
                                markup_percentage: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={handleAddMaterial}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                          >
                            Add Material
                          </button>
                        </div>
                      </div>

                      {/* Save/Cancel Buttons */}
                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => {
                            setMaterialsForm(materialCosts);
                            setEditingMaterials(false);
                            setNewMaterial({
                              material_type: '',
                              cost_per_unit: 0,
                              markup_percentage: 0,
                            });
                          }}
                          className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveMaterials}
                          disabled={updateMaterialsMutation.isPending}
                          className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          {updateMaterialsMutation.isPending && (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          )}
                          Save Materials
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Rules Explanation */}
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">Automated Pricing Rules</h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <p>
                    <span className="font-semibold">Quantity Discounts:</span> Orders with quantity &gt; 50 units automatically receive 10% discount
                  </p>
                  <p>
                    <span className="font-semibold">Rush Fees:</span> Standard rush orders add {globalModifiers.rush_fee_percentage}% to base price
                  </p>
                  <p>
                    <span className="font-semibold">Emergency Bookings:</span> Full-day emergency bookings add {globalModifiers.emergency_booking_fee}% to total
                  </p>
                  <p>
                    <span className="font-semibold">Tax Calculation:</span> {globalModifiers.tax_rate}% VAT applied to all invoices (subtotal × tax rate)
                  </p>
                  <p>
                    <span className="font-semibold">Deposit:</span> {globalModifiers.deposit_percentage}% deposit required upfront, balance due before delivery
                  </p>
                </div>
              </div>

              {/* Price Estimation Calculator */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                  <h2 className="text-xl font-semibold text-white">Price Estimation Calculator</h2>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Base Price (€)
                      </label>
                      <input
                        type="number"
                        id="calc-base-price"
                        min="0"
                        step="0.01"
                        defaultValue="100"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Quantity
                      </label>
                      <input
                        type="number"
                        id="calc-quantity"
                        min="1"
                        step="1"
                        defaultValue="10"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" id="calc-rush" className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                      <span className="text-sm font-medium text-gray-700">Apply Rush Fee (+{globalModifiers.rush_fee_percentage}%)</span>
                    </label>

                    <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" id="calc-emergency" className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                      <span className="text-sm font-medium text-gray-700">Apply Emergency Fee (+{globalModifiers.emergency_booking_fee}%)</span>
                    </label>
                  </div>

                  <button
                    onClick={() => {
                      const basePrice = parseFloat((document.getElementById('calc-base-price') as HTMLInputElement)?.value || '0');
                      const quantity = parseInt((document.getElementById('calc-quantity') as HTMLInputElement)?.value || '0');
                      const applyRush = (document.getElementById('calc-rush') as HTMLInputElement)?.checked || false;
                      const applyEmergency = (document.getElementById('calc-emergency') as HTMLInputElement)?.checked || false;

                      const estimate = calculateEstimate(basePrice, quantity, applyRush, applyEmergency);

                      const resultDiv = document.getElementById('calc-result');
                      if (resultDiv) {
                        resultDiv.innerHTML = `
                          <div class="space-y-3">
                            <div class="flex justify-between">
                              <span class="text-gray-600">Subtotal:</span>
                              <span class="font-semibold text-gray-900">€${estimate.subtotal}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="text-gray-600">Tax (${modifiersForm.tax_rate}%):</span>
                              <span class="font-semibold text-gray-900">€${estimate.tax}</span>
                            </div>
                            <div class="flex justify-between text-lg border-t pt-3">
                              <span class="font-bold text-gray-900">Total:</span>
                              <span class="font-bold text-green-600">€${estimate.total}</span>
                            </div>
                            <div class="flex justify-between text-sm bg-blue-50 p-3 rounded-lg">
                              <span class="text-blue-800">Deposit (${modifiersForm.deposit_percentage}%):</span>
                              <span class="font-semibold text-blue-900">€${estimate.deposit}</span>
                            </div>
                          </div>
                        `;
                        resultDiv.classList.remove('hidden');
                      }
                    }}
                    className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                  >
                    Calculate Estimate
                  </button>

                  <div id="calc-result" className="hidden mt-6 bg-gray-50 rounded-lg p-6 border border-gray-200"></div>
                </div>
              </div>

              {editingMaterials && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-end space-x-3">
                      <button
                        onClick={() => {
                          setMaterialsForm(materialCosts);
                          setEditingMaterials(false);
                          setNewMaterial({
                            material_type: '',
                            cost_per_unit: 0,
                            markup_percentage: 0,
                          });
                        }}
                        className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                      >
                        Cancel All Changes
                      </button>
                      <button
                        onClick={handleSaveMaterials}
                        disabled={updateMaterialsMutation.isPending}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        {updateMaterialsMutation.isPending && (
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        Save All Material Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Service-Specific Pricing Rules (Future) */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="bg-gradient-to-r from-gray-700 to-gray-900 px-6 py-4">
                  <h2 className="text-xl font-semibold text-white">Service-Specific Rules</h2>
                </div>

                <div className="p-6">
                  <p className="text-gray-600 mb-4">
                    Select a service to configure custom pricing rules and modifiers (coming soon)
                  </p>
                  
                  {servicesData && servicesData.length > 0 && (
                    <select
                      value={selectedServiceId || ''}
                      onChange={(e) => setSelectedServiceId(e.target.value || null)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-gray-500 focus:ring-4 focus:ring-gray-100"
                    >
                      <option value="">Select a service...</option>
                      {servicesData.map((service: Service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} ({service.category_name || 'Uncategorized'})
                        </option>
                      ))}
                    </select>
                  )}

                  {selectedServiceId && (
                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        Service-specific pricing rules configuration will be available in a future update.
                        Currently, all services use the global modifiers and material costs configured above.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Guidelines */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Configuration Guidelines</h3>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p>Material costs should include supplier costs plus overhead allocation</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p>Markup percentages should account for labor, equipment wear, and profit margin</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p>Rush fees compensate for schedule disruption and expedited processing</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p>Emergency booking fees reflect capacity constraints and priority handling</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p>Tax rates must comply with local VAT/sales tax regulations</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-yellow-800">
                      <strong>Manual Override:</strong> Admins can manually adjust final prices during quote finalization regardless of automated calculations
                    </p>
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

export default UV_ADMIN_PricingRules;