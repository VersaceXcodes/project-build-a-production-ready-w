import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface MarketingContentItem {
  id: string;
  page_key: string;
  section_key: string;
  content: string;
  updated_at: string;
}

interface BrandValue {
  name: string;
  description: string;
}

interface AboutContent {
  brand_purpose: string;
  origin_story: string;
  values: BrandValue[];
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchAboutContent = async (): Promise<AboutContent> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  try {
    const response = await axios.get<MarketingContentItem[]>(
      `${API_BASE_URL}/api/public/marketing-content`,
      {
        params: { page_key: 'about' }
      }
    );

    const content_map: Record<string, string> = {};
    response.data.forEach((item) => {
      content_map[item.section_key] = item.content;
    });

    let values: BrandValue[] = [];
    
    if (content_map.values_json) {
      try {
        values = JSON.parse(content_map.values_json);
      } catch (e) {
        // If parse fails, use defaults
        values = getDefaultValues();
      }
    } else {
      values = getDefaultValues();
    }

    return {
      brand_purpose: content_map.brand_purpose || getDefaultBrandPurpose(),
      origin_story: content_map.origin_story || '',
      values: values
    };
  } catch (error) {
    // If API fails, return default content
    return {
      brand_purpose: getDefaultBrandPurpose(),
      origin_story: '',
      values: getDefaultValues()
    };
  }
};

// ===========================
// DEFAULT CONTENT
// ===========================

const getDefaultBrandPurpose = (): string => {
  return "Empower businesses through personalised visual identity while building the infrastructure our communities have been missing.";
};

const getDefaultValues = (): BrandValue[] => {
  return [
    {
      name: 'Personalisation First',
      description: 'Every project is tailored to your unique requirements. We don\'t do one-size-fits-all. Your brand deserves custom solutions that reflect your identity.'
    },
    {
      name: 'Quality Over Convenience',
      description: 'We refuse to compromise on standards. No shortcuts, no rushed work. Consistent high quality is our non-negotiable baseline, regardless of timeline or tier.'
    },
    {
      name: 'Discipline in Every Detail',
      description: 'Methodical, systematic approach to every project. From file preparation to final delivery, our disciplined process ensures nothing falls through the cracks.'
    },
    {
      name: 'Reliability',
      description: 'Dependable timelines, clear communication, and commitments we honor. When we say a deadline, we mean it. When we say we\'ll call, we call.'
    },
    {
      name: 'Community Impact',
      description: 'Building the infrastructure our communities have been missing. We\'re not just printing signs—we\'re creating access to professional branding for businesses that need it most.'
    },
    {
      name: 'Transparency',
      description: 'Clear pricing with no hidden fees. Honest communication about what\'s possible and what\'s not. You always know where your project stands and what you\'re paying for.'
    },
    {
      name: 'Practical Innovation',
      description: 'Technology that serves real business needs, not gimmicks. Our systems exist to make your experience better, not to complicate it. Innovation with purpose.'
    }
  ];
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_About: React.FC = () => {
  const navigate = useNavigate();
  
  // CRITICAL: Individual selectors to prevent infinite loops
  const isAuthenticated = useAppStore(
    state => state.authentication_state.authentication_status.is_authenticated
  );

  // Fetch about content with React Query
  const { data: about_content, isLoading: is_loading, error } = useQuery({
    queryKey: ['about-content'],
    queryFn: fetchAboutContent,
    staleTime: 1000 * 60 * 60, // 1 hour - content doesn't change often
    retry: 1, // Only retry once if fails
    refetchOnWindowFocus: false
  });

  // Navigation handler for CTA
  const handleGetQuoteClick = () => {
    if (isAuthenticated) {
      navigate('/app/quotes/new');
    } else {
      navigate('/login?returnTo=/app/quotes/new');
    }
  };

  const handleContactClick = () => {
    navigate('/contact');
  };

  return (
    <>
      {/* Main container */}
      <div className="min-h-screen bg-white">
        
        {/* Brand Purpose Section */}
        <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Our Purpose
              </h1>
              <div className="h-1 w-24 bg-yellow-400 mx-auto mb-8"></div>
            </div>
            
            {is_loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto"></div>
                <div className="h-6 bg-gray-200 rounded w-5/6 mx-auto"></div>
                <div className="h-6 bg-gray-200 rounded w-2/3 mx-auto"></div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xl lg:text-2xl text-gray-800 leading-relaxed font-medium">
                  {about_content?.brand_purpose || getDefaultBrandPurpose()}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Origin Story Section (if content exists) */}
        {about_content?.origin_story && (
          <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8 text-center">
                Our Story
              </h2>
              <div className="prose prose-lg max-w-none">
                <div 
                  className="text-gray-700 leading-relaxed" 
                  dangerouslySetInnerHTML={{ __html: about_content.origin_story }}
                />
              </div>
            </div>
          </section>
        )}

        {/* Brand Values Section */}
        <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                Our Values
              </h2>
              <div className="h-1 w-24 bg-yellow-400 mx-auto mb-6"></div>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                These aren't just words on a wall. They're the principles that guide every decision we make.
              </p>
            </div>

            {is_loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="animate-pulse bg-white rounded-xl p-8 shadow-lg">
                    <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {(about_content?.values || getDefaultValues()).map((value, index) => (
                  <div 
                    key={index}
                    className="bg-white rounded-xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-200"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-yellow-400 rounded-lg flex items-center justify-center">
                          <span className="text-2xl font-bold text-black">
                            {index + 1}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">
                          {value.name}
                        </h3>
                        <p className="text-gray-700 leading-relaxed">
                          {value.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Call-to-Action Section */}
        <section className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-black">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Let's bring your vision to life with disciplined, premium quality work.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleGetQuoteClick}
                className="w-full sm:w-auto bg-yellow-400 text-black px-8 py-4 rounded-lg text-lg font-semibold hover:bg-yellow-500 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Get a Quote
              </button>
              
              <button
                onClick={handleContactClick}
                className="w-full sm:w-auto bg-transparent border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white hover:text-black transition-all duration-200"
              >
                Contact Us
              </button>
            </div>
          </div>
        </section>

        {/* Error State (if content fetch failed, but we have defaults) */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-lg shadow-lg max-w-md z-50">
            <p className="text-sm">
              <strong>Note:</strong> Displaying default content. Some customizations may not be visible.
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_PUB_About;