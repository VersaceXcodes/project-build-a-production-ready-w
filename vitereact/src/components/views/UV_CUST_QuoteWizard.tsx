import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

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

interface Upload {
  id: string;
  owner_user_id: string;
  quote_id: string | null;
  order_id: string | null;
  file_url: string;
  file_type: string;
  file_name: string;
  file_size_bytes: number;
  dpi_warning: boolean;
  created_at: string;
}

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

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===========================
// COMPONENT IMPLEMENTATION
// ===========================

const UV_CUST_QuoteWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Global state access (individual selectors)
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);
  
  // API base URL
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  // Local state
  const [currentStep, setCurrentStep] = useState<number>(parseInt(searchParams.get('step') || '1'));
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [projectDetails, setProjectDetails] = useState<Record<string, any>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Upload[]>([]);
  const [selectedTier, setSelectedTier] = useState<TierPackage | null>(null);
  const [stepValidation, setStepValidation] = useState({
    step_1_valid: false,
    step_2_valid: false,
    step_3_valid: true,
    step_4_valid: false
  });
  const [estimateSubtotal, setEstimateSubtotal] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [showTierComparison, setShowTierComparison] = useState(false);
  const [step2FieldErrors, setStep2FieldErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'warning' | 'info', message: string} | null>(null);

  // Fetch available services for Step 1
  const { data: servicesData, isLoading: isLoadingServices } = useQuery({
    queryKey: ['public-services'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/public/services`, {
        params: { is_active: true }
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Fetch available tiers for Step 4
  const { data: tiersData, isLoading: isLoadingTiers } = useQuery({
    queryKey: ['public-tiers'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/public/tiers`);
      return response.data;
    },
    enabled: currentStep >= 4,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(
        `${API_BASE_URL}/api/uploads`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(prev => ({ ...prev, [file.name]: percent }));
            }
          }
        }
      );
      
      return response.data;
    },
    onSuccess: (upload: Upload) => {
      setUploadedFiles(prev => [...prev, upload]);
      setUploadProgress(prev => {
        const updated = { ...prev };
        delete updated[upload.file_name];
        return updated;
      });
      
      setNotification({
        type: 'success',
        message: `File "${upload.file_name}" uploaded successfully`
      });
      setTimeout(() => setNotification(null), 3000);
    },
    onError: (error: any) => {
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'File upload failed'
      });
      setTimeout(() => setNotification(null), 5000);
    }
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      await axios.delete(`${API_BASE_URL}/api/uploads/${uploadId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      return uploadId;
    },
    onSuccess: (uploadId: string) => {
      setUploadedFiles(prev => prev.filter(f => f.id !== uploadId));
      setNotification({
        type: 'success',
        message: 'File removed successfully'
      });
      setTimeout(() => setNotification(null), 3000);
    }
  });

  // Submit quote mutation
  const submitQuoteMutation = useMutation({
    mutationFn: async (quoteData: any) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/quotes`,
        quoteData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    },
    onSuccess: (response) => {
      // Clear wizard data
      localStorage.removeItem('quote_wizard_draft');
      
      setNotification({
        type: 'success',
        message: "Quote submitted! We'll respond within 24 hours."
      });
      
      setTimeout(() => {
        navigate(`/app/quotes/${response.quote.id}`);
      }, 1500);
    },
    onError: (error: any) => {
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to submit quote'
      });
      setTimeout(() => setNotification(null), 5000);
    }
  });

  // Load wizard data from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('quote_wizard_draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.selected_service) setSelectedService(draft.selected_service);
        if (draft.service_options) setServiceOptions(draft.service_options);
        if (draft.project_details) setProjectDetails(draft.project_details);
        if (draft.uploaded_files) setUploadedFiles(draft.uploaded_files);
        if (draft.selected_tier) setSelectedTier(draft.selected_tier);
        if (draft.step_validation) setStepValidation(draft.step_validation);
      } catch (e) {
        console.error('Failed to restore wizard draft:', e);
      }
    }
  }, []);

  // Save wizard data to localStorage whenever it changes
  useEffect(() => {
    const draftData = {
      selected_service: selectedService,
      service_options: serviceOptions,
      project_details: projectDetails,
      uploaded_files: uploadedFiles,
      selected_tier: selectedTier,
      step_validation: stepValidation
    };
    localStorage.setItem('quote_wizard_draft', JSON.stringify(draftData));
  }, [selectedService, serviceOptions, projectDetails, uploadedFiles, selectedTier, stepValidation]);

  // Update URL when step changes
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('step', currentStep.toString());
    if (selectedService) params.set('service', selectedService.slug);
    if (selectedTier) params.set('tier', selectedTier.id);
    setSearchParams(params);
  }, [currentStep, selectedService, selectedTier, setSearchParams]);

  // Calculate estimate when project details or tier changes
  useEffect(() => {
    if (!serviceOptions.length) return;
    
    let estimate = 0;
    serviceOptions.forEach(option => {
      if (option.pricing_impact && projectDetails[option.key]) {
        try {
          const impact = JSON.parse(option.pricing_impact);
          const answerValue = projectDetails[option.key];
          if (impact[answerValue]) {
            estimate += Number(impact[answerValue]);
          }
        } catch (e) {
          // Invalid pricing_impact JSON, skip
        }
      }
    });
    
    setEstimateSubtotal(estimate > 0 ? estimate : null);
  }, [projectDetails, serviceOptions]);

  // Validate Step 2 whenever project_details changes
  useEffect(() => {
    const requiredOptions = serviceOptions.filter(opt => opt.required);
    const allRequiredFilled = requiredOptions.every(opt => {
      const value = projectDetails[opt.key];
      return value !== undefined && value !== null && value !== '';
    });
    
    setStepValidation(prev => ({ ...prev, step_2_valid: allRequiredFilled }));
  }, [projectDetails, serviceOptions]);

  // Handle service selection
  const handleSelectService = async (service: Service) => {
    setSelectedService(service);
    setStepValidation(prev => ({ ...prev, step_1_valid: true }));
    
    // Fetch service options
    try {
      const response = await axios.get(`${API_BASE_URL}/api/public/services/${service.slug}`);
      setServiceOptions(response.data.service_options || []);
      setCurrentStep(2);
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: 'Failed to load service details'
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Handle project detail changes
  const handleProjectDetailChange = (key: string, value: any) => {
    setProjectDetails(prev => ({ ...prev, [key]: value }));
    setStep2FieldErrors(prev => ({ ...prev, [key]: '' }));
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      // Validate file size
      if (file.size > 50 * 1024 * 1024) {
        setNotification({
          type: 'error',
          message: `File "${file.name}" exceeds 50MB limit`
        });
        setTimeout(() => setNotification(null), 5000);
        return;
      }
      
      // Validate file type
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        setNotification({
          type: 'error',
          message: `File "${file.name}" must be PDF, PNG, or JPEG`
        });
        setTimeout(() => setNotification(null), 5000);
        return;
      }
      
      uploadFileMutation.mutate(file);
    });
  };

  // Handle tier selection
  const handleSelectTier = (tier: TierPackage) => {
    setSelectedTier(tier);
    setStepValidation(prev => ({ ...prev, step_4_valid: true }));
    setCurrentStep(5);
  };

  // Navigate between steps
  const goToStep = (step: number) => {
    // Validate current step before advancing
    if (step > currentStep) {
      if (currentStep === 1 && !stepValidation.step_1_valid) {
        setNotification({
          type: 'warning',
          message: 'Please select a service first'
        });
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      if (currentStep === 2 && !stepValidation.step_2_valid) {
        setNotification({
          type: 'warning',
          message: 'Please complete all required fields'
        });
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      if (currentStep === 4 && !stepValidation.step_4_valid) {
        setNotification({
          type: 'warning',
          message: 'Please select a tier'
        });
        setTimeout(() => setNotification(null), 3000);
        return;
      }
    }
    
    setCurrentStep(step);
    window.scrollTo(0, 0);
  };

  // Submit final quote
  const handleSubmitQuote = () => {
    if (!selectedService || !selectedTier) return;
    
    const quoteData = {
      service_id: selectedService.id,
      tier_id: selectedTier.id,
      project_details: projectDetails,
      file_ids: uploadedFiles.map(f => f.id),
      notes: null
    };
    
    submitQuoteMutation.mutate(quoteData);
  };

  // Get filtered services by category
  const filteredServices = servicesData?.services?.filter((service: Service) => {
    if (!activeCategoryFilter) return true;
    return service.category_id === activeCategoryFilter;
  }) || [];

  // Get unique categories
  const categories = servicesData?.categories || [];

  // Get tier features grouped
  const tierFeaturesByTier = tiersData?.reduce((acc: Record<string, TierFeature[]>, item: any) => {
    acc[item.tier.id] = item.features;
    return acc;
  }, {}) || {};

  return (
    <>
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg animate-slide-in-right ${
          notification.type === 'success' ? 'bg-green-600 text-white' :
          notification.type === 'error' ? 'bg-red-600 text-white' :
          notification.type === 'warning' ? 'bg-yellow-600 text-white' :
          'bg-blue-600 text-white'
        }`}>
          <div className="flex items-center space-x-3">
            {notification.type === 'success' && (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {notification.type === 'error' && (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <p className="font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <Link to="/app" className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">Create Quote</h1>
            <p className="text-gray-600 mt-1">Step {currentStep} of 5</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8 bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3, 4, 5].map((step) => (
                <div key={step} className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step < currentStep ? 'bg-green-600 text-white' :
                    step === currentStep ? 'bg-yellow-400 text-black' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {step < currentStep ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : step}
                  </div>
                  <span className="text-xs text-gray-600 mt-2 hidden sm:block">
                    {step === 1 && 'Service'}
                    {step === 2 && 'Details'}
                    {step === 3 && 'Files'}
                    {step === 4 && 'Tier'}
                    {step === 5 && 'Review'}
                  </span>
                </div>
              ))}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 5) * 100}%` }}
              />
            </div>
          </div>

          {/* Step Content */}
          <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8">
            
            {/* STEP 1: Service Selection */}
            {currentStep === 1 && (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Service</h2>
                <p className="text-gray-600 mb-6">Select the service you need for your project</p>

                {/* Category Filters */}
                <div className="mb-6 flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveCategoryFilter(null)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      !activeCategoryFilter
                        ? 'bg-yellow-400 text-black'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All Services
                  </button>
                  {categories.map((category: ServiceCategory) => (
                    <button
                      key={category.id}
                      onClick={() => setActiveCategoryFilter(category.id)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        activeCategoryFilter === category.id
                          ? 'bg-yellow-400 text-black'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                {/* Services Grid */}
                {isLoadingServices ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="border border-gray-200 rounded-lg p-6 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded mb-4"></div>
                        <div className="h-3 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredServices.map((service: Service) => (
                      <button
                        key={service.id}
                        onClick={() => handleSelectService(service)}
                        className={`border rounded-lg p-6 text-left transition-all hover:shadow-lg ${
                          selectedService?.id === service.id
                            ? 'border-yellow-400 border-2 bg-yellow-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {selectedService?.id === service.id && (
                          <div className="flex justify-end mb-2">
                            <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        <h3 className="font-semibold text-lg text-gray-900 mb-2">{service.name}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2">{service.description || 'Professional service tailored to your needs'}</p>
                      </button>
                    ))}
                  </div>
                )}

                {filteredServices.length === 0 && !isLoadingServices && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No services found in this category</p>
                  </div>
                )}
              </>
            )}

            {/* STEP 2: Project Details */}
            {currentStep === 2 && selectedService && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Project Details</h2>
                    <p className="text-gray-600">For: {selectedService.name}</p>
                  </div>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Change Service
                  </button>
                </div>

                {/* Dynamic Form Fields */}
                <div className="space-y-6">
                  {serviceOptions.sort((a, b) => a.sort_order - b.sort_order).map((option) => (
                    <div key={option.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {option.label}
                        {option.required && <span className="text-yellow-600 ml-1">*</span>}
                      </label>
                      
                      {option.type === 'TEXT' && (
                        <input
                          type="text"
                          value={projectDetails[option.key] || ''}
                          onChange={(e) => handleProjectDetailChange(option.key, e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                          placeholder={option.help_text || `Enter ${option.label.toLowerCase()}`}
                        />
                      )}
                      
                      {option.type === 'NUMBER' && (
                        <input
                          type="number"
                          value={projectDetails[option.key] || ''}
                          onChange={(e) => handleProjectDetailChange(option.key, Number(e.target.value))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                          placeholder={option.help_text || `Enter ${option.label.toLowerCase()}`}
                        />
                      )}
                      
                      {option.type === 'SELECT' && option.choices && (
                        <select
                          value={projectDetails[option.key] || ''}
                          onChange={(e) => handleProjectDetailChange(option.key, e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                        >
                          <option value="">Select {option.label}</option>
                          {JSON.parse(option.choices).map((choice: string) => (
                            <option key={choice} value={choice}>{choice}</option>
                          ))}
                        </select>
                      )}
                      
                      {option.type === 'CHECKBOX' && (
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={projectDetails[option.key] || false}
                            onChange={(e) => handleProjectDetailChange(option.key, e.target.checked)}
                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-gray-700">{option.help_text || option.label}</span>
                        </label>
                      )}
                      
                      {option.help_text && option.type !== 'CHECKBOX' && (
                        <p className="text-sm text-gray-500 mt-1">{option.help_text}</p>
                      )}
                      
                      {step2FieldErrors[option.key] && (
                        <p className="text-sm text-red-600 mt-1">{step2FieldErrors[option.key]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* STEP 3: File Upload */}
            {currentStep === 3 && (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Files</h2>
                <p className="text-gray-600 mb-6">Upload your design files or reference materials</p>

                {/* File Requirements Checklist */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-blue-900 mb-3">File Requirements for Best Results</h3>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start">
                      <span className="mr-2">☐</span>
                      300 DPI minimum resolution
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">☐</span>
                      Correct dimensions for your project
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">☐</span>
                      Fonts outlined (for vector files)
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">☐</span>
                      Bleed included where applicable
                    </li>
                  </ul>
                  <p className="text-xs text-blue-700 mt-3">
                    Don't worry if you're not sure - we'll review and contact you if needed.
                  </p>
                </div>

                {/* Upload Zone */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-yellow-400 transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-600">
                      <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF, PNG, or JPEG up to 50MB</p>
                  </label>
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-6 space-y-3">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <svg className="w-8 h-8 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                            </p>
                            {file.dpi_warning && (
                              <p className="text-xs text-yellow-600 flex items-center mt-1">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                DPI could not be verified
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteFileMutation.mutate(file.id)}
                          disabled={deleteFileMutation.isPending}
                          className="ml-4 text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Progress */}
                {Object.keys(uploadProgress).length > 0 && (
                  <div className="mt-6 space-y-3">
                    {Object.entries(uploadProgress).map(([fileName, progress]) => (
                      <div key={fileName} className="p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-900">{fileName}</p>
                          <p className="text-sm text-gray-600">{progress}%</p>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* STEP 4: Tier Selection */}
            {currentStep === 4 && (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Service Level</h2>
                <p className="text-gray-600 mb-6">Select the tier that best fits your project needs</p>

                {/* Tier Comparison Link */}
                <div className="mb-6 text-center">
                  <button
                    onClick={() => setShowTierComparison(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Compare All Features →
                  </button>
                </div>

                {/* Tier Cards */}
                {isLoadingTiers ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="border border-gray-200 rounded-lg p-6 animate-pulse">
                        <div className="h-6 bg-gray-200 rounded mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {tiersData?.map((tierData: any) => {
                      const tier = tierData.tier;
                      const features = tierData.features;
                      const isSelected = selectedTier?.id === tier.id;
                      
                      return (
                        <button
                          key={tier.id}
                          onClick={() => handleSelectTier(tier)}
                          className={`border rounded-xl p-6 text-left transition-all hover:shadow-xl ${
                            isSelected
                              ? 'border-yellow-400 border-3 bg-yellow-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {isSelected && (
                            <div className="flex justify-end mb-2">
                              <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                          
                          <h3 className="text-xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                          {tier.description && (
                            <p className="text-sm text-gray-600 mb-4">{tier.description}</p>
                          )}
                          
                          <ul className="space-y-2">
                            {features.slice(0, 4).map((feature: TierFeature) => (
                              <li key={feature.id} className="flex items-start text-sm">
                                {feature.is_included ? (
                                  <svg className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                )}
                                <span className="text-gray-700">
                                  {feature.feature_label}: {feature.feature_value || (feature.is_included ? 'Yes' : 'No')}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* STEP 5: Summary */}
            {currentStep === 5 && selectedService && selectedTier && (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Review & Submit</h2>
                <p className="text-gray-600 mb-6">Please review your quote details before submitting</p>

                {/* Service Selected */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">Service Selected</h3>
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="text-lg font-medium text-gray-900">{selectedService.name}</p>
                  {selectedService.description && (
                    <p className="text-sm text-gray-600 mt-1">{selectedService.description}</p>
                  )}
                </div>

                {/* Project Details */}
                {Object.keys(projectDetails).length > 0 && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">Project Details</h3>
                      <button
                        onClick={() => setCurrentStep(2)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Edit
                      </button>
                    </div>
                    <dl className="space-y-2">
                      {serviceOptions.map(option => {
                        const value = projectDetails[option.key];
                        if (value === undefined || value === null || value === '') return null;
                        
                        return (
                          <div key={option.key} className="flex justify-between text-sm">
                            <dt className="text-gray-600">{option.label}:</dt>
                            <dd className="text-gray-900 font-medium">
                              {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                )}

                {/* Files Uploaded */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">Files Uploaded</h3>
                    <button
                      onClick={() => setCurrentStep(3)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">{uploadedFiles.length} file(s) uploaded</p>
                  {uploadedFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {uploadedFiles.map(file => (
                        <li key={file.id} className="text-sm text-gray-700">• {file.file_name}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Tier Selected */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">Tier Selected</h3>
                    <button
                      onClick={() => setCurrentStep(4)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="text-lg font-medium text-gray-900">{selectedTier.name}</p>
                  {selectedTier.description && (
                    <p className="text-sm text-gray-600 mt-1">{selectedTier.description}</p>
                  )}
                </div>

                {/* Pricing Estimate */}
                <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-3">Estimated Investment</h3>
                  {estimateSubtotal ? (
                    <p className="text-2xl font-bold text-blue-900">€{estimateSubtotal.toFixed(2)} - €{(estimateSubtotal * 1.2).toFixed(2)}</p>
                  ) : (
                    <p className="text-lg font-medium text-blue-900">Custom pricing - we'll finalize within 24 hours</p>
                  )}
                  <p className="text-xs text-blue-700 mt-2">Prices exclude 23% VAT</p>
                </div>

                {/* Disclaimer */}
                <div className="mb-6 p-4 bg-gray-100 rounded-lg">
                  <p className="text-xs text-gray-600">
                    This is an estimate based on the information provided. Our team will review your requirements and provide a final quote within 24 hours. You'll receive an email with next steps.
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmitQuote}
                  disabled={submitQuoteMutation.isPending}
                  className="w-full bg-yellow-400 text-black px-6 py-4 rounded-lg font-semibold text-lg hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  {submitQuoteMutation.isPending ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting Quote...
                    </span>
                  ) : (
                    'Submit Quote Request'
                  )}
                </button>
              </>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => goToStep(currentStep - 1)}
              disabled={currentStep === 1}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Back
            </button>
            
            {currentStep < 5 && (
              <button
                onClick={() => goToStep(currentStep + 1)}
                className="px-6 py-3 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-all shadow-lg hover:shadow-xl"
              >
                {currentStep === 3 ? 'Continue' : 'Next'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tier Comparison Modal */}
      {showTierComparison && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={() => setShowTierComparison(false)}>
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Compare All Tiers</h2>
              <button
                onClick={() => setShowTierComparison(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Desktop: Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Feature</th>
                    {tiersData?.map((tierData: any) => (
                      <th key={tierData.tier.id} className="text-center py-3 px-4 font-semibold text-gray-900">
                        {tierData.tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tiersData && tiersData.length > 0 && (() => {
                    const allFeatureKeys = new Set<string>();
                    tiersData.forEach((tierData: any) => {
                      tierData.features.forEach((f: TierFeature) => {
                        allFeatureKeys.add(f.feature_key);
                      });
                    });
                    
                    return Array.from(allFeatureKeys).map(featureKey => {
                      const firstTierFeature = tiersData[0].features.find((f: TierFeature) => f.feature_key === featureKey);
                      if (!firstTierFeature) return null;
                      
                      return (
                        <tr key={featureKey} className="border-b border-gray-100">
                          <td className="py-3 px-4 text-sm text-gray-700">{firstTierFeature.feature_label}</td>
                          {tiersData.map((tierData: any) => {
                            const feature = tierData.features.find((f: TierFeature) => f.feature_key === featureKey);
                            return (
                              <td key={tierData.tier.id} className="py-3 px-4 text-center text-sm">
                                {feature?.is_included ? (
                                  <span className="text-green-600 font-medium">
                                    {feature.feature_value || '✓'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">✗</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Mobile: Accordion View */}
            <div className="md:hidden space-y-4">
              {tiersData?.map((tierData: any) => (
                <div key={tierData.tier.id} className="border border-gray-200 rounded-lg">
                  <button
                    className="w-full px-4 py-3 flex items-center justify-between text-left"
                    onClick={(e) => {
                      const content = e.currentTarget.nextElementSibling;
                      if (content) {
                        content.classList.toggle('hidden');
                      }
                    }}
                  >
                    <span className="font-semibold text-gray-900">{tierData.tier.name}</span>
                    <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div className="hidden px-4 pb-4">
                    <ul className="space-y-2">
                      {tierData.features.map((feature: TierFeature) => (
                        <li key={feature.id} className="flex items-start text-sm">
                          {feature.is_included ? (
                            <svg className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span className="text-gray-700">
                            {feature.feature_label}: {feature.feature_value || (feature.is_included ? 'Yes' : 'No')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_CUST_QuoteWizard;