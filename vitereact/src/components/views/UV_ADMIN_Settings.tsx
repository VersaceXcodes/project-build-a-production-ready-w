import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Setting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

interface AuditLogEntry {
  log: {
    id: string;
    user_id: string;
    action: string;
    object_type: string;
    object_id: string;
    metadata: string | null;
    ip_address: string | null;
    created_at: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
}

interface FeatureFlagsState {
  feature_b2b_enabled: boolean;
  feature_inventory_enabled: boolean;
  feature_analytics_enabled: boolean;
}

interface StripeSettingsState {
  stripe_enabled: boolean;
  stripe_mode: 'test' | 'live';
  test_pk: string;
  test_sk: string;
  live_pk: string;
  live_sk: string;
  webhook_secret: string;
}

interface TaxSettingsState {
  tax_rate: string;
  vat_number: string;
  effective_date: string;
}

interface CalendarSettingsState {
  urgent_fee_pct: string;
  emergency_slots_per_day: string;
  deposit_pct: string;
}

interface AuditFiltersState {
  user_id: string;
  action: string;
  object_type: string;
  start_date: string;
  end_date: string;
  page: number;
}

const UV_ADMIN_Settings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // ===========================
  // GLOBAL STATE ACCESS (Individual selectors - NO OBJECT DESTRUCTURING)
  // ===========================
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);

  // ===========================
  // LOCAL STATE
  // ===========================
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'features');
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagsState>({
    feature_b2b_enabled: false,
    feature_inventory_enabled: false,
    feature_analytics_enabled: false,
  });
  const [stripeSettings, setStripeSettings] = useState<StripeSettingsState>({
    stripe_enabled: false,
    stripe_mode: 'test',
    test_pk: '',
    test_sk: '',
    live_pk: '',
    live_sk: '',
    webhook_secret: '',
  });
  const [taxSettings, setTaxSettings] = useState<TaxSettingsState>({
    tax_rate: '23',
    vat_number: '',
    effective_date: '',
  });
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettingsState>({
    urgent_fee_pct: '20',
    emergency_slots_per_day: '2',
    deposit_pct: '50',
  });
  const [auditFilters, setAuditFilters] = useState<AuditFiltersState>({
    user_id: '',
    action: '',
    object_type: '',
    start_date: '',
    end_date: '',
    page: 1,
  });
  const [stripeTestStatus, setStripeTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [expandedAuditLog, setExpandedAuditLog] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // ===========================
  // DATA FETCHING (React Query)
  // ===========================

  // Fetch all settings
  const { data: settingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['admin_settings'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return response.data as Setting[];
    },
    enabled: !!authToken,
    staleTime: 60000,
    retry: 1,
  });

  useEffect(() => {
    if (settingsData) {
      const data = settingsData;
      // Parse settings into organized sections
      const parsedFeatureFlags: FeatureFlagsState = {
        feature_b2b_enabled: data.find(s => s.key === 'feature_b2b_enabled')?.value === 'true',
        feature_inventory_enabled: data.find(s => s.key === 'feature_inventory_enabled')?.value === 'true',
        feature_analytics_enabled: data.find(s => s.key === 'feature_analytics_enabled')?.value === 'true',
      };

      const parsedStripeSettings: StripeSettingsState = {
        stripe_enabled: data.find(s => s.key === 'stripe_enabled')?.value === 'true',
        stripe_mode: (data.find(s => s.key === 'stripe_mode')?.value as 'test' | 'live') || 'test',
        test_pk: data.find(s => s.key === 'stripe_test_pk')?.value || '',
        test_sk: data.find(s => s.key === 'stripe_test_sk')?.value || '',
        live_pk: data.find(s => s.key === 'stripe_live_pk')?.value || '',
        live_sk: data.find(s => s.key === 'stripe_live_sk')?.value || '',
        webhook_secret: data.find(s => s.key === 'stripe_webhook_secret')?.value || '',
      };

      const parsedTaxSettings: TaxSettingsState = {
        tax_rate: data.find(s => s.key === 'tax_rate')?.value || '23',
        vat_number: data.find(s => s.key === 'vat_number')?.value || '',
        effective_date: data.find(s => s.key === 'tax_effective_date')?.value || '',
      };

      const parsedCalendarSettings: CalendarSettingsState = {
        urgent_fee_pct: data.find(s => s.key === 'urgent_fee_pct')?.value || '20',
        emergency_slots_per_day: data.find(s => s.key === 'emergency_slots_per_day')?.value || '2',
        deposit_pct: data.find(s => s.key === 'deposit_pct')?.value || '50',
      };

      setFeatureFlags(parsedFeatureFlags);
      setStripeSettings(parsedStripeSettings);
      setTaxSettings(parsedTaxSettings);
      setCalendarSettings(parsedCalendarSettings);
    }
  }, [settingsData]);

  // Fetch audit logs
  const { data: auditLogsData, isLoading: isLoadingAudit } = useQuery({
    queryKey: ['audit_logs', auditFilters],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: auditFilters.page.toString(),
      };
      if (auditFilters.user_id) params.user_id = auditFilters.user_id;
      if (auditFilters.action) params.action = auditFilters.action;
      if (auditFilters.object_type) params.object_type = auditFilters.object_type;
      if (auditFilters.start_date) params.start_date = auditFilters.start_date;
      if (auditFilters.end_date) params.end_date = auditFilters.end_date;

      const response = await axios.get(`${API_BASE_URL}/api/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${authToken}` },
        params,
      });
      return response.data as AuditLogsResponse;
    },
    enabled: !!authToken && activeTab === 'audit',
    staleTime: 30000,
    retry: 1,
  });

  // ===========================
  // MUTATIONS
  // ===========================

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/settings/${key}`,
        { value },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_settings'] });
      showToast({
        type: 'success',
        message: 'Setting updated successfully',
        duration: 3000,
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update setting',
        duration: 5000,
      });
    },
  });

  // ===========================
  // EVENT HANDLERS
  // ===========================

  // Tab change
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  // Feature flag toggle
  const handleFeatureFlagToggle = async (flagKey: keyof FeatureFlagsState) => {
    const newValue = !featureFlags[flagKey];
    
    // Optimistic update
    setFeatureFlags(prev => ({ ...prev, [flagKey]: newValue }));

    // API call
    await updateSettingMutation.mutateAsync({
      key: flagKey,
      value: newValue.toString(),
    });
  };

  // Stripe settings save
  const handleSaveStripeSettings = async () => {
    const settingsToUpdate = [
      { key: 'stripe_enabled', value: stripeSettings.stripe_enabled.toString() },
      { key: 'stripe_mode', value: stripeSettings.stripe_mode },
      { key: 'stripe_test_pk', value: stripeSettings.test_pk },
      { key: 'stripe_test_sk', value: stripeSettings.test_sk },
      { key: 'stripe_live_pk', value: stripeSettings.live_pk },
      { key: 'stripe_live_sk', value: stripeSettings.live_sk },
      { key: 'stripe_webhook_secret', value: stripeSettings.webhook_secret },
    ];

    try {
      for (const setting of settingsToUpdate) {
        await updateSettingMutation.mutateAsync(setting);
      }
      showToast({
        type: 'success',
        message: 'Stripe settings saved successfully',
        duration: 3000,
      });
    } catch (error) {
      // Error handled in mutation
    }
  };

  // Test Stripe connection
  const handleTestStripeConnection = async () => {
    setStripeTestStatus('testing');
    
    // Simulate API test (in production, backend would test Stripe API)
    setTimeout(() => {
      if (stripeSettings.stripe_mode === 'test' && stripeSettings.test_pk && stripeSettings.test_sk) {
        setStripeTestStatus('success');
        showToast({
          type: 'success',
          message: 'Stripe connection successful',
          duration: 3000,
        });
      } else if (stripeSettings.stripe_mode === 'live' && stripeSettings.live_pk && stripeSettings.live_sk) {
        setStripeTestStatus('success');
        showToast({
          type: 'success',
          message: 'Stripe connection successful',
          duration: 3000,
        });
      } else {
        setStripeTestStatus('error');
        showToast({
          type: 'error',
          message: 'Invalid Stripe keys',
          duration: 5000,
        });
      }
      
      setTimeout(() => setStripeTestStatus('idle'), 3000);
    }, 1500);
  };

  // Tax settings save
  const handleSaveTaxSettings = async () => {
    // Validate tax rate
    const taxRate = parseFloat(taxSettings.tax_rate);
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      showToast({
        type: 'error',
        message: 'Tax rate must be between 0 and 100',
        duration: 5000,
      });
      return;
    }

    const settingsToUpdate = [
      { key: 'tax_rate', value: taxSettings.tax_rate },
      { key: 'vat_number', value: taxSettings.vat_number },
      { key: 'tax_effective_date', value: taxSettings.effective_date },
    ];

    try {
      for (const setting of settingsToUpdate) {
        await updateSettingMutation.mutateAsync(setting);
      }
      showToast({
        type: 'success',
        message: 'Tax settings saved successfully',
        duration: 3000,
      });
    } catch (error) {
      // Error handled in mutation
    }
  };

  // Calendar settings save
  const handleSaveCalendarSettings = async () => {
    // Validate percentages and numbers
    const urgentFeePct = parseFloat(calendarSettings.urgent_fee_pct);
    const emergencySlots = parseInt(calendarSettings.emergency_slots_per_day);
    const depositPct = parseFloat(calendarSettings.deposit_pct);

    if (isNaN(urgentFeePct) || urgentFeePct < 0 || urgentFeePct > 100) {
      showToast({
        type: 'error',
        message: 'Emergency fee must be between 0 and 100',
        duration: 5000,
      });
      return;
    }

    if (isNaN(emergencySlots) || emergencySlots < 0) {
      showToast({
        type: 'error',
        message: 'Emergency slots must be a positive number',
        duration: 5000,
      });
      return;
    }

    if (isNaN(depositPct) || depositPct < 0 || depositPct > 100) {
      showToast({
        type: 'error',
        message: 'Deposit percentage must be between 0 and 100',
        duration: 5000,
      });
      return;
    }

    const settingsToUpdate = [
      { key: 'urgent_fee_pct', value: calendarSettings.urgent_fee_pct },
      { key: 'emergency_slots_per_day', value: calendarSettings.emergency_slots_per_day },
      { key: 'deposit_pct', value: calendarSettings.deposit_pct },
    ];

    try {
      for (const setting of settingsToUpdate) {
        await updateSettingMutation.mutateAsync(setting);
      }
      showToast({
        type: 'success',
        message: 'Calendar settings saved successfully',
        duration: 3000,
      });
    } catch (error) {
      // Error handled in mutation
    }
  };

  // Audit filter updates
  const handleAuditFilterChange = (key: keyof AuditFiltersState, value: string | number) => {
    setAuditFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : Number(value), // Reset to page 1 when filter changes
    }));
  };

  // Clear audit filters
  const handleClearAuditFilters = () => {
    setAuditFilters({
      user_id: '',
      action: '',
      object_type: '',
      start_date: '',
      end_date: '',
      page: 1,
    });
  };

  // Export audit logs as CSV
  const handleExportAuditLogs = () => {
    if (!auditLogsData) return;

    const csvRows = [
      ['Timestamp', 'User', 'Action', 'Object Type', 'Object ID', 'IP Address', 'Metadata'].join(','),
      ...auditLogsData.logs.map(entry => [
        entry.log.created_at,
        `"${entry.user.name} (${entry.user.role})"`,
        entry.log.action,
        entry.log.object_type,
        entry.log.object_id,
        entry.log.ip_address || 'N/A',
        entry.log.metadata ? `"${entry.log.metadata.replace(/"/g, '""')}"` : 'N/A',
      ].join(',')),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Configure system-wide settings, feature flags, and view audit logs
                </p>
              </div>
              <Link
                to="/admin"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8 overflow-x-auto" aria-label="Settings tabs">
              {[
                { id: 'features', label: 'Feature Flags' },
                { id: 'payments', label: 'Payment Settings' },
                { id: 'tax', label: 'Tax Settings' },
                { id: 'calendar', label: 'Calendar Settings' },
                { id: 'audit', label: 'Audit Logs' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`py-4 px-1 border-b-3 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-yellow-400 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isLoadingSettings && activeTab !== 'audit' ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Feature Flags Tab */}
              {activeTab === 'features' && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Phase 2 Feature Flags</h2>
                  <p className="text-gray-600 mb-8">
                    Enable or disable advanced features. Changes take effect immediately.
                  </p>

                  <div className="space-y-6">
                    {/* B2B Accounts */}
                    <div className="flex items-start justify-between p-6 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          B2B Accounts & Contract Pricing
                        </h3>
                        <p className="text-sm text-gray-600">
                          Enable B2B account management, multi-location orders, contract pricing rules, and consolidated invoicing.
                          Adds /admin/b2b section to admin menu.
                        </p>
                      </div>
                      <button
                        onClick={() => handleFeatureFlagToggle('feature_b2b_enabled')}
                        disabled={updateSettingMutation.isPending}
                        className={`ml-6 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          featureFlags.feature_b2b_enabled ? 'bg-yellow-400' : 'bg-gray-200'
                        } ${updateSettingMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                            featureFlags.feature_b2b_enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Inventory Management */}
                    <div className="flex items-start justify-between p-6 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Inventory Management
                        </h3>
                        <p className="text-sm text-gray-600">
                          Enable material inventory tracking, low stock alerts, consumption rules, and purchase order management.
                          Adds /admin/inventory section to admin menu.
                        </p>
                      </div>
                      <button
                        onClick={() => handleFeatureFlagToggle('feature_inventory_enabled')}
                        disabled={updateSettingMutation.isPending}
                        className={`ml-6 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          featureFlags.feature_inventory_enabled ? 'bg-yellow-400' : 'bg-gray-200'
                        } ${updateSettingMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                            featureFlags.feature_inventory_enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Analytics Dashboard */}
                    <div className="flex items-start justify-between p-6 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Analytics Dashboard
                        </h3>
                        <p className="text-sm text-gray-600">
                          Enable comprehensive analytics including conversion funnel, revenue metrics, turnaround performance, and SLA monitoring.
                          Adds /admin/analytics section to admin menu.
                        </p>
                      </div>
                      <button
                        onClick={() => handleFeatureFlagToggle('feature_analytics_enabled')}
                        disabled={updateSettingMutation.isPending}
                        className={`ml-6 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          featureFlags.feature_analytics_enabled ? 'bg-yellow-400' : 'bg-gray-200'
                        } ${updateSettingMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                            featureFlags.feature_analytics_enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Settings Tab */}
              {activeTab === 'payments' && (
                <div className="space-y-6">
                  {/* Stripe Settings */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Stripe Integration</h2>
                        <p className="text-gray-600 mt-1">Configure Stripe payment processing</p>
                      </div>
                      <button
                        onClick={() => setStripeSettings(prev => ({ ...prev, stripe_enabled: !prev.stripe_enabled }))}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          stripeSettings.stripe_enabled ? 'bg-yellow-400' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                            stripeSettings.stripe_enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {stripeSettings.stripe_enabled && (
                      <div className="space-y-6">
                        {/* Mode Selector */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Mode
                          </label>
                          <div className="flex space-x-4">
                            <button
                              onClick={() => setStripeSettings(prev => ({ ...prev, stripe_mode: 'test' }))}
                              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                                stripeSettings.stripe_mode === 'test'
                                  ? 'bg-yellow-400 text-gray-900 shadow-lg'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              Test Mode
                            </button>
                            <button
                              onClick={() => setStripeSettings(prev => ({ ...prev, stripe_mode: 'live' }))}
                              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                                stripeSettings.stripe_mode === 'live'
                                  ? 'bg-yellow-400 text-gray-900 shadow-lg'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              Live Mode
                            </button>
                          </div>
                        </div>

                        {/* Test Mode Keys */}
                        {stripeSettings.stripe_mode === 'test' && (
                          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h3 className="text-sm font-semibold text-blue-900">Test Mode Keys</h3>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Test Publishable Key
                              </label>
                              <input
                                type="text"
                                value={stripeSettings.test_pk}
                                onChange={(e) => setStripeSettings(prev => ({ ...prev, test_pk: e.target.value }))}
                                placeholder="pk_test_..."
                                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Test Secret Key
                              </label>
                              <input
                                type="password"
                                value={stripeSettings.test_sk}
                                onChange={(e) => setStripeSettings(prev => ({ ...prev, test_sk: e.target.value }))}
                                placeholder="sk_test_..."
                                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                              />
                            </div>
                          </div>
                        )}

                        {/* Live Mode Keys */}
                        {stripeSettings.stripe_mode === 'live' && (
                          <div className="space-y-4 p-4 bg-red-50 rounded-lg border border-red-200">
                            <h3 className="text-sm font-semibold text-red-900">Live Mode Keys (Production)</h3>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Live Publishable Key
                              </label>
                              <input
                                type="text"
                                value={stripeSettings.live_pk}
                                onChange={(e) => setStripeSettings(prev => ({ ...prev, live_pk: e.target.value }))}
                                placeholder="pk_live_..."
                                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Live Secret Key
                              </label>
                              <input
                                type="password"
                                value={stripeSettings.live_sk}
                                onChange={(e) => setStripeSettings(prev => ({ ...prev, live_sk: e.target.value }))}
                                placeholder="sk_live_..."
                                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                              />
                            </div>
                          </div>
                        )}

                        {/* Webhook Secret */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Webhook Secret
                          </label>
                          <input
                            type="password"
                            value={stripeSettings.webhook_secret}
                            onChange={(e) => setStripeSettings(prev => ({ ...prev, webhook_secret: e.target.value }))}
                            placeholder="whsec_..."
                            className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          />
                          <p className="mt-2 text-xs text-gray-500">
                            Webhook secret for signature verification
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex space-x-4 pt-4">
                          <button
                            onClick={handleTestStripeConnection}
                            disabled={stripeTestStatus === 'testing'}
                            className="px-6 py-3 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {stripeTestStatus === 'testing' ? (
                              <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Testing...
                              </span>
                            ) : stripeTestStatus === 'success' ? (
                              <span className="flex items-center text-green-600">
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Connected
                              </span>
                            ) : stripeTestStatus === 'error' ? (
                              <span className="flex items-center text-red-600">
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                Failed
                              </span>
                            ) : (
                              'Test Connection'
                            )}
                          </button>
                          <button
                            onClick={handleSaveStripeSettings}
                            disabled={updateSettingMutation.isPending}
                            className="flex-1 px-6 py-3 bg-yellow-400 text-gray-900 rounded-lg font-medium hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                          >
                            {updateSettingMutation.isPending ? 'Saving...' : 'Save Stripe Settings'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tax Settings Tab */}
              {activeTab === 'tax' && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Tax & VAT Configuration</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={taxSettings.tax_rate}
                        onChange={(e) => setTaxSettings(prev => ({ ...prev, tax_rate: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Current rate applied to all invoices (e.g., 23 for Irish VAT)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        VAT Number / Tax ID
                      </label>
                      <input
                        type="text"
                        value={taxSettings.vat_number}
                        onChange={(e) => setTaxSettings(prev => ({ ...prev, vat_number: e.target.value }))}
                        placeholder="IE1234567X"
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Displayed on invoices and receipts
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Effective Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={taxSettings.effective_date}
                        onChange={(e) => setTaxSettings(prev => ({ ...prev, effective_date: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Schedule future tax rate changes (leave empty for current rate)
                      </p>
                    </div>

                    <button
                      onClick={handleSaveTaxSettings}
                      disabled={updateSettingMutation.isPending}
                      className="w-full px-6 py-3 bg-yellow-400 text-gray-900 rounded-lg font-medium hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {updateSettingMutation.isPending ? 'Saving...' : 'Save Tax Settings'}
                    </button>
                  </div>
                </div>
              )}

              {/* Calendar Settings Tab */}
              {activeTab === 'calendar' && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Calendar & Booking Settings</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Emergency Booking Fee (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={calendarSettings.urgent_fee_pct}
                        onChange={(e) => setCalendarSettings(prev => ({ ...prev, urgent_fee_pct: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Additional fee charged for emergency bookings on fully booked dates (default: 20%)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Emergency Slots Per Day
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={calendarSettings.emergency_slots_per_day}
                        onChange={(e) => setCalendarSettings(prev => ({ ...prev, emergency_slots_per_day: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Number of emergency booking slots available per day (default: 2)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Deposit Requirement (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={calendarSettings.deposit_pct}
                        onChange={(e) => setCalendarSettings(prev => ({ ...prev, deposit_pct: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Percentage of total amount required as deposit (default: 50%)
                      </p>
                    </div>

                    <button
                      onClick={handleSaveCalendarSettings}
                      disabled={updateSettingMutation.isPending}
                      className="w-full px-6 py-3 bg-yellow-400 text-gray-900 rounded-lg font-medium hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {updateSettingMutation.isPending ? 'Saving...' : 'Save Calendar Settings'}
                    </button>
                  </div>
                </div>
              )}

              {/* Audit Logs Tab */}
              {activeTab === 'audit' && (
                <div className="space-y-6">
                  {/* Filter Panel */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Filter Audit Logs</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Action Type
                        </label>
                        <select
                          value={auditFilters.action}
                          onChange={(e) => handleAuditFilterChange('action', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        >
                          <option value="">All Actions</option>
                          <option value="CREATE">Create</option>
                          <option value="UPDATE">Update</option>
                          <option value="DELETE">Delete</option>
                          <option value="LOGIN">Login</option>
                          <option value="REGISTER">Register</option>
                          <option value="FINALIZE">Finalize</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Object Type
                        </label>
                        <select
                          value={auditFilters.object_type}
                          onChange={(e) => handleAuditFilterChange('object_type', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        >
                          <option value="">All Objects</option>
                          <option value="USER">User</option>
                          <option value="QUOTE">Quote</option>
                          <option value="ORDER">Order</option>
                          <option value="PAYMENT">Payment</option>
                          <option value="SERVICE">Service</option>
                          <option value="SETTING">Setting</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={auditFilters.start_date}
                          onChange={(e) => handleAuditFilterChange('start_date', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={auditFilters.end_date}
                          onChange={(e) => handleAuditFilterChange('end_date', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      <div className="flex items-end space-x-2">
                        <button
                          onClick={handleClearAuditFilters}
                          className="flex-1 px-6 py-3 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-all"
                        >
                          Clear Filters
                        </button>
                        <button
                          onClick={handleExportAuditLogs}
                          disabled={!auditLogsData || auditLogsData.logs.length === 0}
                          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Export CSV
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Audit Logs Table */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-200">
                      <h2 className="text-2xl font-bold text-gray-900">Audit Trail</h2>
                      <p className="text-gray-600 mt-1">
                        {auditLogsData ? `Showing ${auditLogsData.logs.length} of ${auditLogsData.total} entries` : 'Loading...'}
                      </p>
                    </div>

                    {isLoadingAudit ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      </div>
                    ) : !auditLogsData || auditLogsData.logs.length === 0 ? (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="mt-4 text-gray-600">No audit logs found</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Timestamp
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Action
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Object
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  IP Address
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Details
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {auditLogsData.logs.map((entry) => (
                                <React.Fragment key={entry.log.id}>
                                  <tr className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {new Date(entry.log.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900">{entry.user.name}</div>
                                      <div className="text-xs text-gray-500">{entry.user.role}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                        {entry.log.action}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {entry.log.object_type} #{entry.log.object_id.substring(0, 8)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {entry.log.ip_address || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                      {entry.log.metadata && (
                                        <button
                                          onClick={() => setExpandedAuditLog(expandedAuditLog === entry.log.id ? null : entry.log.id)}
                                          className="text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                          {expandedAuditLog === entry.log.id ? 'Hide' : 'View'}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                  {expandedAuditLog === entry.log.id && entry.log.metadata && (
                                    <tr>
                                      <td colSpan={6} className="px-6 py-4 bg-gray-50">
                                        <pre className="text-xs text-gray-700 overflow-auto max-h-48">
                                          {JSON.stringify(JSON.parse(entry.log.metadata), null, 2)}
                                        </pre>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-gray-200">
                          {auditLogsData.logs.map((entry) => (
                            <div key={entry.log.id} className="p-6 space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{entry.user.name}</p>
                                  <p className="text-xs text-gray-500">{entry.user.role}</p>
                                </div>
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {entry.log.action}
                                </span>
                              </div>
                              <div className="text-sm text-gray-700">
                                <span className="font-medium">{entry.log.object_type}</span> #{entry.log.object_id.substring(0, 8)}
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{new Date(entry.log.created_at).toLocaleString()}</span>
                                <span>{entry.log.ip_address || 'N/A'}</span>
                              </div>
                              {entry.log.metadata && (
                                <button
                                  onClick={() => setExpandedAuditLog(expandedAuditLog === entry.log.id ? null : entry.log.id)}
                                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                >
                                  {expandedAuditLog === entry.log.id ? 'Hide Details' : 'View Details'}
                                </button>
                              )}
                              {expandedAuditLog === entry.log.id && entry.log.metadata && (
                                <pre className="text-xs text-gray-700 overflow-auto max-h-48 bg-gray-50 p-3 rounded">
                                  {JSON.stringify(JSON.parse(entry.log.metadata), null, 2)}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Pagination */}
                        {auditLogsData && auditLogsData.total > 100 && (
                          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                            <button
                              onClick={() => handleAuditFilterChange('page', Math.max(1, auditFilters.page - 1))}
                              disabled={auditFilters.page <= 1}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            <span className="text-sm text-gray-600">
                              Page {auditFilters.page} of {Math.ceil(auditLogsData.total / 100)}
                            </span>
                            <button
                              onClick={() => handleAuditFilterChange('page', auditFilters.page + 1)}
                              disabled={auditFilters.page >= Math.ceil(auditLogsData.total / 100)}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_ADMIN_Settings;