import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface GalleryImage {
  id: string;
  title: string;
  image_url: string;
  thumbnail_url: string | null;
  description: string | null;
  alt_text: string | null;
  categories: string | null; // JSON string
  is_active: boolean;
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

interface GalleryResponse {
  images: GalleryImage[];
  total: number;
  page: number;
  total_pages: number;
}

interface LightboxState {
  is_open: boolean;
  current_image_index: number;
  images: GalleryImage[];
}

// ===========================
// API FUNCTIONS
// ===========================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const fetchGalleryImages = async (category: string | null, page: number): Promise<GalleryResponse> => {
  const params: Record<string, string> = {
    page: String(page),
    limit: '20',
  };
  
  if (category) {
    params.category = category;
  }
  
  const response = await axios.get(`${API_BASE_URL}/api/public/gallery`, { params });
  return response.data;
};

const fetchServiceCategories = async (): Promise<ServiceCategory[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/public/service-categories`);
  return response.data;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_Gallery: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Parse URL params
  const categoryParam = searchParams.get('category');
  const pageParam = searchParams.get('page');
  const currentPage = pageParam ? parseInt(pageParam, 10) : 1;
  
  // Local lightbox state
  const [lightboxState, setLightboxState] = useState<LightboxState>({
    is_open: false,
    current_image_index: 0,
    images: [],
  });
  
  // Zustand store - CRITICAL: Individual selectors only
  const showToast = useAppStore(state => state.show_toast);
  
  // React-Query: Fetch service categories (cached)
  const {
    data: categoriesData,
    isLoading: isLoadingCategories,
  } = useQuery({
    queryKey: ['service-categories'],
    queryFn: fetchServiceCategories,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });
  
  const serviceCategories = categoriesData || [];
  
  // React-Query: Fetch gallery images (depends on filters)
  const {
    data: galleryData,
    isLoading: isLoadingImages,
    error: galleryError,
  } = useQuery({
    queryKey: ['gallery-images', categoryParam, currentPage],
    queryFn: () => fetchGalleryImages(categoryParam, currentPage),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
  
  const galleryImages = galleryData?.images || [];
  const totalImages = galleryData?.total || 0;
  const totalPages = galleryData?.total_pages || 0;
  
  const isLoading = isLoadingCategories || isLoadingImages;
  const error = galleryError ? (galleryError as any).message : null;
  
  // ===========================
  // FILTER & PAGINATION ACTIONS
  // ===========================
  
  const filterByCategory = (categorySlug: string | null) => {
    const newParams: Record<string, string> = {};
    
    if (categorySlug) {
      newParams.category = categorySlug;
    }
    // Reset to page 1 when filter changes
    newParams.page = '1';
    
    setSearchParams(newParams);
  };
  
  const changePage = (newPage: number) => {
    const newParams: Record<string, string> = {};
    
    if (categoryParam) {
      newParams.category = categoryParam;
    }
    
    newParams.page = String(newPage);
    
    setSearchParams(newParams);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // ===========================
  // LIGHTBOX ACTIONS
  // ===========================
  
  const openLightbox = (imageIndex: number) => {
    setLightboxState({
      is_open: true,
      current_image_index: imageIndex,
      images: galleryImages,
    });
    // Body scroll is handled by useEffect
  };

  const closeLightbox = () => {
    setLightboxState({
      is_open: false,
      current_image_index: 0,
      images: [],
    });
    // Body scroll is handled by useEffect
  };
  
  const navigateLightbox = (direction: 'next' | 'prev') => {
    const imagesCount = lightboxState.images.length;
    
    setLightboxState(prev => {
      let newIndex: number;
      
      if (direction === 'next') {
        newIndex = (prev.current_image_index + 1) % imagesCount;
      } else {
        newIndex = (prev.current_image_index - 1 + imagesCount) % imagesCount;
      }
      
      return {
        ...prev,
        current_image_index: newIndex,
      };
    });
  };
  
  // ===========================
  // KEYBOARD NAVIGATION
  // ===========================
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxState.is_open) return;
      
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        navigateLightbox('prev');
      } else if (e.key === 'ArrowRight') {
        navigateLightbox('next');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxState.is_open, lightboxState.images.length]);

  // Lock body scroll when lightbox is open with proper cleanup
  useEffect(() => {
    if (lightboxState.is_open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxState.is_open]);

  // ===========================
  // ERROR HANDLING
  // ===========================

  useEffect(() => {
    if (error) {
      showToast({
        type: 'error',
        message: error || 'Failed to load gallery images',
        duration: 5000,
      });
    }
  }, [error, showToast]);
  
  // ===========================
  // RENDER HELPERS
  // ===========================
  
  const currentLightboxImage = lightboxState.is_open 
    ? lightboxState.images[lightboxState.current_image_index] 
    : null;
  
  const activeCategoryFilter = categoryParam;
  
  // ===========================
  // RENDER
  // ===========================
  
  return (
    <>
      {/* Page Container */}
      <div className="min-h-screen bg-white">
        {/* Header Section */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b-2 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
            <div className="text-center">
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-4">
                Our Portfolio
              </h1>
              <p className="text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Explore our previous work across printing, signage, and branding projects. 
                Each piece demonstrates our commitment to quality and precision.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            {/* Desktop: Horizontal filter chips */}
            <div className="hidden md:flex items-center space-x-3 overflow-x-auto">
              <button
                onClick={() => filterByCategory(null)}
                className={`px-6 py-2 rounded-full font-medium transition-all duration-200 whitespace-nowrap ${
                  !activeCategoryFilter
                    ? 'bg-yellow-400 text-black shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              
              {serviceCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => filterByCategory(category.slug)}
                  className={`px-6 py-2 rounded-full font-medium transition-all duration-200 whitespace-nowrap ${
                    activeCategoryFilter === category.slug
                      ? 'bg-yellow-400 text-black shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Mobile: Horizontal scrollable chips */}
            <div className="md:hidden flex items-center space-x-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
              <button
                onClick={() => filterByCategory(null)}
                className={`px-5 py-2 rounded-full font-medium transition-all duration-200 whitespace-nowrap snap-start flex-shrink-0 ${
                  !activeCategoryFilter
                    ? 'bg-yellow-400 text-black shadow-md'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                All
              </button>
              
              {serviceCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => filterByCategory(category.slug)}
                  className={`px-5 py-2 rounded-full font-medium transition-all duration-200 whitespace-nowrap snap-start flex-shrink-0 ${
                    activeCategoryFilter === category.slug
                      ? 'bg-yellow-400 text-black shadow-md'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          {/* Results Header */}
          {!isLoading && (
            <div className="mb-8">
              <p className="text-gray-600 text-base">
                {activeCategoryFilter ? (
                  <>
                    Showing {galleryImages.length} of {totalImages} projects in{' '}
                    <span className="font-semibold">
                      {serviceCategories.find(c => c.slug === activeCategoryFilter)?.name || activeCategoryFilter}
                    </span>
                  </>
                ) : (
                  <>Showing {galleryImages.length} of {totalImages} projects</>
                )}
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="aspect-square bg-gray-200 rounded-lg animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Gallery</h3>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && galleryImages.length === 0 && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No Images Found</h3>
              <p className="text-gray-600 mb-6">
                {activeCategoryFilter 
                  ? `No images found in this category. Try selecting a different filter.`
                  : 'No gallery images available yet.'}
              </p>
              {activeCategoryFilter && (
                <button
                  onClick={() => filterByCategory(null)}
                  className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors"
                >
                  View All Images
                </button>
              )}
            </div>
          )}

          {/* Gallery Grid */}
          {!isLoading && !error && galleryImages.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6 mb-12">
                {galleryImages.map((image, index) => {
                  // Parse categories JSON
                  let imageCategoryLabels: string[] = [];
                  try {
                    if (image.categories) {
                      imageCategoryLabels = JSON.parse(image.categories);
                    }
                  } catch {
                    imageCategoryLabels = [];
                  }
                  
                  return (
                    <div
                      key={image.id}
                      className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 cursor-pointer shadow-md hover:shadow-xl transition-all duration-200"
                      onClick={() => openLightbox(index)}
                    >
                      {/* Image */}
                      <img
                        src={image.thumbnail_url || image.image_url}
                        alt={image.alt_text || image.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex flex-col items-center justify-center p-4">
                        <p className="text-white font-semibold text-base lg:text-lg text-center mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                          {image.title}
                        </p>
                        
                        {imageCategoryLabels.length > 0 && (
                          <p className="text-yellow-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                            {imageCategoryLabels[0]}
                          </p>
                        )}
                        
                        <p className="text-white text-sm mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                          View Project
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2">
                  {/* Previous Button */}
                  <button
                    onClick={() => changePage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black"
                  >
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex items-center space-x-1">
                    {[...Array(totalPages)].map((_, index) => {
                      const pageNumber = index + 1;
                      
                      // Show first, last, current, and adjacent pages
                      const shouldShow = 
                        pageNumber === 1 ||
                        pageNumber === totalPages ||
                        pageNumber === currentPage ||
                        Math.abs(pageNumber - currentPage) === 1;
                      
                      const showEllipsis = 
                        (pageNumber === 2 && currentPage > 3) ||
                        (pageNumber === totalPages - 1 && currentPage < totalPages - 2);
                      
                      if (showEllipsis) {
                        return (
                          <span key={`ellipsis-${pageNumber}`} className="px-2 text-gray-500">
                            ...
                          </span>
                        );
                      }
                      
                      if (!shouldShow) return null;
                      
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => changePage(pageNumber)}
                          className={`w-10 h-10 rounded-lg font-semibold transition-colors ${
                            currentPage === pageNumber
                              ? 'bg-yellow-400 text-black'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Next Button */}
                  <button
                    onClick={() => changePage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Lightbox Modal */}
        {lightboxState.is_open && currentLightboxImage && (
          <div
            className="fixed inset-0 z-[1000] bg-black bg-opacity-90 flex items-center justify-center"
            onClick={closeLightbox}
          >
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-10 w-12 h-12 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition-all duration-200"
              aria-label="Close lightbox"
            >
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Previous Button */}
            {lightboxState.images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox('prev');
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 lg:w-14 lg:h-14 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition-all duration-200"
                aria-label="Previous image"
              >
                <svg className="w-6 h-6 lg:w-8 lg:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Next Button */}
            {lightboxState.images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox('next');
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 lg:w-14 lg:h-14 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition-all duration-200"
                aria-label="Next image"
              >
                <svg className="w-6 h-6 lg:w-8 lg:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Image Container */}
            <div
              className="relative max-w-7xl max-h-[90vh] mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={currentLightboxImage.image_url}
                alt={currentLightboxImage.alt_text || currentLightboxImage.title}
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
              
              {/* Image Info */}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-4 rounded-b-lg">
                <h3 className="text-lg lg:text-xl font-bold mb-1">
                  {currentLightboxImage.title}
                </h3>
                {currentLightboxImage.description && (
                  <p className="text-sm lg:text-base text-gray-300">
                    {currentLightboxImage.description}
                  </p>
                )}
                <p className="text-xs lg:text-sm text-gray-400 mt-2">
                  Image {lightboxState.current_image_index + 1} of {lightboxState.images.length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-t-2 border-black mt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Ready to Start Your Project?
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Let's bring your vision to life with the same quality and attention to detail.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link
                to="/app/quotes/new"
                className="w-full sm:w-auto px-8 py-4 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors shadow-lg hover:shadow-xl text-center"
              >
                Get a Quote
              </Link>
              <Link
                to="/contact"
                className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors text-center"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PUB_Gallery;