import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface MarketingContent {
  id: string;
  page_key: string;
  section_key: string;
  content: string;
  updated_at: string;
}

interface PolicyContent {
  [section_key: string]: MarketingContent;
}

interface PolicySection {
  key: string;
  title: string;
  icon: React.ReactNode;
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchPolicyContent = async (): Promise<PolicyContent> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  const response = await axios.get<MarketingContent[]>(
    `${API_BASE_URL}/api/public/marketing-content`,
    {
      params: { page_key: 'policies' },
      headers: { 'Content-Type': 'application/json' }
    }
  );

  // Transform array to Record indexed by section_key
  const policy_content: PolicyContent = response.data.reduce((acc, item) => {
    acc[item.section_key] = item;
    return acc;
  }, {} as PolicyContent);

  return policy_content;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_Policies: React.FC = () => {
  // ===========================
  // HOOKS & STATE
  // ===========================
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [expanded_sections, set_expanded_sections] = useState<Set<string>>(new Set());
  
  // Get section from URL params
  const active_section = searchParams.get('section');
  
  // Zustand store access (individual selectors)
  const is_mobile = useAppStore(state => state.ui_state.is_mobile);
  const show_toast = useAppStore(state => state.show_toast);

  // ===========================
  // DATA FETCHING
  // ===========================
  
  const {
    data: policy_content = {},
    isLoading: is_loading,
    error: fetch_error
  } = useQuery<PolicyContent, Error>({
    queryKey: ['policy-content'],
    queryFn: fetchPolicyContent,
    staleTime: 300000, // 5 minutes (policies rarely change)
    retry: 2,
  });

  const error = fetch_error?.message || null;

  // ===========================
  // POLICY SECTIONS CONFIGURATION
  // ===========================
  
  const policy_sections: PolicySection[] = [
    {
      key: 'payment_terms',
      title: 'Payment Terms',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      key: 'tax_vat',
      title: 'Tax/VAT Information',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      key: 'file_requirements',
      title: 'File Requirements',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      key: 'refunds_cancellations',
      title: 'Refunds & Cancellations',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      )
    },
    {
      key: 'revisions',
      title: 'Revision Policy',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    },
    {
      key: 'turnaround',
      title: 'Turnaround Times',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];

  // ===========================
  // EFFECTS
  // ===========================
  
  // Handle active_section from URL param
  useEffect(() => {
    if (active_section && !is_loading && policy_content[active_section]) {
      // Expand the section specified in URL
      set_expanded_sections(prev => new Set([...prev, active_section]));
      
      // Scroll to section after short delay (allow render)
      setTimeout(() => {
        const section_element = document.getElementById(`section-${active_section}`);
        if (section_element) {
          section_element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [active_section, is_loading, policy_content]);

  // ===========================
  // EVENT HANDLERS
  // ===========================
  
  const toggle_section = (section_key: string) => {
    set_expanded_sections(prev => {
      const new_set = new Set(prev);
      if (new_set.has(section_key)) {
        new_set.delete(section_key);
      } else {
        new_set.add(section_key);
      }
      return new_set;
    });
  };

  const jump_to_section = (section_key: string) => {
    // Update URL param
    setSearchParams({ section: section_key });
    
    // Expand section
    set_expanded_sections(prev => new Set([...prev, section_key]));
    
    // Scroll to section
    setTimeout(() => {
      const section_element = document.getElementById(`section-${section_key}`);
      if (section_element) {
        section_element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handle_print = () => {
    window.print();
  };

  const expand_all_sections = () => {
    const all_keys = policy_sections.map(s => s.key);
    set_expanded_sections(new Set(all_keys));
  };

  const collapse_all_sections = () => {
    set_expanded_sections(new Set());
  };

  // ===========================
  // RENDER HELPERS
  // ===========================
  
  const get_section_content = (section_key: string): string => {
    return policy_content[section_key]?.content || `No content available for ${section_key}`;
  };

  const is_section_expanded = (section_key: string): boolean => {
    return expanded_sections.has(section_key);
  };

  // ===========================
  // RENDER
  // ===========================
  
  return (
    <>
      {/* Main container */}
      <div className="min-h-screen bg-white">
        {/* Header section */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b-2 border-black">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Policies & Terms
            </h1>
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-3xl">
              Clear, transparent policies that outline our business terms, payment requirements, and service commitments.
            </p>
            
            {/* Action buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                onClick={expand_all_sections}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-all duration-200 border-2 border-gray-300"
              >
                Expand All Sections
              </button>
              <button
                onClick={collapse_all_sections}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-all duration-200 border-2 border-gray-300"
              >
                Collapse All
              </button>
              <button
                onClick={handle_print}
                className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-lg transition-all duration-200 border-2 border-gray-300"
              >
                Print Policies
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Loading state */}
          {is_loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <svg className="animate-spin h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600 font-medium">Loading policies...</p>
            </div>
          )}

          {/* Error state */}
          {error && !is_loading && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-8">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-red-900 font-semibold mb-1">Failed to load policies</h3>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick navigation (desktop only) */}
          {!is_loading && !error && (
            <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 hidden md:block">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Jump to Section</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {policy_sections.map(section => (
                  <button
                    key={section.key}
                    onClick={() => jump_to_section(section.key)}
                    className={`flex items-center px-4 py-2 rounded-lg text-left transition-all duration-200 ${
                      active_section === section.key
                        ? 'bg-yellow-400 text-black font-semibold shadow-md'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    <span className="mr-2">{section.icon}</span>
                    <span className="text-sm">{section.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Policy sections accordion */}
          {!is_loading && !error && (
            <div className="space-y-4">
              {policy_sections.map((section) => {
                const is_expanded = is_section_expanded(section.key);
                const section_content = get_section_content(section.key);
                const is_active = active_section === section.key;

                return (
                  <div
                    key={section.key}
                    id={`section-${section.key}`}
                    className={`bg-white rounded-xl border-2 transition-all duration-200 overflow-hidden ${
                      is_active
                        ? 'border-yellow-400 shadow-lg shadow-yellow-100'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Section header (clickable) */}
                    <button
                      onClick={() => toggle_section(section.key)}
                      className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 transition-colors duration-200"
                      aria-expanded={is_expanded}
                      aria-controls={`content-${section.key}`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`flex-shrink-0 ${is_active ? 'text-yellow-600' : 'text-gray-700'}`}>
                          {section.icon}
                        </div>
                        <h3 className={`text-lg md:text-xl font-semibold ${
                          is_active ? 'text-gray-900' : 'text-gray-800'
                        }`}>
                          {section.title}
                        </h3>
                      </div>
                      
                      {/* Expand/collapse icon */}
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform duration-200 flex-shrink-0 ${
                          is_expanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Section content (collapsible) */}
                    {is_expanded && (
                      <div
                        id={`content-${section.key}`}
                        className="px-6 pb-6 pt-2 border-t border-gray-100"
                      >
                        <div className="prose prose-sm md:prose-base max-w-none">
                          {/* Render content as HTML (sanitized from backend) */}
                          <div
                            className="text-gray-700 leading-relaxed space-y-4"
                            dangerouslySetInnerHTML={{ __html: section_content }}
                          />
                          
                          {/* Last updated timestamp */}
                          {policy_content[section.key] && (
                            <p className="text-xs text-gray-500 mt-6 pt-4 border-t border-gray-200">
                              Last updated: {new Date(policy_content[section.key].updated_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer CTA */}
          {!is_loading && !error && (
            <div className="mt-12 p-8 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Have Questions?
              </h2>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Our policies are designed to be clear and fair. If you need clarification or have specific concerns, we're here to help.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/contact"
                  className="px-8 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Contact Us
                </Link>
                <Link
                  to="/app/quotes/new"
                  className="px-8 py-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg border-2 border-gray-300 transition-all duration-200"
                >
                  Get a Quote
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Print styles (hidden on screen, visible in print) */}
        <style>{`
          @media print {
            /* Hide navigation, buttons, and interactive elements */
            nav, button, .no-print {
              display: none !important;
            }
            
            /* Expand all sections for printing */
            [id^="content-"] {
              display: block !important;
            }
            
            /* Remove borders and shadows for cleaner print */
            .border, .shadow {
              border: none !important;
              box-shadow: none !important;
            }
            
            /* Ensure content breaks properly across pages */
            [id^="section-"] {
              page-break-inside: avoid;
            }
            
            /* Black text for printing */
            * {
              color: black !important;
            }
          }
        `}</style>
      </div>
    </>
  );
};

export default UV_PUB_Policies;