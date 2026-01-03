import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import BestSellersSection from '@/components/BestSellersSection';
import PromoStrip from '@/components/PromoStrip';
import TrustRow from '@/components/TrustRow';

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

      {/* Best Sellers Section */}
      <BestSellersSection />

      {/* Promo Strip */}
      <PromoStrip />

      {/* Trust Row */}
      <TrustRow />

      {/* SECTION 2: Popular Print Categories */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block mb-4">
              <span className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-700 text-sm font-semibold tracking-wider uppercase">
                Shop by Category
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Popular Print Categories
            </h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Explore our wide range of premium print products — from business essentials to eye-catching marketing materials
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Business Cards */}
            <Link
              to="/products/business-cards"
              className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-amber-500/50 hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-yellow-500/20 rounded-bl-full -z-0"></div>
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-amber-600 transition-colors">
                  Business Cards
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Professional business cards with premium finishes. Make a lasting first impression.
                </p>
                <span className="inline-flex items-center gap-2 text-amber-600 font-semibold group-hover:gap-3 transition-all">
                  Shop Now
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </div>
            </Link>

            {/* Flyers */}
            <Link
              to="/products/flyers"
              className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-amber-500/50 hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-400/20 to-amber-500/20 rounded-bl-full -z-0"></div>
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-orange-600 transition-colors">
                  Flyers & Brochures
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Eye-catching promotional materials to spread your message effectively.
                </p>
                <span className="inline-flex items-center gap-2 text-orange-600 font-semibold group-hover:gap-3 transition-all">
                  Shop Now
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </div>
            </Link>

            {/* Stickers */}
            <Link
              to="/products/stickers"
              className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-amber-500/50 hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-amber-500/20 rounded-bl-full -z-0"></div>
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-yellow-600 transition-colors">
                  Custom Stickers
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Durable vinyl stickers for branding, packaging, and promotional use.
                </p>
                <span className="inline-flex items-center gap-2 text-yellow-600 font-semibold group-hover:gap-3 transition-all">
                  Shop Now
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </div>
            </Link>

            {/* Postcards */}
            <Link
              to="/products/postcards"
              className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-amber-500/50 hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-orange-500/20 rounded-bl-full -z-0"></div>
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-amber-600 transition-colors">
                  Postcards
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Direct mail postcards that get noticed and drive engagement.
                </p>
                <span className="inline-flex items-center gap-2 text-amber-600 font-semibold group-hover:gap-3 transition-all">
                  Shop Now
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </div>
            </Link>

            {/* Letterheads */}
            <Link
              to="/products/letterheads"
              className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-amber-500/50 hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-bl-full -z-0"></div>
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-yellow-600 transition-colors">
                  Letterheads
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Professional letterhead printing for official correspondence.
                </p>
                <span className="inline-flex items-center gap-2 text-yellow-600 font-semibold group-hover:gap-3 transition-all">
                  Shop Now
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </div>
            </Link>

            {/* Envelopes */}
            <Link
              to="/products/envelopes"
              className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-amber-500/50 hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-400/20 to-yellow-500/20 rounded-bl-full -z-0"></div>
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-orange-600 transition-colors">
                  Branded Envelopes
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Custom printed envelopes to complete your professional stationery set.
                </p>
                <span className="inline-flex items-center gap-2 text-orange-600 font-semibold group-hover:gap-3 transition-all">
                  Shop Now
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </div>
            </Link>
          </div>

          {/* View All Products Link */}
          <div className="text-center mt-12">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold rounded-xl hover:from-amber-400 hover:to-yellow-400 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              View All Products
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 3: Premium Branding & Installation Services (Dark Band) */}
      <section className="relative py-20 lg:py-32 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white overflow-hidden">
        {/* Premium overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
        
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '48px 48px'
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block mb-4">
              <span className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm font-semibold tracking-wider uppercase">
                Premium Services
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Branding & Installation Services
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Professional signage, vehicle branding, and custom installations for your business
            </p>
          </div>

          {is_loading_services ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-slate-800/50 rounded-2xl p-8 animate-pulse backdrop-blur-sm border border-slate-700/50">
                  <div className="h-16 w-16 bg-slate-700 rounded-xl mb-6"></div>
                  <div className="h-6 bg-slate-700 rounded mb-3"></div>
                  <div className="h-4 bg-slate-700 rounded mb-6"></div>
                  <div className="h-10 bg-slate-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : services_error ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">Failed to load services</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors font-semibold"
              >
                Retry
              </button>
            </div>
          ) : top_selling_services.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No featured services available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {top_selling_services.map((service) => (
                <div
                  key={service.id}
                  onClick={() => navigate_to_service_detail(service.slug)}
                  className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50 hover:border-amber-500/50 transition-all duration-300 cursor-pointer hover:-translate-y-1 shadow-xl hover:shadow-2xl hover:shadow-amber-500/10"
                >
                  {/* Premium corner accent */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  <div className="relative">
                    {/* Icon */}
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>

                    {/* Service name */}
                    <h3 className="text-2xl font-bold mb-3 group-hover:text-amber-400 transition-colors">
                      {service.name}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-400 leading-relaxed mb-6 line-clamp-2">
                      {service.description || 'Premium service with professional quality and expert installation'}
                    </p>

                    {/* CTA */}
                    <span className="inline-flex items-center gap-2 text-amber-400 font-semibold group-hover:gap-3 transition-all">
                      Learn More
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* View All Services Link */}
          <div className="text-center mt-12">
            <Link
              to="/services"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 font-bold rounded-xl hover:from-amber-300 hover:to-yellow-400 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Explore All Services
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 4: Gallery Preview — View Our Portfolio */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block mb-4">
              <span className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-700 text-sm font-semibold tracking-wider uppercase">
                Our Work
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              View Our Portfolio
            </h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
              See the quality and craftsmanship in our completed projects
            </p>
          </div>

          {is_loading_gallery ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 lg:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square bg-gray-200 rounded-xl animate-pulse"></div>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
              {gallery_preview_images.slice(0, 6).map((image) => (
                <Link
                  key={image.id}
                  to="/gallery"
                  className="relative aspect-square group overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300"
                >
                  <img
                    src={image.thumbnail_url || image.image_url}
                    alt={image.alt_text || image.title}
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-12 h-12 text-white transform scale-75 group-hover:scale-100 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-semibold text-sm">
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
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white font-bold rounded-xl hover:from-gray-800 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              View Full Portfolio
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 5: Enhanced Call to Action Section with Premium Styling */}
      <section className="relative py-24 lg:py-32 bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 overflow-hidden">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent"></div>
        
        {/* Decorative shapes */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/20 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-6">
            <span className="inline-block px-5 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-white text-sm font-semibold tracking-wider uppercase shadow-lg">
              Ready to Transform Your Brand?
            </span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
            Let's Bring Your Vision to Life
          </h2>
          
          <p className="text-xl lg:text-2xl text-slate-800 mb-10 max-w-3xl mx-auto leading-relaxed font-medium">
            Professional branding solutions with transparent pricing, disciplined timelines, and exceptional quality
          </p>
          
          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
            <button
              onClick={navigate_to_quote_wizard}
              className="group px-10 py-5 bg-slate-900 text-white font-bold text-lg rounded-xl hover:bg-slate-800 transition-all duration-300 shadow-2xl shadow-slate-900/30 hover:shadow-slate-900/50 transform hover:scale-105 min-w-[240px]"
            >
              <span className="flex items-center justify-center gap-3">
                Get Your Free Quote
                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
            
            <Link
              to="/contact"
              className="group px-10 py-5 bg-white text-slate-900 font-bold text-lg rounded-xl hover:bg-gray-50 transition-all duration-300 shadow-2xl hover:shadow-xl border-3 border-slate-900/10 inline-flex items-center justify-center gap-3 min-w-[240px]"
            >
              Contact Our Team
              <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="mt-16 pt-12 border-t border-white/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 shadow-lg">
                  <svg className="w-7 h-7 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Premium Quality</h3>
                <p className="text-slate-800 font-medium">Industry-leading materials and processes</p>
              </div>
              
              <div className="text-center">
                <div className="w-14 h-14 mx-auto bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 shadow-lg">
                  <svg className="w-7 h-7 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Fast Turnaround</h3>
                <p className="text-slate-800 font-medium">Express, standard, and economy options</p>
              </div>
              
              <div className="text-center">
                <div className="w-14 h-14 mx-auto bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 shadow-lg">
                  <svg className="w-7 h-7 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Clear Pricing</h3>
                <p className="text-slate-800 font-medium">Transparent quotes with no hidden fees</p>
              </div>
            </div>
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