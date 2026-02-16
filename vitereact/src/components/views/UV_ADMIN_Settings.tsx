import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  productsPublicEnabled: boolean;
}

// Legal document types
interface TermsSection {
  id: string;
  title: string;
  contentMarkdown: string;
  order: number;
}

interface LegalDocument {
  id: string;
  document_type: string;
  content: string | TermsSection[];
  version: number;
  is_current: boolean;
  updated_at: string;
  updated_by_user_id: string | null;
  updated_by_name: string;
  updated_by_email: string;
  created_at: string;
}

// Marketing content for policies page
interface PolicyContentItem {
  id: string;
  page_key: string;
  section_key: string;
  content: string;
  updated_at: string;
}

interface PoliciesContent {
  payment_terms: string;
  tax_vat: string;
  file_requirements: string;
  refunds_cancellations: string;
  revisions: string;
  turnaround: string;
}

// Pricing page types
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

interface PricingComparisonRow {
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
  comparison_rows: PricingComparisonRow[];
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

interface PortfolioItem {
  id: string;
  title: string;
  image_url: string;
  thumbnail_url: string | null;
  description: string | null;
  alt_text: string | null;
  categories: string | null;
  media_type: 'image' | 'video';
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
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
    productsPublicEnabled: false,
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
  
  // Legal document states
  const [legalSubTab, setLegalSubTab] = useState<string>(searchParams.get('legal') || 'policies');
  const [termsSections, setTermsSections] = useState<TermsSection[]>([]);
  const [privacyContent, setPrivacyContent] = useState<string>('');
  const [refundContent, setRefundContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);
  
  // Policies page content (marketing_content table)
  const [policiesContent, setPoliciesContent] = useState<PoliciesContent>({
    payment_terms: '',
    tax_vat: '',
    file_requirements: '',
    refunds_cancellations: '',
    revisions: '',
    turnaround: '',
  });
  const [policiesContentIds, setPoliciesContentIds] = useState<Record<string, string>>({});
  const [activePolicySection, setActivePolicySection] = useState<string>('payment_terms');

  // Pricing page state
  const [pricingSubTab, setPricingSubTab] = useState<'settings' | 'tiers' | 'comparison'>('settings');
  const [pricingSettings, setPricingSettings] = useState<Partial<PricingSettings>>({});
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showAddTierModal, setShowAddTierModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState<string | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState<string | null>(null);
  const [showAddComparisonModal, setShowAddComparisonModal] = useState(false);
  const [showPricingDeleteConfirm, setShowPricingDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);
  const [newTier, setNewTier] = useState({ name: '', subtitle: '', price_label: '', badge_text: '', is_featured: false });
  const [newSection, setNewSection] = useState({ title: '' });
  const [newItem, setNewItem] = useState({ text: '', icon_type: 'check' as 'dot' | 'check' });
  const [newComparison, setNewComparison] = useState({ feature_name: '', basic_value: '', standard_value: '', gold_value: '', enterprise_value: '' });
  const [pricingSaving, setPricingSaving] = useState(false);

  // Portfolio state
  const [showPortfolioUploadModal, setShowPortfolioUploadModal] = useState(false);
  const [showPortfolioEditModal, setShowPortfolioEditModal] = useState(false);
  const [showPortfolioDeleteConfirm, setShowPortfolioDeleteConfirm] = useState<PortfolioItem | null>(null);
  const [selectedPortfolioItem, setSelectedPortfolioItem] = useState<PortfolioItem | null>(null);
  const [portfolioUploadForm, setPortfolioUploadForm] = useState({
    title: '',
    description: '',
    media_type: 'image' as 'image' | 'video',
  });
  const [portfolioEditForm, setPortfolioEditForm] = useState({
    title: '',
    description: '',
    is_active: true,
  });
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);
  const [portfolioFilePreview, setPortfolioFilePreview] = useState<string | null>(null);

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
        productsPublicEnabled: data.find(s => s.key === 'productsPublicEnabled')?.value === 'true',
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

  // Fetch legal document based on active legal sub-tab
  const { data: legalDocData, isLoading: isLoadingLegal } = useQuery({
    queryKey: ['legal_document', legalSubTab],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/legal/${legalSubTab}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return response.data as LegalDocument;
    },
    enabled: !!authToken && activeTab === 'legal',
    staleTime: 30000,
    retry: 1,
  });

  // Update legal content state when data is fetched
  useEffect(() => {
    if (legalDocData) {
      if (legalSubTab === 'terms' && Array.isArray(legalDocData.content)) {
        setTermsSections(legalDocData.content as TermsSection[]);
      } else if (legalSubTab === 'privacy') {
        setPrivacyContent(legalDocData.content as string);
      } else if (legalSubTab === 'refund') {
        setRefundContent(legalDocData.content as string);
      }
    }
  }, [legalDocData, legalSubTab]);

  // Fetch policies page content (marketing_content)
  const { data: policiesData, isLoading: isLoadingPolicies } = useQuery({
    queryKey: ['admin_policies_content'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/marketing-content`, {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { page_key: 'policies' },
      });
      return response.data as PolicyContentItem[];
    },
    enabled: !!authToken && activeTab === 'legal' && legalSubTab === 'policies',
    staleTime: 30000,
    retry: 1,
  });

  // Update policies state when data is fetched
  useEffect(() => {
    if (policiesData) {
      const content: PoliciesContent = {
        payment_terms: '',
        tax_vat: '',
        file_requirements: '',
        refunds_cancellations: '',
        revisions: '',
        turnaround: '',
      };
      const ids: Record<string, string> = {};
      
      policiesData.forEach((item) => {
        if (item.section_key in content) {
          content[item.section_key as keyof PoliciesContent] = item.content;
          ids[item.section_key] = item.id;
        }
      });
      
      setPoliciesContent(content);
      setPoliciesContentIds(ids);
    }
  }, [policiesData]);

  // Fetch pricing page data
  const { data: pricingData, isLoading: isLoadingPricing, refetch: refetchPricing } = useQuery({
    queryKey: ['admin_pricing_page'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/pricing`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return response.data as PricingData;
    },
    enabled: !!authToken && activeTab === 'pricing',
    staleTime: 30000,
    retry: 1,
  });

  // Update pricing settings state when data is fetched
  useEffect(() => {
    if (pricingData?.settings) {
      setPricingSettings(pricingData.settings);
    }
  }, [pricingData?.settings]);

  // Fetch portfolio items (gallery images)
  const { data: portfolioData, isLoading: isLoadingPortfolio } = useQuery({
    queryKey: ['admin_portfolio'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/gallery-images`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return response.data as PortfolioItem[];
    },
    enabled: !!authToken && activeTab === 'portfolio',
    staleTime: 0, // Always refetch when query is invalidated
    refetchOnMount: true,
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

  // Update legal document mutation
  const updateLegalMutation = useMutation({
    mutationFn: async ({ documentType, content }: { documentType: string; content: string | TermsSection[] }) => {
      const response = await axios.put(
        `${API_BASE_URL}/api/admin/legal/${documentType}`,
        { content: typeof content === 'string' ? content : JSON.stringify(content) },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal_document'] });
      showToast({
        type: 'success',
        message: 'Legal document updated successfully',
        duration: 3000,
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update legal document',
        duration: 5000,
      });
    },
  });

  // Update policies content mutation (marketing_content)
  const updatePoliciesMutation = useMutation({
    mutationFn: async ({ sectionKey, content }: { sectionKey: string; content: string }) => {
      const contentId = policiesContentIds[sectionKey];
      if (contentId) {
        // Update existing
        const response = await axios.patch(
          `${API_BASE_URL}/api/admin/marketing-content/${contentId}`,
          { content },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        return response.data;
      } else {
        // Create new
        const response = await axios.post(
          `${API_BASE_URL}/api/admin/marketing-content`,
          { 
            page_key: 'policies',
            section_key: sectionKey,
            content 
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_policies_content'] });
      showToast({
        type: 'success',
        message: 'Policy content updated successfully',
        duration: 3000,
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update policy content',
        duration: 5000,
      });
    },
  });

  // Pricing API functions
  const savePricingSettings = async (settings: Partial<PricingSettings>) => {
    const response = await axios.put(`${API_BASE_URL}/api/admin/pricing/settings`, settings, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return response.data;
  };

  const createPricingTier = async (tier: Partial<PricingTier>) => {
    const response = await axios.post(`${API_BASE_URL}/api/admin/pricing/tiers`, tier, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return response.data;
  };

  const updatePricingTier = async (tierId: string, tier: Partial<PricingTier>) => {
    const response = await axios.patch(`${API_BASE_URL}/api/admin/pricing/tiers/${tierId}`, tier, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return response.data;
  };

  const deletePricingTier = async (tierId: string) => {
    await axios.delete(`${API_BASE_URL}/api/admin/pricing/tiers/${tierId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  };

  const createPricingSection = async (section: Partial<PricingTierSection>) => {
    const response = await axios.post(`${API_BASE_URL}/api/admin/pricing/sections`, section, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return response.data;
  };

  const updatePricingSection = async (sectionId: string, section: Partial<PricingTierSection>) => {
    const response = await axios.patch(`${API_BASE_URL}/api/admin/pricing/sections/${sectionId}`, section, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return response.data;
  };

  const deletePricingSection = async (sectionId: string) => {
    await axios.delete(`${API_BASE_URL}/api/admin/pricing/sections/${sectionId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  };

  const createPricingItem = async (item: Partial<PricingTierItem>) => {
    const response = await axios.post(`${API_BASE_URL}/api/admin/pricing/items`, item, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return response.data;
  };

  const updatePricingItem = async (itemId: string, item: Partial<PricingTierItem>) => {
    const response = await axios.patch(`${API_BASE_URL}/api/admin/pricing/items/${itemId}`, item, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return response.data;
  };

  const deletePricingItem = async (itemId: string) => {
    await axios.delete(`${API_BASE_URL}/api/admin/pricing/items/${itemId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  };

  const createPricingComparisonRow = async (row: Partial<PricingComparisonRow>) => {
    const response = await axios.post(`${API_BASE_URL}/api/admin/pricing/comparison-rows`, row, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return response.data;
  };

  const updatePricingComparisonRow = async (rowId: string, row: Partial<PricingComparisonRow>) => {
    const response = await axios.patch(`${API_BASE_URL}/api/admin/pricing/comparison-rows/${rowId}`, row, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return response.data;
  };

  const deletePricingComparisonRow = async (rowId: string) => {
    await axios.delete(`${API_BASE_URL}/api/admin/pricing/comparison-rows/${rowId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  };

  // Portfolio API functions
  const handlePortfolioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPortfolioFile(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setPortfolioFilePreview(previewUrl);
      
      // Auto-detect media type
      if (file.type.startsWith('video/')) {
        setPortfolioUploadForm(prev => ({ ...prev, media_type: 'video' }));
      } else {
        setPortfolioUploadForm(prev => ({ ...prev, media_type: 'image' }));
      }
    }
  };

  const handlePortfolioUpload = async () => {
    if (!portfolioFile || !portfolioUploadForm.title) {
      showToast({ type: 'error', message: 'Please provide a title and select a file', duration: 5000 });
      return;
    }

    setUploadingPortfolio(true);
    try {
      // First upload the file using the dedicated portfolio upload endpoint
      const formData = new FormData();
      formData.append('file', portfolioFile);
      
      console.log('Uploading portfolio file...', portfolioFile.name);
      const uploadResponse = await axios.post(`${API_BASE_URL}/api/admin/portfolio-upload`, formData, {
        headers: { 
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('Upload response:', uploadResponse.data);
      const fileUrl = uploadResponse.data.file_url;
      
      if (!fileUrl) {
        throw new Error('No file URL returned from upload');
      }
      
      // Then create the gallery image entry
      console.log('Creating gallery image entry...');
      await axios.post(`${API_BASE_URL}/api/admin/gallery-images`, {
        title: portfolioUploadForm.title,
        image_url: fileUrl,
        thumbnail_url: null,
        description: portfolioUploadForm.description || null,
        alt_text: portfolioUploadForm.title,
        categories: null,
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      showToast({ type: 'success', message: 'Portfolio item uploaded successfully', duration: 3000 });
      setShowPortfolioUploadModal(false);
      setPortfolioUploadForm({ title: '', description: '', media_type: 'image' });
      setPortfolioFile(null);
      setPortfolioFilePreview(null);
      
      // Invalidate and refetch portfolio data
      queryClient.invalidateQueries({ queryKey: ['admin_portfolio'] });
    } catch (error: any) {
      console.error('Portfolio upload error:', error);
      showToast({ type: 'error', message: error.response?.data?.message || error.message || 'Failed to upload portfolio item', duration: 5000 });
    } finally {
      setUploadingPortfolio(false);
    }
  };

  const handleOpenPortfolioEdit = (item: PortfolioItem) => {
    setSelectedPortfolioItem(item);
    setPortfolioEditForm({
      title: item.title,
      description: item.description || '',
      is_active: item.is_active,
    });
    setShowPortfolioEditModal(true);
  };

  const handleSavePortfolioEdit = async () => {
    if (!selectedPortfolioItem) return;
    
    try {
      await axios.patch(`${API_BASE_URL}/api/admin/gallery-images/${selectedPortfolioItem.id}`, {
        title: portfolioEditForm.title,
        description: portfolioEditForm.description || null,
        is_active: portfolioEditForm.is_active,
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      showToast({ type: 'success', message: 'Portfolio item updated successfully', duration: 3000 });
      setShowPortfolioEditModal(false);
      setSelectedPortfolioItem(null);
      queryClient.invalidateQueries({ queryKey: ['admin_portfolio'] });
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || 'Failed to update portfolio item', duration: 5000 });
    }
  };

  const handleDeletePortfolioItem = async () => {
    if (!showPortfolioDeleteConfirm) return;
    
    try {
      console.log('Deleting portfolio item:', showPortfolioDeleteConfirm.id);
      await axios.delete(`${API_BASE_URL}/api/admin/gallery-images/${showPortfolioDeleteConfirm.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      console.log('Delete successful');
      showToast({ type: 'success', message: 'Portfolio item deleted successfully', duration: 3000 });
      setShowPortfolioDeleteConfirm(null);
      
      // Invalidate and refetch portfolio data
      queryClient.invalidateQueries({ queryKey: ['admin_portfolio'] });
    } catch (error: any) {
      console.error('Delete error:', error);
      showToast({ type: 'error', message: error.response?.data?.message || 'Failed to delete portfolio item', duration: 5000 });
    }
  };

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

  // Legal tab change
  const handleLegalSubTabChange = (newSubTab: string) => {
    setLegalSubTab(newSubTab);
    setShowPreview(false);
    setSearchParams({ tab: 'legal', legal: newSubTab });
  };

  // Terms section handlers
  const handleTermsSectionChange = (sectionId: string, field: 'title' | 'contentMarkdown', value: string) => {
    setTermsSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? { ...section, [field]: value }
          : section
      )
    );
  };

  const handleAddTermsSection = () => {
    const newSection: TermsSection = {
      id: `section_${Date.now()}`,
      title: 'New Section',
      contentMarkdown: '',
      order: termsSections.length + 1,
    };
    setTermsSections(prev => [...prev, newSection]);
  };

  const handleRemoveTermsSection = (sectionId: string) => {
    setTermsSections(prev => {
      const filtered = prev.filter(s => s.id !== sectionId);
      // Reorder remaining sections
      return filtered.map((s, idx) => ({ ...s, order: idx + 1 }));
    });
  };

  const handleMoveTermsSection = (sectionId: string, direction: 'up' | 'down') => {
    setTermsSections(prev => {
      const idx = prev.findIndex(s => s.id === sectionId);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;

      const newSections = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
      
      // Update order values
      return newSections.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  // Save legal document
  const handleSaveLegalDocument = async () => {
    let content: string | TermsSection[];
    
    if (legalSubTab === 'terms') {
      content = termsSections;
    } else if (legalSubTab === 'privacy') {
      content = privacyContent;
    } else {
      content = refundContent;
    }

    await updateLegalMutation.mutateAsync({
      documentType: legalSubTab,
      content,
    });
  };

  // Save policies content
  const handleSavePolicyContent = async (sectionKey: string) => {
    const content = policiesContent[sectionKey as keyof PoliciesContent];
    await updatePoliciesMutation.mutateAsync({
      sectionKey,
      content,
    });
  };

  // Update individual policy section content
  const handlePolicyContentChange = (sectionKey: string, content: string) => {
    setPoliciesContent(prev => ({
      ...prev,
      [sectionKey]: content,
    }));
  };

  // Policy section labels
  const policySections = [
    { key: 'payment_terms', label: 'Payment Terms' },
    { key: 'tax_vat', label: 'Tax/VAT Information' },
    { key: 'file_requirements', label: 'File Requirements' },
    { key: 'refunds_cancellations', label: 'Refunds & Cancellations' },
    { key: 'revisions', label: 'Revision Policy' },
    { key: 'turnaround', label: 'Turnaround Times' },
  ];

  // ===========================
  // PRICING PAGE HANDLERS
  // ===========================

  const toggleTierExpand = (tierId: string) => {
    setExpandedTiers(prev => {
      const next = new Set(prev);
      if (next.has(tierId)) next.delete(tierId);
      else next.add(tierId);
      return next;
    });
  };

  const toggleSectionExpand = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const handleSavePricingSettings = async () => {
    setPricingSaving(true);
    try {
      await savePricingSettings(pricingSettings);
      showToast({ type: 'success', message: 'Pricing settings saved', duration: 3000 });
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to save settings', duration: 5000 });
    } finally {
      setPricingSaving(false);
    }
  };

  const handleTogglePricingEnabled = async () => {
    if (!pricingData?.settings) return;
    setPricingSaving(true);
    try {
      await savePricingSettings({ is_enabled: !pricingData.settings.is_enabled });
      showToast({ type: 'success', message: `Pricing page ${pricingData.settings.is_enabled ? 'disabled' : 'enabled'}`, duration: 3000 });
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to toggle', duration: 5000 });
    } finally {
      setPricingSaving(false);
    }
  };

  const handleAddPricingTier = async () => {
    if (!newTier.name) return;
    setPricingSaving(true);
    try {
      const maxOrder = Math.max(...(pricingData?.tiers.map(t => t.display_order) || [0]), 0);
      await createPricingTier({ ...newTier, display_order: maxOrder + 1, is_active: true });
      showToast({ type: 'success', message: 'Tier created', duration: 3000 });
      setShowAddTierModal(false);
      setNewTier({ name: '', subtitle: '', price_label: '', badge_text: '', is_featured: false });
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to create tier', duration: 5000 });
    } finally {
      setPricingSaving(false);
    }
  };

  const handleUpdatePricingTier = async (tierId: string, updates: Partial<PricingTier>) => {
    try {
      await updatePricingTier(tierId, updates);
      showToast({ type: 'success', message: 'Tier updated', duration: 2000 });
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to update tier', duration: 5000 });
    }
  };

  const handleDeletePricingTier = async (tierId: string) => {
    setPricingSaving(true);
    try {
      await deletePricingTier(tierId);
      showToast({ type: 'success', message: 'Tier deleted', duration: 3000 });
      setShowPricingDeleteConfirm(null);
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to delete tier', duration: 5000 });
    } finally {
      setPricingSaving(false);
    }
  };

  const handleAddPricingSection = async (tierId: string) => {
    if (!newSection.title) return;
    setPricingSaving(true);
    try {
      const tier = pricingData?.tiers.find(t => t.id === tierId);
      const maxOrder = Math.max(...(tier?.sections.map(s => s.display_order) || [0]), 0);
      await createPricingSection({ tier_id: tierId, title: newSection.title, display_order: maxOrder + 1 });
      showToast({ type: 'success', message: 'Section created', duration: 3000 });
      setShowAddSectionModal(null);
      setNewSection({ title: '' });
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to create section', duration: 5000 });
    } finally {
      setPricingSaving(false);
    }
  };

  const handleUpdatePricingSection = async (sectionId: string, updates: Partial<PricingTierSection>) => {
    try {
      await updatePricingSection(sectionId, updates);
      showToast({ type: 'success', message: 'Section updated', duration: 2000 });
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to update section', duration: 5000 });
    }
  };

  const handleDeletePricingSection = async (sectionId: string) => {
    setPricingSaving(true);
    try {
      await deletePricingSection(sectionId);
      showToast({ type: 'success', message: 'Section deleted', duration: 3000 });
      setShowPricingDeleteConfirm(null);
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to delete section', duration: 5000 });
    } finally {
      setPricingSaving(false);
    }
  };

  const handleAddPricingItem = async (sectionId: string) => {
    if (!newItem.text) return;
    setPricingSaving(true);
    try {
      let maxOrder = 0;
      pricingData?.tiers.forEach(tier => {
        tier.sections.forEach(section => {
          if (section.id === sectionId) {
            maxOrder = Math.max(...(section.items.map(i => i.display_order) || [0]), 0);
          }
        });
      });
      await createPricingItem({ section_id: sectionId, text: newItem.text, icon_type: newItem.icon_type, display_order: maxOrder + 1 });
      showToast({ type: 'success', message: 'Item created', duration: 3000 });
      setShowAddItemModal(null);
      setNewItem({ text: '', icon_type: 'check' });
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to create item', duration: 5000 });
    } finally {
      setPricingSaving(false);
    }
  };

  const handleUpdatePricingItem = async (itemId: string, updates: Partial<PricingTierItem>) => {
    try {
      await updatePricingItem(itemId, updates);
      showToast({ type: 'success', message: 'Item updated', duration: 2000 });
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to update item', duration: 5000 });
    }
  };

  const handleDeletePricingItem = async (itemId: string) => {
    setPricingSaving(true);
    try {
      await deletePricingItem(itemId);
      showToast({ type: 'success', message: 'Item deleted', duration: 3000 });
      setShowPricingDeleteConfirm(null);
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to delete item', duration: 5000 });
    } finally {
      setPricingSaving(false);
    }
  };

  const handleAddPricingComparisonRow = async () => {
    if (!newComparison.feature_name) return;
    setPricingSaving(true);
    try {
      const maxOrder = Math.max(...(pricingData?.comparison_rows.map(r => r.display_order) || [0]), 0);
      await createPricingComparisonRow({ ...newComparison, display_order: maxOrder + 1 });
      showToast({ type: 'success', message: 'Comparison row created', duration: 3000 });
      setShowAddComparisonModal(false);
      setNewComparison({ feature_name: '', basic_value: '', standard_value: '', gold_value: '', enterprise_value: '' });
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to create row', duration: 5000 });
    } finally {
      setPricingSaving(false);
    }
  };

  const handleUpdatePricingComparisonRow = async (rowId: string, updates: Partial<PricingComparisonRow>) => {
    try {
      await updatePricingComparisonRow(rowId, updates);
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to update row', duration: 5000 });
    }
  };

  const handleDeletePricingComparisonRow = async (rowId: string) => {
    setPricingSaving(true);
    try {
      await deletePricingComparisonRow(rowId);
      showToast({ type: 'success', message: 'Row deleted', duration: 3000 });
      setShowPricingDeleteConfirm(null);
      refetchPricing();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to delete row', duration: 5000 });
    } finally {
      setPricingSaving(false);
    }
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
                { id: 'legal', label: 'Legal' },
                { id: 'pricing', label: 'Pricing' },
                { id: 'portfolio', label: 'Portfolio' },
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

                    {/* Products Public (Visibility Toggle) */}
                    <div className="flex items-start justify-between p-6 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Enable Products (Public)
                        </h3>
                        <p className="text-sm text-gray-600">
                          Show Products section on the public website. When disabled, Products are hidden from navigation, 
                          homepage sections (Best Sellers, Popular Print Categories), and /products routes are blocked for public visitors.
                          Admin can still manage products regardless of this setting.
                        </p>
                      </div>
                      <button
                        onClick={() => handleFeatureFlagToggle('productsPublicEnabled')}
                        disabled={updateSettingMutation.isPending}
                        className={`ml-6 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                          featureFlags.productsPublicEnabled ? 'bg-amber-500' : 'bg-gray-200'
                        } ${updateSettingMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                            featureFlags.productsPublicEnabled ? 'translate-x-5' : 'translate-x-0'
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

              {/* Legal Tab */}
              {activeTab === 'legal' && (
                <div className="space-y-6">
                  {/* Sub-tabs Navigation */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
                    <div className="flex space-x-4 overflow-x-auto">
                      {[
                        { id: 'policies', label: 'Policies Page' },
                        { id: 'terms', label: 'Terms of Service' },
                        { id: 'privacy', label: 'Privacy Policy' },
                        { id: 'refund', label: 'Refund Policy' },
                      ].map(subTab => (
                        <button
                          key={subTab.id}
                          onClick={() => handleLegalSubTabChange(subTab.id)}
                          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                            legalSubTab === subTab.id
                              ? 'bg-yellow-400 text-gray-900'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {subTab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Editor/Preview Toggle & Save - Only for legal documents (not policies) */}
                  {legalSubTab !== 'policies' && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => setShowPreview(false)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                              !showPreview
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setShowPreview(true)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                              showPreview
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Preview
                          </button>
                        </div>
                        <div className="flex items-center space-x-4">
                          {legalDocData && (
                            <span className="text-sm text-gray-500">
                              Last updated: {new Date(legalDocData.updated_at).toLocaleString()} 
                              {legalDocData.updated_by_name && ` by ${legalDocData.updated_by_name}`}
                              {legalDocData.version && ` (v${legalDocData.version})`}
                            </span>
                          )}
                          <button
                            onClick={handleSaveLegalDocument}
                            disabled={updateLegalMutation.isPending}
                            className="px-6 py-2 bg-yellow-400 text-gray-900 rounded-lg font-medium hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                          >
                            {updateLegalMutation.isPending ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Policies Page Editor */}
                  {legalSubTab === 'policies' && (
                    <div className="space-y-6">
                      {isLoadingPolicies ? (
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                      ) : (
                        <>
                          {/* Policy Section Tabs */}
                          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
                            <p className="text-sm text-gray-600 mb-4">
                              Edit the content shown on the public <a href="/policies" target="_blank" className="text-blue-600 hover:underline">/policies</a> page. Content supports HTML formatting.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {policySections.map(section => (
                                <button
                                  key={section.key}
                                  onClick={() => setActivePolicySection(section.key)}
                                  className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                                    activePolicySection === section.key
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {section.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Active Policy Section Editor */}
                          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                            <div className="flex items-center justify-between mb-6">
                              <h2 className="text-2xl font-bold text-gray-900">
                                {policySections.find(s => s.key === activePolicySection)?.label}
                              </h2>
                              <button
                                onClick={() => handleSavePolicyContent(activePolicySection)}
                                disabled={updatePoliciesMutation.isPending}
                                className="px-6 py-2 bg-yellow-400 text-gray-900 rounded-lg font-medium hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                              >
                                {updatePoliciesMutation.isPending ? 'Saving...' : 'Save This Section'}
                              </button>
                            </div>
                            <p className="text-gray-600 mb-4">
                              Enter HTML content for this policy section. This will be displayed on the public policies page.
                            </p>
                            <textarea
                              value={policiesContent[activePolicySection as keyof PoliciesContent]}
                              onChange={(e) => handlePolicyContentChange(activePolicySection, e.target.value)}
                              rows={15}
                              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-mono text-sm"
                              placeholder="<p>Enter your policy content here...</p>&#10;&#10;<p>You can use HTML formatting including:</p>&#10;<ul>&#10;  <li>Lists</li>&#10;  <li>Paragraphs</li>&#10;  <li>Bold and italic text</li>&#10;</ul>"
                            />

                            {/* Preview */}
                            <div className="mt-6 pt-6 border-t border-gray-200">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
                              <div className="bg-gray-50 rounded-lg p-6 prose prose-sm max-w-none">
                                <div
                                  dangerouslySetInnerHTML={{ 
                                    __html: policiesContent[activePolicySection as keyof PoliciesContent] || '<em>No content yet</em>' 
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Loading State for Legal Documents (not policies) */}
                  {legalSubTab !== 'policies' && isLoadingLegal && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                  )}

                  {/* Terms of Service Editor */}
                  {!isLoadingLegal && legalSubTab === 'terms' && !showPreview && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Terms of Service Sections</h2>
                        <button
                          onClick={handleAddTermsSection}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all"
                        >
                          + Add Section
                        </button>
                      </div>
                      
                      <div className="space-y-6">
                        {termsSections.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            No sections yet. Click "Add Section" to create one.
                          </div>
                        ) : (
                          termsSections.map((section, idx) => (
                            <div key={section.id} className="border-2 border-gray-200 rounded-lg p-6 space-y-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 mr-4">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Section {idx + 1} Title
                                  </label>
                                  <input
                                    type="text"
                                    value={section.title}
                                    onChange={(e) => handleTermsSectionChange(section.id, 'title', e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                                    placeholder="e.g., Definitions"
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleMoveTermsSection(section.id, 'up')}
                                    disabled={idx === 0}
                                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Move up"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleMoveTermsSection(section.id, 'down')}
                                    disabled={idx === termsSections.length - 1}
                                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Move down"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleRemoveTermsSection(section.id)}
                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                    title="Remove section"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Content (Markdown)
                                </label>
                                <textarea
                                  value={section.contentMarkdown}
                                  onChange={(e) => handleTermsSectionChange(section.id, 'contentMarkdown', e.target.value)}
                                  rows={8}
                                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-mono text-sm"
                                  placeholder="Enter markdown content..."
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Terms of Service Preview */}
                  {!isLoadingLegal && legalSubTab === 'terms' && showPreview && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">Terms of Service Preview</h2>
                      <div className="prose prose-lg max-w-none">
                        {termsSections.length === 0 ? (
                          <p className="text-gray-500">No sections to preview.</p>
                        ) : (
                          termsSections.map((section, idx) => (
                            <div key={section.id} className="mb-8">
                              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                                {idx + 1}. {section.title}
                              </h3>
                              <div className="prose prose-gray">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {section.contentMarkdown || '*No content*'}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Privacy Policy Editor */}
                  {!isLoadingLegal && legalSubTab === 'privacy' && !showPreview && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">Privacy Policy</h2>
                      <p className="text-gray-600 mb-4">
                        Edit your privacy policy using Markdown formatting.
                      </p>
                      <textarea
                        value={privacyContent}
                        onChange={(e) => setPrivacyContent(e.target.value)}
                        rows={20}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-mono text-sm"
                        placeholder="# Privacy Policy&#10;&#10;Enter your privacy policy here using Markdown..."
                      />
                    </div>
                  )}

                  {/* Privacy Policy Preview */}
                  {!isLoadingLegal && legalSubTab === 'privacy' && showPreview && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">Privacy Policy Preview</h2>
                      <div className="prose prose-lg max-w-none prose-gray">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {privacyContent || '*No content*'}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Refund Policy Editor */}
                  {!isLoadingLegal && legalSubTab === 'refund' && !showPreview && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">Refund Policy</h2>
                      <p className="text-gray-600 mb-4">
                        Edit your refund policy using Markdown formatting.
                      </p>
                      <textarea
                        value={refundContent}
                        onChange={(e) => setRefundContent(e.target.value)}
                        rows={20}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-mono text-sm"
                        placeholder="# Refund Policy&#10;&#10;Enter your refund policy here using Markdown..."
                      />
                    </div>
                  )}

                  {/* Refund Policy Preview */}
                  {!isLoadingLegal && legalSubTab === 'refund' && showPreview && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">Refund Policy Preview</h2>
                      <div className="prose prose-lg max-w-none prose-gray">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {refundContent || '*No content*'}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pricing Tab */}
              {activeTab === 'pricing' && (
                <div className="space-y-6">
                  {/* Header with Enable Toggle and Preview */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Pricing Page</h2>
                        <p className="text-gray-600 mt-1">Configure the public pricing page at /pricing</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg">
                          <span className="text-sm font-medium text-gray-700">Public</span>
                          <button
                            onClick={handleTogglePricingEnabled}
                            disabled={pricingSaving}
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
                            {pricingData?.settings?.is_enabled ? 'On' : 'Off'}
                          </span>
                        </div>
                        <a
                          href="/pricing"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 flex items-center gap-2 text-sm"
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

                  {/* Sub-tabs */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
                    <div className="flex space-x-4 overflow-x-auto">
                      {[
                        { id: 'settings', label: 'Page Settings' },
                        { id: 'tiers', label: 'Pricing Tiers' },
                        { id: 'comparison', label: 'Comparison Matrix' },
                      ].map(subTab => (
                        <button
                          key={subTab.id}
                          onClick={() => setPricingSubTab(subTab.id as typeof pricingSubTab)}
                          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                            pricingSubTab === subTab.id
                              ? 'bg-yellow-400 text-gray-900'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {subTab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {isLoadingPricing ? (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <>
                      {/* Settings Sub-tab */}
                      {pricingSubTab === 'settings' && pricingData?.settings && (
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                          <h3 className="text-xl font-bold text-gray-900 mb-6">Page Settings</h3>
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Page Title</label>
                                <input
                                  type="text"
                                  value={pricingSettings.page_title || ''}
                                  onChange={(e) => setPricingSettings({ ...pricingSettings, page_title: e.target.value })}
                                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 transition-all"
                                  placeholder="Our Service Tiers"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Page Subtitle</label>
                                <input
                                  type="text"
                                  value={pricingSettings.page_subtitle || ''}
                                  onChange={(e) => setPricingSettings({ ...pricingSettings, page_subtitle: e.target.value })}
                                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 transition-all"
                                  placeholder="Choose the tier that best fits your project needs"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Top Note</label>
                              <textarea
                                value={pricingSettings.top_note || ''}
                                onChange={(e) => setPricingSettings({ ...pricingSettings, top_note: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 transition-all"
                                placeholder="Optional note displayed above pricing tiers"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Bottom Note</label>
                              <textarea
                                value={pricingSettings.bottom_note || ''}
                                onChange={(e) => setPricingSettings({ ...pricingSettings, bottom_note: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 transition-all"
                                placeholder="Optional note displayed below pricing tiers"
                              />
                            </div>
                            <button
                              onClick={handleSavePricingSettings}
                              disabled={pricingSaving}
                              className="w-full px-6 py-3 bg-yellow-400 text-gray-900 rounded-lg font-medium hover:bg-yellow-500 transition-all disabled:opacity-50 shadow-lg"
                            >
                              {pricingSaving ? 'Saving...' : 'Save Settings'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tiers Sub-tab */}
                      {pricingSubTab === 'tiers' && (
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Pricing Tiers</h3>
                            <button
                              onClick={() => setShowAddTierModal(true)}
                              className="bg-yellow-400 text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-yellow-500 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add Tier
                            </button>
                          </div>

                          <div className="space-y-4">
                            {pricingData?.tiers.map((tier) => (
                              <div key={tier.id} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                                <div
                                  className={`flex items-center justify-between px-4 py-3 cursor-pointer ${tier.is_featured ? 'bg-yellow-50' : 'bg-gray-50'}`}
                                  onClick={() => toggleTierExpand(tier.id)}
                                >
                                  <div className="flex items-center gap-3">
                                    <svg className={`w-5 h-5 text-gray-500 transition-transform ${expandedTiers.has(tier.id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-900">{tier.name}</span>
                                        {tier.is_featured && <span className="text-xs bg-yellow-400 text-black px-2 py-0.5 rounded-full font-medium">Featured</span>}
                                        {!tier.is_active && <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full">Inactive</span>}
                                      </div>
                                      <p className="text-sm text-gray-500">{tier.subtitle}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => handleUpdatePricingTier(tier.id, { is_active: !tier.is_active })}
                                      className={`text-xs px-3 py-1 rounded ${tier.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                      {tier.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                    <button
                                      onClick={() => handleUpdatePricingTier(tier.id, { is_featured: !tier.is_featured })}
                                      className={`text-xs px-3 py-1 rounded ${tier.is_featured ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                      Featured
                                    </button>
                                    <button
                                      onClick={() => setShowPricingDeleteConfirm({ type: 'tier', id: tier.id, name: tier.name })}
                                      className="text-red-600 hover:text-red-700 p-1"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                {expandedTiers.has(tier.id) && (
                                  <div className="p-4 bg-white border-t border-gray-200">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-100">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                                        <input type="text" defaultValue={tier.name} onBlur={(e) => e.target.value !== tier.name && handleUpdatePricingTier(tier.id, { name: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-yellow-500" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Subtitle</label>
                                        <input type="text" defaultValue={tier.subtitle} onBlur={(e) => e.target.value !== tier.subtitle && handleUpdatePricingTier(tier.id, { subtitle: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-yellow-500" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Price Label</label>
                                        <input type="text" defaultValue={tier.price_label} onBlur={(e) => e.target.value !== tier.price_label && handleUpdatePricingTier(tier.id, { price_label: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-yellow-500" />
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-medium text-gray-700">Sections & Features</h4>
                                        <button onClick={() => setShowAddSectionModal(tier.id)} className="text-sm text-yellow-600 hover:text-yellow-700 font-medium">+ Add Section</button>
                                      </div>

                                      {tier.sections.map((section) => (
                                        <div key={section.id} className="border border-gray-100 rounded-lg overflow-hidden">
                                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer" onClick={() => toggleSectionExpand(section.id)}>
                                            <div className="flex items-center gap-2">
                                              <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.has(section.id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                              </svg>
                                              <input type="text" defaultValue={section.title} onClick={(e) => e.stopPropagation()} onBlur={(e) => e.target.value !== section.title && handleUpdatePricingSection(section.id, { title: e.target.value })} className="text-sm font-medium text-gray-800 bg-transparent border-0 focus:ring-0 p-0" />
                                            </div>
                                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                              <button onClick={() => setShowAddItemModal(section.id)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">+ Item</button>
                                              <button onClick={() => setShowPricingDeleteConfirm({ type: 'section', id: section.id, name: section.title })} className="text-red-500 hover:text-red-600 p-1">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                              </button>
                                            </div>
                                          </div>

                                          {expandedSections.has(section.id) && (
                                            <div className="p-3 bg-white space-y-2">
                                              {section.items.map((item) => (
                                                <div key={item.id} className="flex items-center gap-2 group">
                                                  <select value={item.icon_type} onChange={(e) => handleUpdatePricingItem(item.id, { icon_type: e.target.value as 'dot' | 'check' })} className="text-xs border border-gray-200 rounded px-1 py-0.5">
                                                    <option value="check">Check</option>
                                                    <option value="dot">Dot</option>
                                                  </select>
                                                  <input type="text" defaultValue={item.text} onBlur={(e) => e.target.value !== item.text && handleUpdatePricingItem(item.id, { text: e.target.value })} className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500" />
                                                  <button onClick={() => setShowPricingDeleteConfirm({ type: 'item', id: item.id, name: item.text.slice(0, 30) })} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                  </button>
                                                </div>
                                              ))}
                                              {section.items.length === 0 && <p className="text-xs text-gray-400 italic">No items yet.</p>}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                      {tier.sections.length === 0 && <p className="text-sm text-gray-400 italic py-2">No sections yet.</p>}
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
                        </div>
                      )}

                      {/* Comparison Matrix Sub-tab */}
                      {pricingSubTab === 'comparison' && (
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Comparison Matrix</h3>
                            <button
                              onClick={() => setShowAddComparisonModal(true)}
                              className="bg-yellow-400 text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-yellow-500 flex items-center gap-2"
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
                                      <input type="text" defaultValue={row.feature_name} onBlur={(e) => e.target.value !== row.feature_name && handleUpdatePricingComparisonRow(row.id, { feature_name: e.target.value })} className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500" />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input type="text" defaultValue={row.basic_value} onBlur={(e) => e.target.value !== row.basic_value && handleUpdatePricingComparisonRow(row.id, { basic_value: e.target.value })} className="w-full text-sm text-center border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500" />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input type="text" defaultValue={row.standard_value} onBlur={(e) => e.target.value !== row.standard_value && handleUpdatePricingComparisonRow(row.id, { standard_value: e.target.value })} className="w-full text-sm text-center border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500" />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input type="text" defaultValue={row.gold_value} onBlur={(e) => e.target.value !== row.gold_value && handleUpdatePricingComparisonRow(row.id, { gold_value: e.target.value })} className="w-full text-sm text-center border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500" />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input type="text" defaultValue={row.enterprise_value} onBlur={(e) => e.target.value !== row.enterprise_value && handleUpdatePricingComparisonRow(row.id, { enterprise_value: e.target.value })} className="w-full text-sm text-center border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500" />
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <button onClick={() => setShowPricingDeleteConfirm({ type: 'comparison', id: row.id, name: row.feature_name })} className="text-red-500 hover:text-red-600 p-1">
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
                            <div className="text-center py-12 bg-gray-50 rounded-lg mt-4">
                              <p className="text-gray-500">No comparison rows yet. Click "Add Row" to create one.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Portfolio Tab */}
              {activeTab === 'portfolio' && (
                <div className="space-y-6">
                  {/* Portfolio Header */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Portfolio Management</h2>
                        <p className="text-gray-600 mt-1">Upload and manage your portfolio images and videos</p>
                      </div>
                      <button
                        onClick={() => setShowPortfolioUploadModal(true)}
                        className="bg-yellow-400 text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-yellow-500 flex items-center gap-2 shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Upload Media
                      </button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <svg className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-blue-900">Portfolio Tips</h3>
                          <ul className="mt-2 text-sm text-blue-800 space-y-1 list-disc list-inside">
                            <li>Upload high-quality images (recommended: 1920x1080 or higher)</li>
                            <li>Supported formats: JPG, PNG, GIF, WEBP, MP4, MOV</li>
                            <li>Add descriptions to help with SEO and accessibility</li>
                            <li>Portfolio items appear on your public gallery page</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Portfolio Grid */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                    {isLoadingPortfolio ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (!portfolioData || portfolioData.length === 0) ? (
                      <div className="text-center py-16">
                        <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h3 className="mt-4 text-lg font-semibold text-gray-900">No portfolio items yet</h3>
                        <p className="mt-2 text-gray-600">Get started by uploading your first image or video</p>
                        <button
                          onClick={() => setShowPortfolioUploadModal(true)}
                          className="mt-6 bg-yellow-400 text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-yellow-500"
                        >
                          Upload Your First Media
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {portfolioData.length} Portfolio Item{portfolioData.length !== 1 ? 's' : ''}
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {portfolioData.map((item) => (
                            <div 
                              key={item.id} 
                              className={`group relative rounded-xl overflow-hidden shadow-md border-2 transition-all duration-200 hover:shadow-xl ${
                                item.is_active ? 'border-gray-200' : 'border-red-200 opacity-60'
                              }`}
                            >
                              {/* Media Preview */}
                              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                                {item.image_url?.includes('.mp4') || item.image_url?.includes('.mov') || item.image_url?.includes('.webm') ? (
                                  <video
                                    src={item.image_url}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                  />
                                ) : (
                                  <img
                                    src={item.image_url}
                                    alt={item.alt_text || item.title}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                )}
                                
                                {/* Status Badge */}
                                {!item.is_active && (
                                  <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                    Inactive
                                  </div>
                                )}

                                {/* Video Indicator */}
                                {(item.image_url?.includes('.mp4') || item.image_url?.includes('.mov') || item.image_url?.includes('.webm')) && (
                                  <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M8 5v14l11-7z"/>
                                    </svg>
                                    Video
                                  </div>
                                )}

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => handleOpenPortfolioEdit(item)}
                                      className="p-3 bg-white text-gray-900 rounded-full hover:bg-yellow-400 transition-colors shadow-lg"
                                      title="Edit"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => setShowPortfolioDeleteConfirm(item)}
                                      className="p-3 bg-white text-red-600 rounded-full hover:bg-red-50 transition-colors shadow-lg"
                                      title="Delete"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Info Section */}
                              <div className="p-4">
                                <h4 className="font-semibold text-gray-900 truncate" title={item.title}>
                                  {item.title}
                                </h4>
                                {item.description && (
                                  <p className="text-sm text-gray-600 mt-1 line-clamp-2" title={item.description}>
                                    {item.description}
                                  </p>
                                )}
                                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                  <span className={`px-2 py-1 rounded-full ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {item.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pricing Modals */}
      {/* Add Tier Modal */}
      {showAddTierModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Tier</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={newTier.name} onChange={(e) => setNewTier({ ...newTier, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500" placeholder="e.g., Premium" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                <input type="text" value={newTier.subtitle} onChange={(e) => setNewTier({ ...newTier, subtitle: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500" placeholder="e.g., For growing businesses" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price Label</label>
                <input type="text" value={newTier.price_label} onChange={(e) => setNewTier({ ...newTier, price_label: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500" placeholder="e.g., Custom Quote" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="pricing_is_featured" checked={newTier.is_featured} onChange={(e) => setNewTier({ ...newTier, is_featured: e.target.checked })} className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500" />
                <label htmlFor="pricing_is_featured" className="text-sm text-gray-700">Mark as Featured</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowAddTierModal(false); setNewTier({ name: '', subtitle: '', price_label: '', badge_text: '', is_featured: false }); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleAddPricingTier} disabled={!newTier.name || pricingSaving} className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-500 disabled:opacity-50">{pricingSaving ? 'Creating...' : 'Create Tier'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {showAddSectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Section</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section Title *</label>
              <input type="text" value={newSection.title} onChange={(e) => setNewSection({ title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500" placeholder="e.g., Delivery & Timeline" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowAddSectionModal(null); setNewSection({ title: '' }); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => handleAddPricingSection(showAddSectionModal)} disabled={!newSection.title || pricingSaving} className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-500 disabled:opacity-50">{pricingSaving ? 'Creating...' : 'Create Section'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Item</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Text *</label>
                <input type="text" value={newItem.text} onChange={(e) => setNewItem({ ...newItem, text: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500" placeholder="e.g., Standard delivery (5-7 business days)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon Type</label>
                <select value={newItem.icon_type} onChange={(e) => setNewItem({ ...newItem, icon_type: e.target.value as 'dot' | 'check' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500">
                  <option value="check">Checkmark</option>
                  <option value="dot">Bullet Dot</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowAddItemModal(null); setNewItem({ text: '', icon_type: 'check' }); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => handleAddPricingItem(showAddItemModal)} disabled={!newItem.text || pricingSaving} className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-500 disabled:opacity-50">{pricingSaving ? 'Creating...' : 'Create Item'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Comparison Row Modal */}
      {showAddComparisonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Comparison Row</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Feature Name *</label>
                <input type="text" value={newComparison.feature_name} onChange={(e) => setNewComparison({ ...newComparison, feature_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500" placeholder="e.g., Turnaround Time" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Basic Value</label>
                  <input type="text" value={newComparison.basic_value} onChange={(e) => setNewComparison({ ...newComparison, basic_value: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500" placeholder="e.g., 7-10 days" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Standard Value</label>
                  <input type="text" value={newComparison.standard_value} onChange={(e) => setNewComparison({ ...newComparison, standard_value: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500" placeholder="e.g., 5-7 days" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gold Value</label>
                  <input type="text" value={newComparison.gold_value} onChange={(e) => setNewComparison({ ...newComparison, gold_value: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500" placeholder="e.g., 3-5 days" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enterprise Value</label>
                  <input type="text" value={newComparison.enterprise_value} onChange={(e) => setNewComparison({ ...newComparison, enterprise_value: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500" placeholder="e.g., 1-2 days" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowAddComparisonModal(false); setNewComparison({ feature_name: '', basic_value: '', standard_value: '', gold_value: '', enterprise_value: '' }); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleAddPricingComparisonRow} disabled={!newComparison.feature_name || pricingSaving} className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-500 disabled:opacity-50">{pricingSaving ? 'Creating...' : 'Create Row'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Delete Confirmation Modal */}
      {showPricingDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to delete "{showPricingDeleteConfirm.name}"? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowPricingDeleteConfirm(null)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => {
                  if (showPricingDeleteConfirm.type === 'tier') handleDeletePricingTier(showPricingDeleteConfirm.id);
                  else if (showPricingDeleteConfirm.type === 'section') handleDeletePricingSection(showPricingDeleteConfirm.id);
                  else if (showPricingDeleteConfirm.type === 'item') handleDeletePricingItem(showPricingDeleteConfirm.id);
                  else if (showPricingDeleteConfirm.type === 'comparison') handleDeletePricingComparisonRow(showPricingDeleteConfirm.id);
                }}
                disabled={pricingSaving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {pricingSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Upload Modal */}
      {showPortfolioUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Upload Portfolio Media</h3>
              <button
                onClick={() => {
                  setShowPortfolioUploadModal(false);
                  setPortfolioUploadForm({ title: '', description: '', media_type: 'image' });
                  setPortfolioFile(null);
                  setPortfolioFilePreview(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* File Upload Area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File <span className="text-red-500">*</span>
                </label>
                {!portfolioFilePreview ? (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        PNG, JPG, GIF, WEBP, MP4, MOV (MAX. 50MB)
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,video/*"
                      onChange={handlePortfolioFileChange}
                    />
                  </label>
                ) : (
                  <div className="relative">
                    <div className="w-full h-48 bg-gray-100 rounded-xl overflow-hidden">
                      {portfolioUploadForm.media_type === 'video' ? (
                        <video
                          src={portfolioFilePreview}
                          className="w-full h-full object-cover"
                          controls
                        />
                      ) : (
                        <img
                          src={portfolioFilePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setPortfolioFile(null);
                        setPortfolioFilePreview(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <p className="mt-2 text-sm text-gray-600">
                      {portfolioFile?.name} ({(portfolioFile?.size || 0 / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={portfolioUploadForm.title}
                  onChange={(e) => setPortfolioUploadForm({ ...portfolioUploadForm, title: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all"
                  placeholder="e.g., Corporate Brochure Design"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={portfolioUploadForm.description}
                  onChange={(e) => setPortfolioUploadForm({ ...portfolioUploadForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all resize-none"
                  placeholder="Add a description for this portfolio item..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowPortfolioUploadModal(false);
                  setPortfolioUploadForm({ title: '', description: '', media_type: 'image' });
                  setPortfolioFile(null);
                  setPortfolioFilePreview(null);
                }}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handlePortfolioUpload}
                disabled={!portfolioFile || !portfolioUploadForm.title || uploadingPortfolio}
                className="px-6 py-3 bg-yellow-400 text-gray-900 rounded-lg font-medium hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploadingPortfolio ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Edit Modal */}
      {showPortfolioEditModal && selectedPortfolioItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit Portfolio Item</h3>
              <button
                onClick={() => {
                  setShowPortfolioEditModal(false);
                  setSelectedPortfolioItem(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Preview */}
            <div className="w-full h-48 bg-gray-100 rounded-xl overflow-hidden mb-6">
              {selectedPortfolioItem.image_url?.includes('.mp4') || selectedPortfolioItem.image_url?.includes('.mov') ? (
                <video
                  src={selectedPortfolioItem.image_url}
                  className="w-full h-full object-cover"
                  controls
                />
              ) : (
                <img
                  src={selectedPortfolioItem.image_url}
                  alt={selectedPortfolioItem.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={portfolioEditForm.title}
                  onChange={(e) => setPortfolioEditForm({ ...portfolioEditForm, title: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={portfolioEditForm.description}
                  onChange={(e) => setPortfolioEditForm({ ...portfolioEditForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all resize-none"
                  placeholder="Add a description for this portfolio item..."
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-900">Active Status</label>
                  <p className="text-sm text-gray-500">Item visible on public gallery</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPortfolioEditForm({ ...portfolioEditForm, is_active: !portfolioEditForm.is_active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    portfolioEditForm.is_active ? 'bg-yellow-400' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      portfolioEditForm.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowPortfolioEditModal(false);
                  setSelectedPortfolioItem(null);
                }}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePortfolioEdit}
                disabled={!portfolioEditForm.title}
                className="px-6 py-3 bg-yellow-400 text-gray-900 rounded-lg font-medium hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Delete Confirmation Modal */}
      {showPortfolioDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Portfolio Item</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{showPortfolioDeleteConfirm.title}"? This item will be deactivated and removed from the public gallery.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPortfolioDeleteConfirm(null)}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePortfolioItem}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_ADMIN_Settings;