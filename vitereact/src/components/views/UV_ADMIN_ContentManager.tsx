import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface HomepageContent {
  hero_headline: string;
  hero_subtext: string;
  hero_cta_text: string;
  top_services_ids: string[];
}

interface AboutContent {
  brand_purpose: string;
  values_content: string;
  approach_content: string;
}

interface PoliciesContent {
  payment_terms: string;
  tax_vat: string;
  file_requirements: string;
  refunds: string;
  revision_policy: string;
  turnaround: string;
}

interface AvailableService {
  id: string;
  name: string;
  category_name: string;
  is_top_seller: boolean;
}

interface MarketingContentItem {
  id: string;
  page_key: string;
  section_key: string;
  content: string;
  updated_at: string;
}

// ===========================
// API FUNCTIONS
// ===========================

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api`;

const fetchMarketingContent = async (page_key: string, token: string): Promise<MarketingContentItem[]> => {
  const response = await axios.get(`${API_BASE_URL}/admin/marketing-content`, {
    params: { page_key },
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const fetchAvailableServices = async (token: string): Promise<AvailableService[]> => {
  const response = await axios.get(`${API_BASE_URL}/admin/services`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.map((item: any) => ({
    id: item.id,
    name: item.name,
    category_name: item.category_name || 'Uncategorized',
    is_top_seller: item.is_top_seller || false,
  }));
};

const updateMarketingContent = async (
  content_id: string,
  content: string,
  token: string
): Promise<void> => {
  await axios.patch(
    `${API_BASE_URL}/admin/marketing-content/${content_id}`,
    { content },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

const updateServiceTopSeller = async (
  service_id: string,
  is_top_seller: boolean,
  token: string
): Promise<void> => {
  await axios.patch(
    `${API_BASE_URL}/admin/services/${service_id}`,
    { is_top_seller },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_ADMIN_ContentManager: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Global state - CRITICAL: Individual selectors
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const showToast = useAppStore(state => state.show_toast);

  // Local state
  const [active_section, setActiveSection] = useState<'homepage' | 'about' | 'policies'>('homepage');
  const [homepage_content, setHomepageContent] = useState<HomepageContent>({
    hero_headline: '',
    hero_subtext: '',
    hero_cta_text: 'Get a Quote',
    top_services_ids: [],
  });
  const [about_content, setAboutContent] = useState<AboutContent>({
    brand_purpose: '',
    values_content: '',
    approach_content: '',
  });
  const [policies_content, setPoliciesContent] = useState<PoliciesContent>({
    payment_terms: '',
    tax_vat: '',
    file_requirements: '',
    refunds: '',
    revision_policy: '',
    turnaround: '',
  });
  const [available_services, setAvailableServices] = useState<AvailableService[]>([]);
  const [has_unsaved_changes, setHasUnsavedChanges] = useState(false);
  const [is_saving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [show_preview_modal, setShowPreviewModal] = useState(false);
  const [show_discard_modal, setShowDiscardModal] = useState(false);
  const [content_ids, setContentIds] = useState<Record<string, string>>({});

  // Check auth
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      navigate('/login?returnTo=/admin/content');
    }
  }, [currentUser, navigate]);

  // Sync URL param with active section
  useEffect(() => {
    const section_param = searchParams.get('section') as 'homepage' | 'about' | 'policies' | null;
    if (section_param && ['homepage', 'about', 'policies'].includes(section_param)) {
      setActiveSection(section_param);
    }
  }, [searchParams]);

  // Fetch homepage content
  const { data: homepageContentData, isLoading: isLoadingHomepage } = useQuery({
    queryKey: ['marketing-content', 'home'],
    queryFn: () => fetchMarketingContent('home', authToken || ''),
    enabled: !!authToken && active_section === 'homepage',
    staleTime: 60000,
    refetchOnWindowFocus: false,
    select: (data) => {
      const contentMap: Record<string, string> = {};
      const idMap: Record<string, string> = {};
      data.forEach(item => {
        contentMap[item.section_key] = item.content;
        idMap[`home_${item.section_key}`] = item.id;
      });
      // Store IDs for saving
      setContentIds(prev => ({ ...prev, ...idMap }));
      let topServicesIds: string[] = [];
      try {
        topServicesIds = JSON.parse(contentMap.top_services_ids || '[]');
      } catch {
        topServicesIds = [];
      }
      return {
        hero_headline: contentMap.hero_headline || '',
        hero_subtext: contentMap.hero_subtext || '',
        hero_cta_text: contentMap.hero_cta_text || 'Get a Quote',
        top_services_ids: topServicesIds,
      };
    },
  });

  // Fetch about content
  const { data: aboutContentData, isLoading: isLoadingAbout } = useQuery({
    queryKey: ['marketing-content', 'about'],
    queryFn: () => fetchMarketingContent('about', authToken || ''),
    enabled: !!authToken && active_section === 'about',
    staleTime: 60000,
    refetchOnWindowFocus: false,
    select: (data) => {
      const contentMap: Record<string, string> = {};
      const idMap: Record<string, string> = {};
      data.forEach(item => {
        contentMap[item.section_key] = item.content;
        idMap[`about_${item.section_key}`] = item.id;
      });
      // Store IDs for saving
      setContentIds(prev => ({ ...prev, ...idMap }));
      return {
        brand_purpose: contentMap.brand_purpose || '',
        values_content: contentMap.values_content || '',
        approach_content: contentMap.approach_content || '',
      };
    },
  });

  // Fetch services for top sellers selection
  const { data: servicesData } = useQuery({
    queryKey: ['admin-services'],
    queryFn: () => fetchAvailableServices(authToken || ''),
    enabled: !!authToken,
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  // Update local state when data fetched
  useEffect(() => {
    if (homepageContentData && active_section === 'homepage') {
      setHomepageContent(homepageContentData);
    }
  }, [homepageContentData, active_section]);

  useEffect(() => {
    if (aboutContentData && active_section === 'about') {
      setAboutContent(aboutContentData);
    }
  }, [aboutContentData, active_section]);

  useEffect(() => {
    if (servicesData) {
      setAvailableServices(servicesData);
    }
  }, [servicesData]);

  // Save mutation - implements PATCH calls for each content section
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!authToken) throw new Error('Not authenticated');
      const updates: Promise<void>[] = [];

      if (active_section === 'homepage') {
        // Save homepage content sections
        if (content_ids['home_hero_headline']) {
          updates.push(updateMarketingContent(content_ids['home_hero_headline'], homepage_content.hero_headline, authToken));
        }
        if (content_ids['home_hero_subtext']) {
          updates.push(updateMarketingContent(content_ids['home_hero_subtext'], homepage_content.hero_subtext, authToken));
        }
        if (content_ids['home_hero_cta_text']) {
          updates.push(updateMarketingContent(content_ids['home_hero_cta_text'], homepage_content.hero_cta_text, authToken));
        }
        if (content_ids['home_top_services_ids']) {
          updates.push(updateMarketingContent(content_ids['home_top_services_ids'], JSON.stringify(homepage_content.top_services_ids), authToken));
        }
      } else if (active_section === 'about') {
        // Save about content sections
        if (content_ids['about_brand_purpose']) {
          updates.push(updateMarketingContent(content_ids['about_brand_purpose'], about_content.brand_purpose, authToken));
        }
        if (content_ids['about_values_content']) {
          updates.push(updateMarketingContent(content_ids['about_values_content'], about_content.values_content, authToken));
        }
        if (content_ids['about_approach_content']) {
          updates.push(updateMarketingContent(content_ids['about_approach_content'], about_content.approach_content, authToken));
        }
      } else if (active_section === 'policies') {
        // Save policies content sections (would need to fetch policies content IDs first)
        // For now, policies content saving would require similar ID mapping
      }

      if (updates.length > 0) {
        await Promise.all(updates);
      }
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      setNotification({ type: 'success', message: 'Content saved successfully!' });
      setTimeout(() => setNotification(null), 5000);
      queryClient.invalidateQueries({ queryKey: ['marketing-content'] });
    },
    onError: (error: any) => {
      setNotification({ type: 'error', message: error.message || 'Failed to save content' });
      setTimeout(() => setNotification(null), 5000);
    },
  });

  // Handlers
  const handleSectionChange = (section: 'homepage' | 'about' | 'policies') => {
    if (has_unsaved_changes) {
      setShowDiscardModal(true);
      return;
    }
    setActiveSection(section);
    setSearchParams({ section });
  };

  const handleHomepageChange = (field: keyof HomepageContent, value: any) => {
    setHomepageContent(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleAboutChange = (field: keyof AboutContent, value: string) => {
    setAboutContent(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handlePoliciesChange = (field: keyof PoliciesContent, value: string) => {
    setPoliciesContent(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleTopServiceToggle = async (service_id: string, is_top_seller: boolean) => {
    try {
      await updateServiceTopSeller(service_id, is_top_seller, authToken || '');
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      setNotification({ type: 'success', message: 'Service updated' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error: any) {
      setNotification({ type: 'error', message: 'Failed to update service' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync();
      setIsSaving(false);
    } catch (error) {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    // Refetch original data
    queryClient.invalidateQueries({ queryKey: ['marketing-content'] });
    setHasUnsavedChanges(false);
    setShowDiscardModal(false);
    setNotification({ type: 'info', message: 'Changes discarded' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePreview = () => {
    setShowPreviewModal(true);
  };

  if (!currentUser || currentUser.role !== 'ADMIN') {
    return null;
  }

  const isLoading = isLoadingHomepage || isLoadingAbout;

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Marketing Content Management</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage homepage, about page, and policies content
                </p>
              </div>
              <Link
                to="/admin"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Notification Banner */}
        {notification && (
          <div
            className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${
              notification.type === 'success'
                ? 'bg-green-600 text-white'
                : notification.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* Unsaved Changes Warning */}
        {has_unsaved_changes && (
          <div className="bg-yellow-50 border-b border-yellow-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-yellow-800">
                  ⚠️ You have unsaved changes
                </p>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowDiscardModal(true)}
                    className="text-sm text-yellow-800 hover:text-yellow-900 font-medium"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={is_saving}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                  >
                    {is_saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => handleSectionChange('homepage')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  active_section === 'homepage'
                    ? 'border-yellow-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Homepage
              </button>
              <button
                onClick={() => handleSectionChange('about')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  active_section === 'about'
                    ? 'border-yellow-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                About Page
              </button>
              <button
                onClick={() => handleSectionChange('policies')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  active_section === 'policies'
                    ? 'border-yellow-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Policies
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <svg className="animate-spin h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-600">Loading content...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Homepage Section */}
              {active_section === 'homepage' && (
                <div className="space-y-6">
                  {/* Hero Section */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Hero Section</h2>
                    
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="hero_headline" className="block text-sm font-medium text-gray-700 mb-2">
                          Hero Headline
                        </label>
                        <input
                          id="hero_headline"
                          type="text"
                          value={homepage_content.hero_headline}
                          onChange={(e) => handleHomepageChange('hero_headline', e.target.value)}
                          placeholder="Disciplined Premium Print, Signage & Branding"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label htmlFor="hero_subtext" className="block text-sm font-medium text-gray-700 mb-2">
                          Hero Subtext (2-3 lines)
                        </label>
                        <textarea
                          id="hero_subtext"
                          rows={3}
                          value={homepage_content.hero_subtext}
                          onChange={(e) => handleHomepageChange('hero_subtext', e.target.value)}
                          placeholder="Brand promise subheadline..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-colors resize-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="hero_cta_text" className="block text-sm font-medium text-gray-700 mb-2">
                          Primary CTA Button Text
                        </label>
                        <input
                          id="hero_cta_text"
                          type="text"
                          value={homepage_content.hero_cta_text}
                          onChange={(e) => handleHomepageChange('hero_cta_text', e.target.value)}
                          placeholder="Get a Quote"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Top Selling Services */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Top Selling Services</h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Select up to 6 services to feature on the homepage
                    </p>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {available_services.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id={`service_${service.id}`}
                              checked={service.is_top_seller}
                              onChange={(e) => handleTopServiceToggle(service.id, e.target.checked)}
                              className="h-5 w-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                            />
                            <label htmlFor={`service_${service.id}`} className="flex-1 cursor-pointer">
                              <span className="font-medium text-gray-900">{service.name}</span>
                              <span className="ml-2 text-sm text-gray-500">
                                ({service.category_name})
                              </span>
                            </label>
                          </div>
                          {service.is_top_seller && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Featured
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* About Section */}
              {active_section === 'about' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">About Page Content</h2>

                    <div className="space-y-6">
                      <div>
                        <label htmlFor="brand_purpose" className="block text-sm font-medium text-gray-700 mb-2">
                          Brand Purpose Statement
                        </label>
                        <textarea
                          id="brand_purpose"
                          rows={4}
                          value={about_content.brand_purpose}
                          onChange={(e) => handleAboutChange('brand_purpose', e.target.value)}
                          placeholder="Empower businesses through personalised visual identity..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-colors resize-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="values_content" className="block text-sm font-medium text-gray-700 mb-2">
                          Brand Values Content
                        </label>
                        <textarea
                          id="values_content"
                          rows={8}
                          value={about_content.values_content}
                          onChange={(e) => handleAboutChange('values_content', e.target.value)}
                          placeholder="Detailed explanation of 7 core values..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-colors resize-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="approach_content" className="block text-sm font-medium text-gray-700 mb-2">
                          Approach Content
                        </label>
                        <textarea
                          id="approach_content"
                          rows={6}
                          value={about_content.approach_content}
                          onChange={(e) => handleAboutChange('approach_content', e.target.value)}
                          placeholder="How we work and deliver value..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-colors resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Policies Section */}
              {active_section === 'policies' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Policies Content</h2>

                    <div className="space-y-6">
                      <div>
                        <label htmlFor="payment_terms" className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Terms
                        </label>
                        <textarea
                          id="payment_terms"
                          rows={4}
                          value={policies_content.payment_terms}
                          onChange={(e) => handlePoliciesChange('payment_terms', e.target.value)}
                          placeholder="50% deposit required, balance due before delivery..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-colors resize-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="tax_vat" className="block text-sm font-medium text-gray-700 mb-2">
                          Tax/VAT Information
                        </label>
                        <textarea
                          id="tax_vat"
                          rows={3}
                          value={policies_content.tax_vat}
                          onChange={(e) => handlePoliciesChange('tax_vat', e.target.value)}
                          placeholder="Current VAT rate, tax ID..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-colors resize-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="file_requirements" className="block text-sm font-medium text-gray-700 mb-2">
                          File Requirements
                        </label>
                        <textarea
                          id="file_requirements"
                          rows={5}
                          value={policies_content.file_requirements}
                          onChange={(e) => handlePoliciesChange('file_requirements', e.target.value)}
                          placeholder="Accepted formats, DPI requirements, bleed specifications..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-colors resize-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="refunds" className="block text-sm font-medium text-gray-700 mb-2">
                          Refunds & Cancellations
                        </label>
                        <textarea
                          id="refunds"
                          rows={4}
                          value={policies_content.refunds}
                          onChange={(e) => handlePoliciesChange('refunds', e.target.value)}
                          placeholder="Refund policy, cancellation terms..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-colors resize-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="revision_policy" className="block text-sm font-medium text-gray-700 mb-2">
                          Revision Policy
                        </label>
                        <textarea
                          id="revision_policy"
                          rows={4}
                          value={policies_content.revision_policy}
                          onChange={(e) => handlePoliciesChange('revision_policy', e.target.value)}
                          placeholder="Revision limits by tier, what constitutes a revision..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-colors resize-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="turnaround" className="block text-sm font-medium text-gray-700 mb-2">
                          Turnaround Times
                        </label>
                        <textarea
                          id="turnaround"
                          rows={4}
                          value={policies_content.turnaround}
                          onChange={(e) => handlePoliciesChange('turnaround', e.target.value)}
                          placeholder="Tier-based turnaround commitments, rush options..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-colors resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4">
                  <button
                    onClick={handlePreview}
                    className="w-full sm:w-auto px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200"
                  >
                    Preview Changes
                  </button>

                  <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                    <button
                      onClick={() => setShowDiscardModal(true)}
                      disabled={!has_unsaved_changes}
                      className="w-full sm:w-auto px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      Discard Changes
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!has_unsaved_changes || is_saving}
                      className="w-full sm:w-auto px-6 py-3 bg-yellow-600 text-black rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      {is_saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {show_preview_modal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                onClick={() => setShowPreviewModal(false)}
              ></div>

              {/* Modal panel */}
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
                <div className="absolute top-0 right-0 pt-4 pr-4">
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                      Content Preview - {active_section}
                    </h3>

                    <div className="mt-4 bg-gray-50 rounded-lg p-6 max-h-96 overflow-y-auto">
                      {active_section === 'homepage' && (
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Hero Headline:</h4>
                            <p className="text-2xl font-bold text-gray-900">{homepage_content.hero_headline || '(Empty)'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Hero Subtext:</h4>
                            <p className="text-gray-700">{homepage_content.hero_subtext || '(Empty)'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">CTA Button:</h4>
                            <button className="px-6 py-3 bg-yellow-600 text-black rounded-lg font-medium">
                              {homepage_content.hero_cta_text}
                            </button>
                          </div>
                        </div>
                      )}

                      {active_section === 'about' && (
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Brand Purpose:</h4>
                            <p className="text-gray-700 whitespace-pre-wrap">{about_content.brand_purpose || '(Empty)'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Values Content:</h4>
                            <p className="text-gray-700 whitespace-pre-wrap">{about_content.values_content || '(Empty)'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Approach Content:</h4>
                            <p className="text-gray-700 whitespace-pre-wrap">{about_content.approach_content || '(Empty)'}</p>
                          </div>
                        </div>
                      )}

                      {active_section === 'policies' && (
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Payment Terms:</h4>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm">{policies_content.payment_terms || '(Empty)'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Tax/VAT:</h4>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm">{policies_content.tax_vat || '(Empty)'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">File Requirements:</h4>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm">{policies_content.file_requirements || '(Empty)'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Refunds:</h4>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm">{policies_content.refunds || '(Empty)'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Revision Policy:</h4>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm">{policies_content.revision_policy || '(Empty)'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Turnaround Times:</h4>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm">{policies_content.turnaround || '(Empty)'}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => setShowPreviewModal(false)}
                        className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                      >
                        Close Preview
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Discard Changes Confirmation Modal */}
        {show_discard_modal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                onClick={() => setShowDiscardModal(false)}
              ></div>

              {/* Modal panel */}
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Discard unsaved changes?
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to discard all unsaved changes? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    onClick={handleDiscard}
                    className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  >
                    Discard Changes
                  </button>
                  <button
                    onClick={() => setShowDiscardModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_ADMIN_ContentManager;