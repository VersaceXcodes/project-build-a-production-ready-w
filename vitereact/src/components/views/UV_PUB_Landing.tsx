import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// =====================================================
// TYPE DEFINITIONS (matching Zod schemas)
// =====================================================

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

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface GalleryImage {
  id: string;
  title: string;
  image_url: string;
  thumbnail_url: string | null;
  description: string | null;
  alt_text: string | null;
  categories: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface MarketingContent {
  id: string;
  page_key: string;
  section_key: string;
  content: string;
  updated_at: string;
}

interface ServicesResponse {
  services: Service[];
  categories: ServiceCategory[];
}

interface GalleryResponse {
  images: GalleryImage[];
  total: number;
  page: number;
  total_pages: number;
}

// =====================================================
// API FUNCTIONS
// =====================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function fetch_top_selling_services(): Promise<ServicesResponse> {
  const { data } = await axios.get<ServicesResponse>(`${API_BASE_URL}/api/public/services`, {
    params: {
      is_top_seller: true,
      limit: 6
    }
  });
  return data;
}

async function fetch_gallery_preview(): Promise<GalleryResponse> {
  const { data } = await axios.get<GalleryResponse>(`${API_BASE_URL}/api/public/gallery`, {
    params: {
      limit: 6,
      page: 1
    }
  });
  return data;
}

async function fetch_marketing_content(): Promise<MarketingContent[]> {
  const { data } = await axios.get<MarketingContent[]>(`${API_BASE_URL}/api/public/marketing-content`, {
    params: {
      page_key: 'home'
    }
  });
  return data;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

const UV_PUB_Landing: React.FC = () => {
  const navigate = useNavigate();

  // CRITICAL: Individual selectors, no object destructuring
  const is_authenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const show_toast = useAppStore(state => state.show_toast);

  // State for sticky CTA visibility
  const [showStickyCTA, setShowStickyCTA] = React.useState(false);

  // Show sticky CTA after scrolling past hero
  React.useEffect(() => {
    const handleScroll = () => {
      setShowStickyCTA(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Data fetching with React Query
  const { data: services_data, isLoading: is_loading_services, error: services_error } = useQuery<ServicesResponse>({
    queryKey: ['top_selling_services'],
    queryFn: fetch_top_selling_services,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: gallery_data, isLoading: is_loading_gallery, error: gallery_error } = useQuery<GalleryResponse>({
    queryKey: ['gallery_preview'],
    queryFn: fetch_gallery_preview,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: content_data, isLoading: is_loading_content, error: content_error } = useQuery<MarketingContent[]>({
    queryKey: ['marketing_content', 'home'],
    queryFn: fetch_marketing_content,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Handle errors
  React.useEffect(() => {
    if (services_error) {
      show_toast({
        type: 'error',
        message: 'Failed to load services',
        duration: 5000
      });
    }
    if (gallery_error) {
      show_toast({
        type: 'error',
        message: 'Failed to load gallery images',
        duration: 5000
      });
    }
    if (content_error) {
      show_toast({
        type: 'error',
        message: 'Failed to load page content',
        duration: 5000
      });
    }
  }, [services_error, gallery_error, content_error, show_toast]);

  // Transform marketing content array into structured object
  const marketing_content = React.useMemo(() => {
    if (!content_data || !Array.isArray(content_data)) {
      return {
        hero_headline: 'Disciplined Premium Print, Signage & Branding',
        hero_subtext: 'Professional branding that is accessible and dependable',
        hero_cta_text: 'Get a Quote'
      };
    }
    const content_map: Record<string, string> = {};
    content_data.forEach(item => {
      content_map[item.section_key] = item.content;
    });
    return {
      hero_headline: content_map.hero_headline || 'Disciplined Premium Print, Signage & Branding',
      hero_subtext: content_map.hero_subtext || 'Professional branding that is accessible and dependable',
      hero_cta_text: content_map.hero_cta_text || 'Get a Quote'
    };
  }, [content_data]);

  const top_selling_services = services_data?.services || [];
  const gallery_preview_images = gallery_data?.images || [];

  // Navigation handlers
  const navigate_to_quote_wizard = () => {
    // Route to quote start page - user can choose guest/login/register
    navigate('/quote/start');
  };

  const navigate_to_service_detail = (service_slug: string) => {
    navigate(`/services/${service_slug}`);
  };

  const navigate_to_gallery = () => {
    navigate('/gallery');
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white py-24 lg:py-40 overflow-hidden">
        {/* Premium gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
        
        {/* Subtle animated background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '48px 48px'
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-5xl mx-auto">
            {is_loading_content ? (
              <>
                <div className="h-6 bg-gray-700/50 rounded-lg mb-6 animate-pulse max-w-sm mx-auto"></div>
                <div className="h-20 bg-gray-700/50 rounded-lg mb-8 animate-pulse"></div>
                <div className="h-16 bg-gray-700/50 rounded-lg mb-10 animate-pulse"></div>
              </>
            ) : (
              <>
                {/* Premium tagline */}
                <div className="mb-6 animate-fade-in">
                  <span className="inline-block px-5 py-2 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs sm:text-sm font-semibold tracking-wider uppercase backdrop-blur-sm">
                    PREMIUM PRINT & BRANDING SOLUTIONS
                  </span>
                </div>

                {/* Premium headline */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 tracking-tight">
                  <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                    Personalise First,
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
                    Deliver Excellence
                  </span>
                </h1>

                {/* Subheadline */}
                <p className="text-lg sm:text-xl lg:text-2xl text-gray-300 leading-relaxed mb-10 max-w-3xl mx-auto font-light">
                  Professional branding that is accessible and dependable
                </p>
              </>
            )}
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={navigate_to_quote_wizard}
                className="group relative px-8 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-xl hover:from-amber-400 hover:to-yellow-400 transition-all duration-300 shadow-2xl shadow-amber-500/25 hover:shadow-amber-500/40 transform hover:scale-105 hover:-translate-y-0.5 min-w-[240px]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Get Your Custom Quote
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
              
              <button
                onClick={navigate_to_gallery}
                className="group px-8 py-4 bg-transparent border-2 border-white/20 backdrop-blur-sm text-white font-bold rounded-xl hover:bg-white/10 hover:border-white/40 transition-all duration-300 min-w-[240px]"
              >
                <span className="flex items-center justify-center gap-2">
                  View Our Portfolio
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Top Selling Services Section */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Our Top Services
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Explore our most popular printing, signage, and branding solutions
            </p>
          </div>

          {is_loading_services ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-gray-100 rounded-xl p-6 animate-pulse">
                  <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded mb-4"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : services_error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">Failed to load services</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : top_selling_services.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No featured services available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {top_selling_services.map((service) => (
                <div
                  key={service.id}
                  className="bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden group cursor-pointer"
                  onClick={() => navigate_to_service_detail(service.slug)}
                >
                  <div className="p-6">
                    <div className="h-12 w-12 bg-yellow-400 rounded-lg flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-yellow-600 transition-colors">
                      {service.name}
                    </h3>
                    <p className="text-gray-600 leading-relaxed mb-6 line-clamp-2">
                      {service.description || 'Professional service with premium quality and reliable delivery'}
                    </p>
                    <span className="inline-block px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium group-hover:bg-yellow-400 transition-colors">
                      Learn More →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Gallery Preview Section */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              See Previous Work
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Explore our portfolio of completed projects and successful deliveries
            </p>
          </div>

          {is_loading_gallery ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : gallery_error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">Failed to load gallery images</p>
            </div>
          ) : gallery_preview_images.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Gallery images coming soon</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
              {gallery_preview_images.map((image) => (
                <Link
                  key={image.id}
                  to="/gallery"
                  className="relative aspect-square group overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <img
                    src={image.thumbnail_url || image.image_url}
                    alt={image.alt_text || image.title}
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-medium text-sm">
                        {image.title}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="text-center">
            <button
              onClick={navigate_to_gallery}
              className="px-8 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              View Our Portfolio
            </button>
          </div>
        </div>
      </section>

      {/* How It Works Process */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our streamlined process takes you from concept to completion
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {[
              {
                number: 1,
                title: 'Choose Service',
                description: 'Select from our range of printing, signage, and branding services',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                )
              },
              {
                number: 2,
                title: 'Configure Project',
                description: 'Provide specifications and upload your design files',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )
              },
              {
                number: 3,
                title: 'Choose Tier',
                description: 'Select your service level from Basic to Enterprise',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                )
              },
              {
                number: 4,
                title: 'Book & Pay Deposit',
                description: 'Schedule your project and secure your slot with a deposit',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )
              },
              {
                number: 5,
                title: 'Track Your Order',
                description: 'Monitor progress from production to delivery',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                )
              }
            ].map((step) => (
              <div key={step.number} className="text-center">
                <div className="relative mb-6">
                  <div className="w-16 h-16 mx-auto bg-yellow-400 rounded-full flex items-center justify-center text-gray-900 font-bold text-xl shadow-lg">
                    {step.number}
                  </div>
                  {step.number < 5 && (
                    <div className="hidden lg:block absolute top-1/2 left-full w-full h-1 bg-gray-200 transform -translate-y-1/2"></div>
                  )}
                </div>
                <div className="lg:hidden w-16 h-16 mx-auto mb-4 bg-yellow-400 rounded-full flex items-center justify-center text-white shadow-lg">
                  {step.icon}
                </div>
                <div className="hidden lg:block mb-4 text-yellow-600">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust/Value Proposition Blocks */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Why Choose SultanStamp
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our commitment to excellence sets us apart
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Consistent Quality',
                description: 'High standards maintained across every project. No compromises on materials, processes, or final output.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              },
              {
                title: 'Disciplined Timelines',
                description: 'Tier-based turnarounds that are respected. From express delivery to standard timelines, we honor our commitments.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              },
              {
                title: 'Transparent Pricing',
                description: 'Clear tier structure with no hidden fees. You know exactly what you\'re paying for before you commit.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              }
            ].map((block, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-8 shadow-lg border border-gray-100 text-center"
              >
                <div className="w-16 h-16 mx-auto bg-yellow-400 rounded-full flex items-center justify-center text-gray-900 mb-6 shadow-lg">
                  {block.icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {block.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {block.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-yellow-400 to-yellow-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-800 mb-8">
            Let's bring your vision to life with professional branding solutions
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={navigate_to_quote_wizard}
              className="px-8 py-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Get a Quote
            </button>
            <Link
              to="/contact"
              className="px-8 py-4 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl border-2 border-gray-900 inline-block"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Mobile Sticky CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40 shadow-lg">
        <button
          onClick={navigate_to_quote_wizard}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-lg transition-all duration-200"
        >
          Get a Free Quote
        </button>
      </div>

      {/* Desktop Floating Sticky CTA */}
      <div
        className={`hidden md:flex fixed bottom-8 right-8 z-40 transition-all duration-300 ${
          showStickyCTA ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <button
          onClick={navigate_to_quote_wizard}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-6 py-4 rounded-full shadow-2xl transition-all duration-200 flex items-center gap-3 group"
        >
          <svg className="h-6 w-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>Get a Quote</span>
          <svg className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </>
  );
};

export default UV_PUB_Landing;