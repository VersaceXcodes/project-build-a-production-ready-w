import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/store/main';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Service {
  id: string;
  name: string;
  slug: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  service_interested_in: string;
  message: string;
  honeypot: string; // Spam protection
}

interface FormErrors {
  name: string | null;
  email: string | null;
  phone: string | null;
  service_interested_in: string | null;
  message: string | null;
  general: string | null;
}

interface ContactInquiryPayload {
  name: string;
  email: string;
  phone: string | null;
  service_interested_in: string | null;
  message: string;
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchServicesForDropdown = async (): Promise<Service[]> => {
  const response = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/public/services`,
    {
      params: { is_active: true },
    }
  );
  
  // Map to only what we need for dropdown
  return response.data.services.map((service: any) => ({
    id: service.id,
    name: service.name,
    slug: service.slug,
  }));
};

const submitContactInquiry = async (payload: ContactInquiryPayload): Promise<void> => {
  await axios.post(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/public/contact-inquiry`,
    payload,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_Contact: React.FC = () => {
  // Global state actions (individual selectors to prevent infinite loops)
  const showToast = useAppStore(state => state.show_toast);

  // Local state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    service_interested_in: '',
    message: '',
    honeypot: '', // Spam protection - should always be empty
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({
    name: null,
    email: null,
    phone: null,
    service_interested_in: null,
    message: null,
    general: null,
  });

  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Fetch services for dropdown
  const {
    data: availableServices,
    isLoading: isLoadingServices,
    error: servicesError,
  } = useQuery({
    queryKey: ['services-dropdown'],
    queryFn: fetchServicesForDropdown,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Submit inquiry mutation
  const submitMutation = useMutation({
    mutationFn: submitContactInquiry,
    onSuccess: () => {
      setSubmissionSuccess(true);
      
      // Clear form
      setFormData({
        name: '',
        email: '',
        phone: '',
        service_interested_in: '',
        message: '',
        honeypot: '',
      });
      
      // Clear errors
      setFormErrors({
        name: null,
        email: null,
        phone: null,
        service_interested_in: null,
        message: null,
        general: null,
      });
      
      // Show success toast
      showToast({
        type: 'success',
        message: 'Thank you! We\'ll respond within 24 hours.',
        duration: 5000,
      });
      
      // Auto-hide success message after 10 seconds
      setTimeout(() => {
        setSubmissionSuccess(false);
      }, 10000);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to submit inquiry';
      
      setFormErrors(prev => ({
        ...prev,
        general: errorMessage,
      }));
      
      showToast({
        type: 'error',
        message: 'Failed to submit inquiry. Please try again.',
        duration: 5000,
      });
    },
  });

  // Show error toast if services fetch fails
  useEffect(() => {
    if (servicesError) {
      showToast({
        type: 'error',
        message: 'Failed to load services. Please refresh the page.',
        duration: 5000,
      });
    }
  }, [servicesError, showToast]);

  // ===========================
  // FORM HANDLERS
  // ===========================

  const handleFormFieldChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Clear error for this field
    setFormErrors(prev => ({
      ...prev,
      [field]: null,
      general: null, // Clear general error too
    }));
  };

  const validateFormField = (field: keyof FormData): string | null => {
    const value = formData[field];
    
    switch (field) {
      case 'name':
        if (!value || value.trim().length === 0) {
          return 'Name is required';
        }
        return null;
        
      case 'email': {
        if (!value || value.trim().length === 0) {
          return 'Email is required';
        }
        // Simple email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Please enter a valid email address';
        }
        return null;
      }
        
      case 'service_interested_in':
        if (!value || value === '') {
          return 'Please select a service';
        }
        return null;
        
      case 'message':
        if (!value || value.trim().length === 0) {
          return 'Message is required';
        }
        if (value.trim().length < 10) {
          return 'Message must be at least 10 characters';
        }
        return null;
        
      default:
        return null;
    }
  };

  const handleFieldBlur = (field: keyof FormData) => {
    const error = validateFormField(field);
    setFormErrors(prev => ({
      ...prev,
      [field]: error,
    }));
  };

  const validateAllFields = (): boolean => {
    const errors: FormErrors = {
      name: validateFormField('name'),
      email: validateFormField('email'),
      phone: null, // Optional field
      service_interested_in: validateFormField('service_interested_in'),
      message: validateFormField('message'),
      general: null,
    };
    
    setFormErrors(errors);
    
    // Check if any errors exist
    return !Object.values(errors).some(error => error !== null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Spam protection: Check honeypot
    if (formData.honeypot && formData.honeypot.length > 0) {
      // Bot detected - pretend success but don't submit
      setSubmissionSuccess(true);
      showToast({
        type: 'success',
        message: 'Thank you! We\'ll respond within 24 hours.',
        duration: 5000,
      });
      return;
    }
    
    // Validate all fields
    if (!validateAllFields()) {
      showToast({
        type: 'error',
        message: 'Please fix the errors in the form',
        duration: 3000,
      });
      return;
    }
    
    // Prepare payload
    const payload: ContactInquiryPayload = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim() || null,
      service_interested_in: formData.service_interested_in || null,
      message: formData.message.trim(),
    };
    
    // Submit
    submitMutation.mutate(payload);
  };

  // ===========================
  // EXTERNAL ACTION HANDLERS
  // ===========================

  const openWhatsAppChat = () => {
    window.open('https://wa.me/353874700356', '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Hero Section */}
        <div className="bg-white border-b-2 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-4">
                Let's Talk About Your Project
              </h1>
              <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
                Get in touch with us through WhatsApp, email, or submit an inquiry below. We typically respond within 24 hours.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Left Column - Contact Information */}
            <div className="space-y-8">
              {/* WhatsApp CTA - Most Prominent */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Connect with us
                </h2>
                
                <button
                  onClick={openWhatsAppChat}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-3 text-lg"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span>Message us on WhatsApp</span>
                </button>
                
                <div className="mt-8 space-y-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-6 h-6 text-gray-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Email</p>
                      <a
                        href="mailto:info@sultanstamp.com"
                        className="text-lg font-medium text-gray-900 hover:text-yellow-600 transition-colors"
                      >
                        info@sultanstamp.com
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <svg className="w-6 h-6 text-gray-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Phone</p>
                      <a
                        href="tel:+353874700356"
                        className="text-lg font-medium text-gray-900 hover:text-yellow-600 transition-colors"
                      >
                        +353 87 470 0356
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Media Links */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Follow Us</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <a
                    href="https://linktr.ee/Sultanstamp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all duration-200 hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7.953 15.066c-.08.163-.08.324-.08.486.08.517.528.897 1.052.89a1.074 1.074 0 001.052-.89c0-.163 0-.324-.08-.486l-1.97-4.102-1.97 4.102zm12.04-9.482l-7.977 16.482a.962.962 0 01-.862.523.962.962 0 01-.862-.523L.308 5.584a1.074 1.074 0 011.052-1.474H22.64c.608 0 1.052.73.862 1.474z"/>
                    </svg>
                    <span className="font-medium">Linktree</span>
                  </a>
                  
                  <a
                    href="https://www.instagram.com/sultanstamp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-br from-purple-600 to-pink-500 text-white rounded-lg hover:from-purple-700 hover:to-pink-600 transition-all duration-200 hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                    <span className="font-medium">Instagram</span>
                  </a>
                  
                  <a
                    href="https://www.linkedin.com/company/sultanstamp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    <span className="font-medium">LinkedIn</span>
                  </a>
                  
                  <a
                    href="https://www.tiktok.com/@sultanstamp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-all duration-200 hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                    </svg>
                    <span className="font-medium">TikTok</span>
                  </a>
                  
                  <a
                    href="https://www.facebook.com/sultanstamp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span className="font-medium">Facebook</span>
                  </a>
                </div>
              </div>

              {/* Business Hours & Additional Info */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Business Hours</h3>
                <div className="space-y-2 text-gray-600">
                  <div className="flex justify-between">
                    <span className="font-medium">Monday - Friday:</span>
                    <span>9:00 AM - 6:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Saturday:</span>
                    <span>10:00 AM - 4:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Sunday:</span>
                    <span>Closed</span>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    <strong className="text-gray-900">Emergency bookings available:</strong> We offer emergency bookings outside regular hours for urgent projects (+20% urgent fee applies).
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - Inquiry Form */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Send us an inquiry</h2>
              
              {submissionSuccess ? (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
                  <svg className="w-16 h-16 text-green-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-xl font-bold text-green-900 mb-2">Message Sent!</h3>
                  <p className="text-green-700 mb-4">
                    Thank you! We'll respond within 24 hours.
                  </p>
                  <button
                    onClick={() => setSubmissionSuccess(false)}
                    className="text-green-600 hover:text-green-700 font-medium text-sm underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* General Error Message */}
                  {formErrors.general && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      <p className="text-sm font-medium">{formErrors.general}</p>
                    </div>
                  )}
                  
                  {/* Honeypot - Hidden spam protection */}
                  <div style={{ position: 'absolute', left: '-9999px', opacity: 0 }} aria-hidden="true">
                    <label htmlFor="honeypot">Leave this field empty</label>
                    <input
                      id="honeypot"
                      name="honeypot"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={formData.honeypot}
                      onChange={(e) => setFormData(prev => ({ ...prev, honeypot: e.target.value }))}
                    />
                  </div>
                  
                  {/* Name Field */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Name <span className="text-yellow-600">*</span>
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleFormFieldChange('name', e.target.value)}
                      onBlur={() => handleFieldBlur('name')}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 text-base ${
                        formErrors.name
                          ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                          : 'border-gray-200 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100'
                      }`}
                      placeholder="Your full name"
                    />
                    {formErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                    )}
                  </div>
                  
                  {/* Email Field */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email <span className="text-yellow-600">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => handleFormFieldChange('email', e.target.value)}
                      onBlur={() => handleFieldBlur('email')}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 text-base ${
                        formErrors.email
                          ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                          : 'border-gray-200 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100'
                      }`}
                      placeholder="your.email@example.com"
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                    )}
                  </div>
                  
                  {/* Phone Field (Optional) */}
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone <span className="text-gray-400 text-xs">(optional)</span>
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleFormFieldChange('phone', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 transition-all duration-200 text-base"
                      placeholder="+353 87 470 0356"
                    />
                  </div>
                  
                  {/* Service Interested In Dropdown */}
                  <div>
                    <label htmlFor="service_interested_in" className="block text-sm font-medium text-gray-700 mb-2">
                      Service Interested In <span className="text-yellow-600">*</span>
                    </label>
                    
                    {isLoadingServices ? (
                      <div className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-gray-50 flex items-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-gray-500 text-sm">Loading services...</span>
                      </div>
                    ) : (
                      <select
                        id="service_interested_in"
                        name="service_interested_in"
                        required
                        value={formData.service_interested_in}
                        onChange={(e) => handleFormFieldChange('service_interested_in', e.target.value)}
                        onBlur={() => handleFieldBlur('service_interested_in')}
                        className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 text-base ${
                          formErrors.service_interested_in
                            ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                            : 'border-gray-200 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100'
                        }`}
                      >
                        <option value="">Select a service...</option>
                        {availableServices?.map((service) => (
                          <option key={service.id} value={service.slug}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    )}
                    
                    {formErrors.service_interested_in && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.service_interested_in}</p>
                    )}
                  </div>
                  
                  {/* Message Field */}
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                      Message <span className="text-yellow-600">*</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={6}
                      value={formData.message}
                      onChange={(e) => handleFormFieldChange('message', e.target.value)}
                      onBlur={() => handleFieldBlur('message')}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 text-base resize-vertical ${
                        formErrors.message
                          ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                          : 'border-gray-200 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100'
                      }`}
                      placeholder="Tell us about your project... (minimum 10 characters)"
                    />
                    <div className="flex justify-between items-center mt-1">
                      {formErrors.message ? (
                        <p className="text-sm text-red-600">{formErrors.message}</p>
                      ) : (
                        <p className="text-xs text-gray-500">Minimum 10 characters</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {formData.message.length} characters
                      </p>
                    </div>
                  </div>
                  
                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitMutation.isPending || isLoadingServices}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-lg"
                  >
                    {submitMutation.isPending ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>Send Message</span>
                      </>
                    )}
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center">
                    By submitting this form, you agree to our{' '}
                    <a href="/policies" className="text-yellow-600 hover:text-yellow-700 underline">
                      Terms of Service
                    </a>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Trust Section */}
        <div className="bg-white border-t-2 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-full mb-4">
                  <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Fast Response</h4>
                <p className="text-gray-600">We typically respond to inquiries within 24 hours</p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-full mb-4">
                  <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">No Spam</h4>
                <p className="text-gray-600">Your information is safe and never shared with third parties</p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-full mb-4">
                  <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Direct Support</h4>
                <p className="text-gray-600">Speak directly with our team via WhatsApp or email</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PUB_Contact;