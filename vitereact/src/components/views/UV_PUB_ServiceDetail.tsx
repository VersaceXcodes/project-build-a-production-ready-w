import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

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

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceOption {
  id: string;
  service_id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  choices: string | null;
  pricing_impact: string | null;
  help_text: string | null;
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

interface ServiceDetailResponse {
  service: Service;
  category: ServiceCategory;
  service_options: ServiceOption[];
  examples: GalleryImage[];
}

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_ServiceDetail: React.FC = () => {
  const { slug: service_slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // CRITICAL: Individual selectors to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const showToast = useAppStore(state => state.show_toast);

  // Local state for lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentLightboxIndex, setCurrentLightboxIndex] = useState(0);

  // Local state for carousel
  const [carouselScrollPosition, setCarouselScrollPosition] = useState(0);

  // Local state for sticky CTA visibility
  const [showStickyCTA, setShowStickyCTA] = useState(false);

  // API base URL
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Fetch service detail using React Query
  const {
    data: serviceData,
    isLoading,
    error
  } = useQuery<ServiceDetailResponse>({
    queryKey: ['public-service-detail', service_slug],
    queryFn: async () => {
      if (!service_slug) {
        throw new Error('Service slug is required');
      }
      const response = await axios.get(
        `${API_BASE_URL}/api/public/services/${service_slug}`
      );
      return response.data;
    },
    enabled: !!service_slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });

  // Handle keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen || !serviceData?.examples.length) return;

      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        navigateLightbox('prev');
      } else if (e.key === 'ArrowRight') {
        navigateLightbox('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, currentLightboxIndex, serviceData]);

  // Lock body scroll when lightbox open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxOpen]);

  // Show sticky CTA after scrolling past hero section
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      // Show sticky CTA after scrolling 300px (past hero)
      setShowStickyCTA(scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ===========================
  // ACTION HANDLERS
  // ===========================

  const handleBuildQuote = () => {
    if (!serviceData?.service) return;

    if (isAuthenticated) {
      navigate(`/app/quotes/new?service=${serviceData.service.slug}`);
    } else {
      const returnPath = encodeURIComponent(`/app/quotes/new?service=${serviceData.service.slug}`);
      navigate(`/login?returnTo=${returnPath}`);
    }
  };

  const handleViewGallery = () => {
    if (!serviceData?.category) return;
    navigate(`/gallery?category=${serviceData.category.slug}`);
  };

  const openLightbox = (index: number) => {
    setCurrentLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (!serviceData?.examples.length) return;

    if (direction === 'next') {
      setCurrentLightboxIndex((prev) => 
        prev >= serviceData.examples.length - 1 ? 0 : prev + 1
      );
    } else {
      setCurrentLightboxIndex((prev) => 
        prev <= 0 ? serviceData.examples.length - 1 : prev - 1
      );
    }
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    const container = document.getElementById('carousel-container');
    if (!container) return;

    const scrollAmount = direction === 'right' ? 300 : -300;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  // ===========================
  // RENDER STATES
  // ===========================

  // Loading state
  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          {/* Loading skeleton */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Breadcrumb skeleton */}
            <div className="flex items-center space-x-2 mb-8">
              <div className="h-4 w-16 bg-gray-300 rounded animate-pulse"></div>
              <div className="h-4 w-4 bg-gray-300 rounded animate-pulse"></div>
              <div className="h-4 w-24 bg-gray-300 rounded animate-pulse"></div>
              <div className="h-4 w-4 bg-gray-300 rounded animate-pulse"></div>
              <div className="h-4 w-32 bg-gray-300 rounded animate-pulse"></div>
            </div>

            {/* Header skeleton */}
            <div className="mb-12">
              <div className="h-10 w-64 bg-gray-300 rounded animate-pulse mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-300 rounded animate-pulse"></div>
                <div className="h-4 w-full bg-gray-300 rounded animate-pulse"></div>
                <div className="h-4 w-3/4 bg-gray-300 rounded animate-pulse"></div>
              </div>
            </div>

            {/* Carousel skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square bg-gray-300 rounded-lg animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (error || !serviceData) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="mb-6">
              <svg className="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Service Not Found</h2>
            <p className="text-gray-600 mb-6">
              {error instanceof Error ? error.message : 'The service you\'re looking for doesn\'t exist or is no longer available.'}
            </p>
            <Link
              to="/services"
              className="inline-block bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-6 py-3 rounded-lg transition-all duration-200"
            >
              Browse All Services
            </Link>
          </div>
        </div>
      </>
    );
  }

  const { service, category: service_category, service_options, examples: example_images } = serviceData;

  // ===========================
  // MAIN RENDER
  // ===========================

  return (
    <>
      {/* Main Content */}
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-8" aria-label="Breadcrumb">
            <Link to="/services" className="hover:text-yellow-600 transition-colors">
              Services
            </Link>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <Link to={`/services?category=${service_category.slug}`} className="hover:text-yellow-600 transition-colors">
              {service_category.name}
            </Link>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-900 font-medium">{service.name}</span>
          </nav>

          {/* Service Header */}
          <div className="mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              {service.name}
            </h1>
            
            {service.description && (
              <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                <p>{service.description}</p>
              </div>
            )}

            {service.is_top_seller && (
              <div className="mt-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                  <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Top Seller
                </span>
              </div>
            )}

            {/* Immediate CTA - visible right away without scrolling */}
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={handleBuildQuote}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-lg flex items-center gap-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Get a Quote
              </button>
              <button
                onClick={handleViewGallery}
                className="bg-white hover:bg-gray-100 text-gray-900 font-medium px-6 py-4 rounded-lg border border-gray-300 transition-all duration-200 flex items-center gap-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                View Examples
              </button>
            </div>
          </div>

          {/* Examples Carousel */}
          {example_images && example_images.length > 0 && (
            <div className="mb-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Example Projects</h2>
              
              {/* Desktop: 4-column grid */}
              <div className="hidden md:block">
                <div className="relative">
                  <button
                    onClick={() => scrollCarousel('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white hover:bg-gray-100 rounded-full p-3 shadow-lg transition-all duration-200"
                    aria-label="Previous examples"
                  >
                    <svg className="h-6 w-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div 
                    id="carousel-container"
                    className="overflow-x-auto scrollbar-hide scroll-smooth"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    <div className="grid grid-cols-4 gap-6">
                      {example_images.map((image, index) => (
                        <div
                          key={image.id}
                          className="cursor-pointer group"
                          onClick={() => openLightbox(index)}
                        >
                          <div className="aspect-square rounded-lg overflow-hidden bg-gray-200 relative">
                            <img
                              src={image.thumbnail_url || image.image_url}
                              alt={image.alt_text || image.title}
                              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
                              <span className="text-white font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                View Project
                              </span>
                            </div>
                          </div>
                          {image.title && (
                            <p className="mt-2 text-sm text-gray-700 font-medium line-clamp-1">
                              {image.title}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => scrollCarousel('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white hover:bg-gray-100 rounded-full p-3 shadow-lg transition-all duration-200"
                    aria-label="Next examples"
                  >
                    <svg className="h-6 w-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Mobile: Single image carousel with swipe */}
              <div className="md:hidden">
                <div className="relative">
                  <div className="overflow-x-auto snap-x snap-mandatory scrollbar-hide flex gap-4">
                    {example_images.map((image, index) => (
                      <div
                        key={image.id}
                        className="flex-none w-full snap-center cursor-pointer"
                        onClick={() => openLightbox(index)}
                      >
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-200">
                          <img
                            src={image.thumbnail_url || image.image_url}
                            alt={image.alt_text || image.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        {image.title && (
                          <p className="mt-2 text-sm text-gray-700 font-medium text-center">
                            {image.title}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Dots indicator */}
                  <div className="flex justify-center mt-4 space-x-2">
                    {example_images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          const container = document.querySelector('.overflow-x-auto');
                          if (container) {
                            container.scrollTo({
                              left: index * container.clientWidth,
                              behavior: 'smooth'
                            });
                          }
                        }}
                        className={`h-2 rounded-full transition-all duration-200 ${
                          index === currentLightboxIndex ? 'w-8 bg-yellow-400' : 'w-2 bg-gray-300'
                        }`}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Service Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            
            {/* Tier Guidance */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Choosing Your Service Level</h2>
              <p className="text-gray-600 mb-4 leading-relaxed">
                We offer different service tiers to match your timeline and budget needs.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700">Quick turnarounds → Gold Tier</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700">Design assistance → Standard or Gold</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700">Print-ready files → Basic</span>
                </li>
              </ul>
              <Link
                to="/pricing"
                className="text-yellow-600 hover:text-yellow-700 font-medium text-sm flex items-center transition-colors"
              >
                See All Tiers
                <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* File Requirements */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">What You'll Need to Provide</h2>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700">300 DPI minimum for print quality</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700">Correct dimensions/size specs</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700">Fonts outlined (for vector files)</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700">Bleed included where applicable</span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-md">
                Don't worry if you're not sure - we'll review and contact you if needed.
              </p>
            </div>

            {/* Service Requirements */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Service Requirements</h2>
              <ul className="space-y-3">
                {service.requires_booking && (
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Booking Required</p>
                      <p className="text-xs text-gray-600">Appointment needed for this service</p>
                    </div>
                  </li>
                )}
                
                {service.requires_proof && (
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-purple-600 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Proof Review Process</p>
                      <p className="text-xs text-gray-600">You'll approve designs before production</p>
                    </div>
                  </li>
                )}

                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Turnaround Time</p>
                    <p className="text-xs text-gray-600">Varies by tier (Basic to Enterprise)</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Configuration Preview (if service has options) */}
          {service_options && service_options.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8 mb-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Configuration Options</h2>
              <p className="text-gray-600 mb-6">
                When you request a quote, you'll provide specific details including:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {service_options.slice(0, 6).map((option) => (
                  <div key={option.id} className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                        {option.type === 'NUMBER' && (
                          <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                        )}
                        {option.type === 'SELECT' && (
                          <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                        )}
                        {option.type === 'TEXT' && (
                          <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        )}
                        {option.type === 'CHECKBOX' && (
                          <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {option.label}
                        {option.required && <span className="text-yellow-600 ml-1">*</span>}
                      </p>
                      {option.help_text && (
                        <p className="text-xs text-gray-500 mt-1">{option.help_text}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {service_options.length > 6 && (
                <p className="mt-4 text-sm text-gray-500 text-center">
                  + {service_options.length - 6} more configuration options
                </p>
              )}
            </div>
          )}

          {/* Primary CTA Section */}
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-8 lg:p-12 text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Get Started?</h2>
            <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">
              Let's bring your vision to life. Configure your project and get a custom quote tailored to your specific requirements.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleBuildQuote}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
              >
                Build a Quote for This Service
              </button>
              
              <button
                onClick={handleViewGallery}
                className="bg-white hover:bg-gray-100 text-gray-900 font-semibold px-8 py-4 rounded-lg border-2 border-gray-900 transition-all duration-200 text-lg"
              >
                View More Examples
              </button>
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
            <div className="flex items-start">
              <svg className="h-6 w-6 text-blue-600 mt-1 mr-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Questions About This Service?</h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  Our team is here to help you choose the right options for your project. Reach out via WhatsApp, email, or phone.
                </p>
                <Link
                  to="/contact"
                  className="text-yellow-600 hover:text-yellow-700 font-medium text-sm flex items-center transition-colors"
                >
                  Contact Us
                  <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Lightbox Overlay */}
      {lightboxOpen && example_images && example_images.length > 0 && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-50"
            aria-label="Close lightbox"
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Navigation buttons */}
          {example_images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox('prev');
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-3 z-50"
                aria-label="Previous image"
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox('next');
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-3 z-50"
                aria-label="Next image"
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Image container */}
          <div 
            className="max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={example_images[currentLightboxIndex].image_url}
                alt={example_images[currentLightboxIndex].alt_text || example_images[currentLightboxIndex].title}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
              
              {/* Image caption */}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-4 rounded-b-lg">
                <p className="font-medium">{example_images[currentLightboxIndex].title}</p>
                {example_images[currentLightboxIndex].description && (
                  <p className="text-sm text-gray-300 mt-1">
                    {example_images[currentLightboxIndex].description}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {currentLightboxIndex + 1} / {example_images.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky CTA Footer (only on mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40 shadow-lg">
        <div className="flex gap-2">
          <button
            onClick={handleBuildQuote}
            className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-6 py-3 rounded-lg transition-all duration-200"
          >
            Get a Quote
          </button>
          <button
            onClick={handleViewGallery}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold px-6 py-3 rounded-lg border border-gray-300 transition-all duration-200"
          >
            Gallery
          </button>
        </div>
      </div>

      {/* Desktop Floating Sticky CTA (appears after scrolling) */}
      <div
        className={`hidden md:flex fixed bottom-8 right-8 z-40 transition-all duration-300 ${
          showStickyCTA ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <button
          onClick={handleBuildQuote}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-6 py-4 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-200 flex items-center gap-3 group"
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

export default UV_PUB_ServiceDetail;