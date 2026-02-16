import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface PricingSettings {
  id: string;
  page_title: string;
  page_subtitle: string;
  top_note: string;
  bottom_note: string;
  is_enabled: boolean;
  updated_at: string;
}

interface PricingTierItem {
  id: string;
  section_id: string;
  icon_type: 'dot' | 'check';
  text: string;
  display_order: number;
}

interface PricingTierSection {
  id: string;
  tier_id: string;
  title: string;
  display_order: number;
  items: PricingTierItem[];
}

interface PricingTier {
  id: string;
  name: string;
  subtitle: string;
  price_label: string;
  is_featured: boolean;
  badge_text: string;
  display_order: number;
  is_active: boolean;
  sections: PricingTierSection[];
}

interface ComparisonRow {
  id: string;
  feature_name: string;
  basic_value: string;
  standard_value: string;
  gold_value: string;
  enterprise_value: string;
  display_order: number;
}

interface PricingData {
  settings: PricingSettings;
  tiers: PricingTier[];
  comparison_rows: ComparisonRow[];
}

// ===========================
// API FUNCTIONS
// ===========================

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api`;

const fetchPricingData = async (token: string): Promise<PricingData> => {
  const response = await axios.get(`${API_BASE_URL}/admin/pricing`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const updateSettings = async (settings: Partial<PricingSettings>, token: string): Promise<PricingSettings> => {
  const response = await axios.put(`${API_BASE_URL}/admin/pricing/settings`, settings, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const createTier = async (tier: Partial<PricingTier>, token: string): Promise<PricingTier> => {
  const response = await axios.post(`${API_BASE_URL}/admin/pricing/tiers`, tier, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const updateTier = async (tierId: string, tier: Partial<PricingTier>, token: string): Promise<PricingTier> => {
  const response = await axios.patch(`${API_BASE_URL}/admin/pricing/tiers/${tierId}`, tier, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const deleteTier = async (tierId: string, token: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/admin/pricing/tiers/${tierId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

const createSection = async (section: Partial<PricingTierSection>, token: string): Promise<PricingTierSection> => {
  const response = await axios.post(`${API_BASE_URL}/admin/pricing/sections`, section, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const updateSection = async (sectionId: string, section: Partial<PricingTierSection>, token: string): Promise<PricingTierSection> => {
  const response = await axios.patch(`${API_BASE_URL}/admin/pricing/sections/${sectionId}`, section, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const deleteSection = async (sectionId: string, token: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/admin/pricing/sections/${sectionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

const createItem = async (item: Partial<PricingTierItem>, token: string): Promise<PricingTierItem> => {
  const response = await axios.post(`${API_BASE_URL}/admin/pricing/items`, item, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const updateItem = async (itemId: string, item: Partial<PricingTierItem>, token: string): Promise<PricingTierItem> => {
  const response = await axios.patch(`${API_BASE_URL}/admin/pricing/items/${itemId}`, item, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const deleteItem = async (itemId: string, token: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/admin/pricing/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

const createComparisonRow = async (row: Partial<ComparisonRow>, token: string): Promise<ComparisonRow> => {
  const response = await axios.post(`${API_BASE_URL}/admin/pricing/comparison-rows`, row, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const updateComparisonRow = async (rowId: string, row: Partial<ComparisonRow>, token: string): Promise<ComparisonRow> => {
  const response = await axios.patch(`${API_BASE_URL}/admin/pricing/comparison-rows/${rowId}`, row, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const deleteComparisonRow = async (rowId: string, token: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/admin/pricing/comparison-rows/${rowId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_ADMIN_PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Global state - CRITICAL: Individual selectors
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const showToast = useAppStore(state => state.show_toast);

  // Local state
  const [activeTab, setActiveTab] = useState<'settings' | 'tiers' | 'comparison'>('settings');
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingSettings, setEditingSettings] = useState<Partial<PricingSettings>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Modal states
  const [showAddTierModal, setShowAddTierModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState<string | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState<string | null>(null);
  const [showAddComparisonModal, setShowAddComparisonModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);

  // Form states for modals
  const [newTier, setNewTier] = useState({ name: '', subtitle: '', price_label: '', badge_text: '', is_featured: false });
  const [newSection, setNewSection] = useState({ title: '' });
  const [newItem, setNewItem] = useState({ text: '', icon_type: 'check' as 'dot' | 'check' });
  const [newComparison, setNewComparison] = useState({ feature_name: '', basic_value: '', standard_value: '', gold_value: '', enterprise_value: '' });

  // Auth check
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      navigate('/login?returnTo=/admin/pricing-page');
    }
  }, [currentUser, navigate]);

  // Fetch pricing data
  const { data: pricingData, isLoading, error, refetch } = useQuery<PricingData>({
    queryKey: ['admin-pricing'],
    queryFn: () => fetchPricingData(authToken || ''),
    enabled: !!authToken,
    staleTime: 30000,
  });

  // Initialize editing settings when data loads
  useEffect(() => {
    if (pricingData?.settings) {
      setEditingSettings(pricingData.settings);
    }
  }, [pricingData?.settings]);

  // Toggle tier expansion
  const toggleTierExpand = (tierId: string) => {
    setExpandedTiers(prev => {
      const next = new Set(prev);
      if (next.has(tierId)) {
        next.delete(tierId);
      } else {
        next.add(tierId);
      }
      return next;
    });
  };

  // Toggle section expansion
  const toggleSectionExpand = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Save settings
  const handleSaveSettings = async () => {
    if (!authToken) return;
    setIsSaving(true);
    try {
      await updateSettings(editingSettings, authToken);
      showToast('Settings saved successfully', 'success');
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle enabled status
  const handleToggleEnabled = async () => {
    if (!authToken || !pricingData?.settings) return;
    setIsSaving(true);
    try {
      await updateSettings({ is_enabled: !pricingData.settings.is_enabled }, authToken);
      showToast(`Pricing page ${pricingData.settings.is_enabled ? 'disabled' : 'enabled'}`, 'success');
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to toggle status', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Add new tier
  const handleAddTier = async () => {
    if (!authToken || !newTier.name) return;
    setIsSaving(true);
    try {
      const maxOrder = Math.max(...(pricingData?.tiers.map(t => t.display_order) || [0]), 0);
      await createTier({ ...newTier, display_order: maxOrder + 1, is_active: true }, authToken);
      showToast('Tier created successfully', 'success');
      setShowAddTierModal(false);
      setNewTier({ name: '', subtitle: '', price_label: '', badge_text: '', is_featured: false });
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create tier', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Update tier
  const handleUpdateTier = async (tierId: string, updates: Partial<PricingTier>) => {
    if (!authToken) return;
    try {
      await updateTier(tierId, updates, authToken);
      showToast('Tier updated', 'success');
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update tier', 'error');
    }
  };

  // Delete tier
  const handleDeleteTier = async (tierId: string) => {
    if (!authToken) return;
    setIsSaving(true);
    try {
      await deleteTier(tierId, authToken);
      showToast('Tier deleted', 'success');
      setShowDeleteConfirm(null);
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete tier', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Add section
  const handleAddSection = async (tierId: string) => {
    if (!authToken || !newSection.title) return;
    setIsSaving(true);
    try {
      const tier = pricingData?.tiers.find(t => t.id === tierId);
      const maxOrder = Math.max(...(tier?.sections.map(s => s.display_order) || [0]), 0);
      await createSection({ tier_id: tierId, title: newSection.title, display_order: maxOrder + 1 }, authToken);
      showToast('Section created', 'success');
      setShowAddSectionModal(null);
      setNewSection({ title: '' });
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create section', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Update section
  const handleUpdateSection = async (sectionId: string, updates: Partial<PricingTierSection>) => {
    if (!authToken) return;
    try {
      await updateSection(sectionId, updates, authToken);
      showToast('Section updated', 'success');
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update section', 'error');
    }
  };

  // Delete section
  const handleDeleteSection = async (sectionId: string) => {
    if (!authToken) return;
    setIsSaving(true);
    try {
      await deleteSection(sectionId, authToken);
      showToast('Section deleted', 'success');
      setShowDeleteConfirm(null);
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete section', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Add item
  const handleAddItem = async (sectionId: string) => {
    if (!authToken || !newItem.text) return;
    setIsSaving(true);
    try {
      // Find the section to get max order
      let maxOrder = 0;
      pricingData?.tiers.forEach(tier => {
        tier.sections.forEach(section => {
          if (section.id === sectionId) {
            maxOrder = Math.max(...(section.items.map(i => i.display_order) || [0]), 0);
          }
        });
      });
      await createItem({ section_id: sectionId, text: newItem.text, icon_type: newItem.icon_type, display_order: maxOrder + 1 }, authToken);
      showToast('Item created', 'success');
      setShowAddItemModal(null);
      setNewItem({ text: '', icon_type: 'check' });
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create item', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Update item
  const handleUpdateItem = async (itemId: string, updates: Partial<PricingTierItem>) => {
    if (!authToken) return;
    try {
      await updateItem(itemId, updates, authToken);
      showToast('Item updated', 'success');
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update item', 'error');
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    if (!authToken) return;
    setIsSaving(true);
    try {
      await deleteItem(itemId, authToken);
      showToast('Item deleted', 'success');
      setShowDeleteConfirm(null);
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete item', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Add comparison row
  const handleAddComparisonRow = async () => {
    if (!authToken || !newComparison.feature_name) return;
    setIsSaving(true);
    try {
      const maxOrder = Math.max(...(pricingData?.comparison_rows.map(r => r.display_order) || [0]), 0);
      await createComparisonRow({ ...newComparison, display_order: maxOrder + 1 }, authToken);
      showToast('Comparison row created', 'success');
      setShowAddComparisonModal(false);
      setNewComparison({ feature_name: '', basic_value: '', standard_value: '', gold_value: '', enterprise_value: '' });
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create comparison row', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Update comparison row
  const handleUpdateComparisonRow = async (rowId: string, updates: Partial<ComparisonRow>) => {
    if (!authToken) return;
    try {
      await updateComparisonRow(rowId, updates, authToken);
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update row', 'error');
    }
  };

  // Delete comparison row
  const handleDeleteComparisonRow = async (rowId: string) => {
    if (!authToken) return;
    setIsSaving(true);
    try {
      await deleteComparisonRow(rowId, authToken);
      showToast('Comparison row deleted', 'success');
      setShowDeleteConfirm(null);
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete row', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ===========================
  // RENDER
  // ===========================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700">Failed to load pricing data. Please try again.</p>
            <button onClick={() => refetch()} className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pricing Page Manager</h1>
              <p className="text-gray-600 mt-1">Configure the public pricing page content</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-gray-200">
                <span className="text-sm font-medium text-gray-700">Public Pricing Page</span>
                <button
                  onClick={handleToggleEnabled}
                  disabled={isSaving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    pricingData?.settings?.is_enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      pricingData?.settings?.is_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-sm font-medium ${pricingData?.settings?.is_enabled ? 'text-green-600' : 'text-gray-500'}`}>
                  {pricingData?.settings?.is_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              
              {/* Preview Button */}
              <a
                href="/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </a>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'settings', label: 'Page Settings' },
                { id: 'tiers', label: 'Pricing Tiers' },
                { id: 'comparison', label: 'Comparison Matrix' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-yellow-500 text-yellow-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Settings Tab */}
            {activeTab === 'settings' && pricingData?.settings && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Page Title</label>
                    <input
                      type="text"
                      value={editingSettings.page_title || ''}
                      onChange={(e) => setEditingSettings({ ...editingSettings, page_title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Our Service Tiers"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Page Subtitle</label>
                    <input
                      type="text"
                      value={editingSettings.page_subtitle || ''}
                      onChange={(e) => setEditingSettings({ ...editingSettings, page_subtitle: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Choose the tier that best fits your project needs"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Top Note (displayed above tiers)</label>
                  <textarea
                    value={editingSettings.top_note || ''}
                    onChange={(e) => setEditingSettings({ ...editingSettings, top_note: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="Optional note displayed above pricing tiers"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bottom Note (displayed below tiers)</label>
                  <textarea
                    value={editingSettings.bottom_note || ''}
                    onChange={(e) => setEditingSettings({ ...editingSettings, bottom_note: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="Optional note displayed below pricing tiers"
                  />
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="bg-yellow-400 text-black px-6 py-2 rounded-lg font-medium hover:bg-yellow-500 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            )}

            {/* Tiers Tab */}
            {activeTab === 'tiers' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-600">Manage pricing tiers, sections, and feature items</p>
                  <button
                    onClick={() => setShowAddTierModal(true)}
                    className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-medium hover:bg-yellow-500 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Tier
                  </button>
                </div>

                {pricingData?.tiers.map((tier) => (
                  <div key={tier.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Tier Header */}
                    <div
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer ${
                        tier.is_featured ? 'bg-yellow-50' : 'bg-gray-50'
                      }`}
                      onClick={() => toggleTierExpand(tier.id)}
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className={`w-5 h-5 text-gray-500 transition-transform ${expandedTiers.has(tier.id) ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{tier.name}</span>
                            {tier.is_featured && (
                              <span className="text-xs bg-yellow-400 text-black px-2 py-0.5 rounded-full font-medium">
                                Featured
                              </span>
                            )}
                            {!tier.is_active && (
                              <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{tier.subtitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleUpdateTier(tier.id, { is_active: !tier.is_active })}
                          className={`text-xs px-3 py-1 rounded ${tier.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {tier.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <button
                          onClick={() => handleUpdateTier(tier.id, { is_featured: !tier.is_featured })}
                          className={`text-xs px-3 py-1 rounded ${tier.is_featured ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {tier.is_featured ? 'Featured' : 'Set Featured'}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm({ type: 'tier', id: tier.id, name: tier.name })}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Tier Content (Expanded) */}
                    {expandedTiers.has(tier.id) && (
                      <div className="p-4 bg-white border-t border-gray-200">
                        {/* Tier Details Editor */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-100">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                            <input
                              type="text"
                              defaultValue={tier.name}
                              onBlur={(e) => e.target.value !== tier.name && handleUpdateTier(tier.id, { name: e.target.value })}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-yellow-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Subtitle</label>
                            <input
                              type="text"
                              defaultValue={tier.subtitle}
                              onBlur={(e) => e.target.value !== tier.subtitle && handleUpdateTier(tier.id, { subtitle: e.target.value })}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-yellow-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Price Label</label>
                            <input
                              type="text"
                              defaultValue={tier.price_label}
                              onBlur={(e) => e.target.value !== tier.price_label && handleUpdateTier(tier.id, { price_label: e.target.value })}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-yellow-500"
                            />
                          </div>
                        </div>

                        {/* Sections */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium text-gray-700">Sections & Features</h4>
                            <button
                              onClick={() => setShowAddSectionModal(tier.id)}
                              className="text-sm text-yellow-600 hover:text-yellow-700 font-medium"
                            >
                              + Add Section
                            </button>
                          </div>

                          {tier.sections.map((section) => (
                            <div key={section.id} className="border border-gray-100 rounded-lg overflow-hidden">
                              {/* Section Header */}
                              <div
                                className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer"
                                onClick={() => toggleSectionExpand(section.id)}
                              >
                                <div className="flex items-center gap-2">
                                  <svg
                                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.has(section.id) ? 'rotate-90' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  <input
                                    type="text"
                                    defaultValue={section.title}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={(e) => e.target.value !== section.title && handleUpdateSection(section.id, { title: e.target.value })}
                                    className="text-sm font-medium text-gray-800 bg-transparent border-0 focus:ring-0 p-0"
                                  />
                                </div>
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => setShowAddItemModal(section.id)}
                                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                                  >
                                    + Item
                                  </button>
                                  <button
                                    onClick={() => setShowDeleteConfirm({ type: 'section', id: section.id, name: section.title })}
                                    className="text-red-500 hover:text-red-600 p-1"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Section Items */}
                              {expandedSections.has(section.id) && (
                                <div className="p-3 bg-white space-y-2">
                                  {section.items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-2 group">
                                      <select
                                        value={item.icon_type}
                                        onChange={(e) => handleUpdateItem(item.id, { icon_type: e.target.value as 'dot' | 'check' })}
                                        className="text-xs border border-gray-200 rounded px-1 py-0.5"
                                      >
                                        <option value="check">Check</option>
                                        <option value="dot">Dot</option>
                                      </select>
                                      <input
                                        type="text"
                                        defaultValue={item.text}
                                        onBlur={(e) => e.target.value !== item.text && handleUpdateItem(item.id, { text: e.target.value })}
                                        className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500"
                                      />
                                      <button
                                        onClick={() => setShowDeleteConfirm({ type: 'item', id: item.id, name: item.text.slice(0, 30) })}
                                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ))}
                                  {section.items.length === 0 && (
                                    <p className="text-xs text-gray-400 italic">No items yet. Click "+ Item" to add.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}

                          {tier.sections.length === 0 && (
                            <p className="text-sm text-gray-400 italic py-2">No sections yet. Click "+ Add Section" to create one.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {pricingData?.tiers.length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No pricing tiers yet. Click "Add Tier" to create one.</p>
                  </div>
                )}
              </div>
            )}

            {/* Comparison Matrix Tab */}
            {activeTab === 'comparison' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-600">Configure the feature comparison table</p>
                  <button
                    onClick={() => setShowAddComparisonModal(true)}
                    className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-medium hover:bg-yellow-500 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Row
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Feature</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Basic</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Standard</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Gold</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Enterprise</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-16">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pricingData?.comparison_rows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              defaultValue={row.feature_name}
                              onBlur={(e) => e.target.value !== row.feature_name && handleUpdateComparisonRow(row.id, { feature_name: e.target.value })}
                              className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              defaultValue={row.basic_value}
                              onBlur={(e) => e.target.value !== row.basic_value && handleUpdateComparisonRow(row.id, { basic_value: e.target.value })}
                              className="w-full text-sm text-center border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              defaultValue={row.standard_value}
                              onBlur={(e) => e.target.value !== row.standard_value && handleUpdateComparisonRow(row.id, { standard_value: e.target.value })}
                              className="w-full text-sm text-center border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              defaultValue={row.gold_value}
                              onBlur={(e) => e.target.value !== row.gold_value && handleUpdateComparisonRow(row.id, { gold_value: e.target.value })}
                              className="w-full text-sm text-center border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              defaultValue={row.enterprise_value}
                              onBlur={(e) => e.target.value !== row.enterprise_value && handleUpdateComparisonRow(row.id, { enterprise_value: e.target.value })}
                              className="w-full text-sm text-center border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => setShowDeleteConfirm({ type: 'comparison', id: row.id, name: row.feature_name })}
                              className="text-red-500 hover:text-red-600 p-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pricingData?.comparison_rows.length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No comparison rows yet. Click "Add Row" to create one.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Tier Modal */}
      {showAddTierModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Tier</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={newTier.name}
                  onChange={(e) => setNewTier({ ...newTier, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  placeholder="e.g., Premium"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                <input
                  type="text"
                  value={newTier.subtitle}
                  onChange={(e) => setNewTier({ ...newTier, subtitle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  placeholder="e.g., For growing businesses"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price Label</label>
                <input
                  type="text"
                  value={newTier.price_label}
                  onChange={(e) => setNewTier({ ...newTier, price_label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  placeholder="e.g., Custom Quote"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_featured"
                  checked={newTier.is_featured}
                  onChange={(e) => setNewTier({ ...newTier, is_featured: e.target.checked })}
                  className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                />
                <label htmlFor="is_featured" className="text-sm text-gray-700">Mark as Featured</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddTierModal(false); setNewTier({ name: '', subtitle: '', price_label: '', badge_text: '', is_featured: false }); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTier}
                disabled={!newTier.name || isSaving}
                className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-500 disabled:opacity-50"
              >
                {isSaving ? 'Creating...' : 'Create Tier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {showAddSectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Section</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section Title *</label>
              <input
                type="text"
                value={newSection.title}
                onChange={(e) => setNewSection({ title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                placeholder="e.g., Delivery & Timeline"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddSectionModal(null); setNewSection({ title: '' }); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddSection(showAddSectionModal)}
                disabled={!newSection.title || isSaving}
                className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-500 disabled:opacity-50"
              >
                {isSaving ? 'Creating...' : 'Create Section'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Item</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Text *</label>
                <input
                  type="text"
                  value={newItem.text}
                  onChange={(e) => setNewItem({ ...newItem, text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  placeholder="e.g., Standard delivery (5-7 business days)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon Type</label>
                <select
                  value={newItem.icon_type}
                  onChange={(e) => setNewItem({ ...newItem, icon_type: e.target.value as 'dot' | 'check' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="check">Checkmark</option>
                  <option value="dot">Bullet Dot</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddItemModal(null); setNewItem({ text: '', icon_type: 'check' }); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddItem(showAddItemModal)}
                disabled={!newItem.text || isSaving}
                className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-500 disabled:opacity-50"
              >
                {isSaving ? 'Creating...' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Comparison Row Modal */}
      {showAddComparisonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Comparison Row</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Feature Name *</label>
                <input
                  type="text"
                  value={newComparison.feature_name}
                  onChange={(e) => setNewComparison({ ...newComparison, feature_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  placeholder="e.g., Turnaround Time"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Basic Value</label>
                  <input
                    type="text"
                    value={newComparison.basic_value}
                    onChange={(e) => setNewComparison({ ...newComparison, basic_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    placeholder="e.g., 7-10 days"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Standard Value</label>
                  <input
                    type="text"
                    value={newComparison.standard_value}
                    onChange={(e) => setNewComparison({ ...newComparison, standard_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    placeholder="e.g., 5-7 days"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gold Value</label>
                  <input
                    type="text"
                    value={newComparison.gold_value}
                    onChange={(e) => setNewComparison({ ...newComparison, gold_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    placeholder="e.g., 3-5 days"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enterprise Value</label>
                  <input
                    type="text"
                    value={newComparison.enterprise_value}
                    onChange={(e) => setNewComparison({ ...newComparison, enterprise_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    placeholder="e.g., 1-2 days"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddComparisonModal(false); setNewComparison({ feature_name: '', basic_value: '', standard_value: '', gold_value: '', enterprise_value: '' }); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddComparisonRow}
                disabled={!newComparison.feature_name || isSaving}
                className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-500 disabled:opacity-50"
              >
                {isSaving ? 'Creating...' : 'Create Row'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete "{showDeleteConfirm.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showDeleteConfirm.type === 'tier') handleDeleteTier(showDeleteConfirm.id);
                  else if (showDeleteConfirm.type === 'section') handleDeleteSection(showDeleteConfirm.id);
                  else if (showDeleteConfirm.type === 'item') handleDeleteItem(showDeleteConfirm.id);
                  else if (showDeleteConfirm.type === 'comparison') handleDeleteComparisonRow(showDeleteConfirm.id);
                }}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {isSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UV_ADMIN_PricingPage;
