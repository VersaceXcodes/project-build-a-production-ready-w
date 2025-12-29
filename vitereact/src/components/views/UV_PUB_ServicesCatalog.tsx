import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  category_name?: string;
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

interface ServicesResponse {
  services: Service[];
  categories: ServiceCategory[];
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchServices = async (
  category?: string | null,
  search?: string | null
): Promise<ServicesResponse> => {
  const params = new URLSearchParams();
  
  if (category) {
    params.append('category', category);
  }
  
  if (search && search.trim()) {
    params.append('search', search.trim());
  }

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const url = `${API_BASE_URL}/api/public/services${params.toString() ? '?' + params.toString() : ''}`;

  const response = await axios.get<ServicesResponse>(url);
  return response.data;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_ServicesCatalog: React.FC = () => {
  // URL Parameters
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Local State
  const [active_category_filter, set_active_category_filter] = useState<string | null>(
    searchParams.get('category')
  );
  const [search_query, set_search_query] = useState<string>(
    searchParams.get('search') || ''
  );
  const [search_input, set_search_input] = useState<string>(
    searchParams.get('search') || ''
  );

  // Ref for debounce timeout (avoids window pollution)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State for sticky CTA visibility
  const [showStickyCTA, setShowStickyCTA] = useState(false);

  // Show sticky CTA after scrolling
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyCTA(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Global State (only for toast notifications)
  const show_toast = useAppStore(state => state.show_toast);

  // ===========================
  // DATA FETCHING
  // ===========================

  const {
    data,
    isLoading: is_loading,
    error,
    refetch
  } = useQuery({
    queryKey: ['services', active_category_filter, search_query],
    queryFn: () => fetchServices(active_category_filter, search_query),
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
    retry: 1,
    select: (data) => ({
      services: data.services,
      service_categories: data.categories
    })
  });

  const services = data?.services || [];
  const service_categories = data?.service_categories || [];

  // ===========================
  // URL SYNC EFFECTS
  // ===========================

  useEffect(() => {
    const params = new URLSearchParams();
    
    if (active_category_filter) {
      params.set('category', active_category_filter);
    }
    
    if (search_query) {
      params.set('search', search_query);
    }

    setSearchParams(params, { replace: true });
  }, [active_category_filter, search_query, setSearchParams]);

  // ===========================
  // ACTIONS
  // ===========================

  const apply_category_filter = (category_slug: string | null) => {
    set_active_category_filter(category_slug);
  };

  const apply_search_filter = (e: React.FormEvent) => {
    e.preventDefault();
    set_search_query(search_input);
  };

  const clear_filters = () => {
    set_active_category_filter(null);
    set_search_query('');
    set_search_input('');
  };

  const handle_search_input_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    set_search_input(value);

    // Auto-submit search after user stops typing (debounced)
    if (value.length >= 3 || value.length === 0) {
      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Set new timeout
      searchTimeoutRef.current = setTimeout(() => {
        set_search_query(value);
      }, 500);
    }
  };

  // Get starting tier for service (simplified - would need tier data from backend)
  const get_starting_tier = (service: Service): string => {
    // For now, show "Basic" as starting tier
    // In production, this would be determined by pricing rules
    return 'Basic';
  };

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
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Our Services
              </h1>
              <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Explore our comprehensive range of print, branding, and signage services. 
                Each service is delivered with our signature discipline and quality.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          {/* Search Bar */}
          <div className="mb-8">
            <form onSubmit={apply_search_filter} className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={search_input}
                  onChange={handle_search_input_change}
                  placeholder="Search services..."
                  className="w-full px-4 py-3 pl-12 rounded-lg border-2 border-gray-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 focus:outline-none text-base transition-all"
                />
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {search_input && (
                  <button
                    type="button"
                    onClick={() => {
                      set_search_input('');
                      set_search_query('');
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Category Filters */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Filter by Category</h2>
              {(active_category_filter || search_query) && (
                <button
                  onClick={clear_filters}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Desktop/Tablet: Flex wrap */}
            <div className="hidden md:flex flex-wrap gap-3">
              <button
                onClick={() => apply_category_filter(null)}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  active_category_filter === null
                    ? 'bg-yellow-400 text-black shadow-lg'
                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300'
                }`}
              >
                All Services
              </button>
              
              {service_categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => apply_category_filter(category.slug)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    active_category_filter === category.slug
                      ? 'bg-yellow-400 text-black shadow-lg'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Mobile: Horizontal scroll */}
            <div className="md:hidden overflow-x-auto scrollbar-hide">
              <div className="flex gap-3 pb-2" style={{ scrollSnapType: 'x mandatory' }}>
                <button
                  onClick={() => apply_category_filter(null)}
                  className={`flex-shrink-0 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    active_category_filter === null
                      ? 'bg-yellow-400 text-black shadow-lg'
                      : 'bg-white text-gray-700 border-2 border-gray-200'
                  }`}
                  style={{ scrollSnapAlign: 'start' }}
                >
                  All Services
                </button>
                
                {service_categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => apply_category_filter(category.slug)}
                    className={`flex-shrink-0 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                      active_category_filter === category.slug
                        ? 'bg-yellow-400 text-black shadow-lg'
                        : 'bg-white text-gray-700 border-2 border-gray-200'
                    }`}
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Info */}
          {!is_loading && (
            <div className="mb-6">
              <p className="text-gray-600 text-sm">
                {services.length === 0 
                  ? 'No services found'
                  : `${services.length} service${services.length !== 1 ? 's' : ''} found`
                }
                {active_category_filter && (
                  <span className="ml-1">
                    in <span className="font-medium">{service_categories.find(c => c.slug === active_category_filter)?.name}</span>
                  </span>
                )}
                {search_query && (
                  <span className="ml-1">
                    for <span className="font-medium">"{search_query}"</span>
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Loading State */}
          {is_loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 h-48 rounded-t-xl"></div>
                  <div className="bg-white border border-gray-200 border-t-0 rounded-b-xl p-6">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6 mb-4"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !is_loading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Failed to Load Services
              </h3>
              <p className="text-gray-600 mb-6">
                {error instanceof Error ? error.message : 'An error occurred while loading services'}
              </p>
              <button
                onClick={() => refetch()}
                className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State (No Results) */}
          {!is_loading && !error && services.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Services Found
              </h3>
              <p className="text-gray-600 mb-6">
                {search_query 
                  ? `No services match your search "${search_query}"`
                  : active_category_filter
                    ? `No services found in this category`
                    : 'No services are currently available'
                }
              </p>
              {(active_category_filter || search_query) && (
                <button
                  onClick={clear_filters}
                  className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors duration-200"
                >
                  View All Services
                </button>
              )}
            </div>
          )}

          {/* Services Grid */}
          {!is_loading && !error && services.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <Link
                  key={service.id}
                  to={`/services/${service.slug}`}
                  className="group block bg-white border border-gray-200 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
                >
                  {/* Service Image Placeholder */}
                  <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
                    {/* Icon based on service name */}
                    <div className="text-gray-400 transform group-hover:scale-110 transition-transform duration-200">
                      {service.name.toLowerCase().includes('card') ? (
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      ) : service.name.toLowerCase().includes('vehicle') ? (
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      ) : service.name.toLowerCase().includes('sign') ? (
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                      ) : service.name.toLowerCase().includes('print') || service.name.toLowerCase().includes('poster') ? (
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      ) : service.name.toLowerCase().includes('stamp') || service.name.toLowerCase().includes('sticker') ? (
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      ) : (
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      )}
                    </div>

                    {/* Top Seller Badge */}
                    {service.is_top_seller && (
                      <div className="absolute top-4 right-4 bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                        Top Seller
                      </div>
                    )}
                  </div>

                  {/* Service Details */}
                  <div className="p-6">
                    {/* Service Name */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-yellow-600 transition-colors">
                      {service.name}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-3">
                      {service.description || 'Professional service with our signature quality and discipline.'}
                    </p>

                    {/* Starting Tier Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        Starting at {get_starting_tier(service)}
                      </span>

                      {/* Required Badges */}
                      <div className="flex gap-2">
                        {service.requires_booking && (
                          <span className="inline-flex items-center text-xs text-gray-500" title="Requires booking">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </span>
                        )}
                        {service.requires_proof && (
                          <span className="inline-flex items-center text-xs text-gray-500" title="Includes proofing">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* View Details Button */}
                    <div className="flex items-center justify-between text-sm font-medium text-yellow-600 group-hover:text-yellow-700">
                      <span>View Details</span>
                      <svg
                        className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-200"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* CTA Section (Bottom) */}
          {!is_loading && !error && services.length > 0 && (
            <div className="mt-16 text-center bg-gray-50 rounded-xl p-8 lg:p-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Ready to Get Started?
              </h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto leading-relaxed">
                Choose a service above to view details and pricing, or start your quote right away.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/app/quotes/new"
                  className="px-8 py-4 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-500 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Get a Quote
                </Link>
                <Link
                  to="/contact"
                  className="px-8 py-4 bg-white text-black font-bold rounded-lg border-2 border-black hover:bg-black hover:text-white transition-all duration-200"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Scrollbar Hide CSS (for mobile category chips) */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      {/* Mobile Sticky CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40 shadow-lg">
        <Link
          to="/app/quotes/new"
          className="block w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-lg text-center transition-all duration-200"
        >
          Get a Free Quote
        </Link>
      </div>

      {/* Desktop Floating Sticky CTA */}
      <div
        className={`hidden md:flex fixed bottom-8 right-8 z-40 transition-all duration-300 ${
          showStickyCTA ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <Link
          to="/app/quotes/new"
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-6 py-4 rounded-full shadow-2xl transition-all duration-200 flex items-center gap-3 group"
        >
          <svg className="h-6 w-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>Get a Quote</span>
          <svg className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </div>
    </>
  );
};

export default UV_PUB_ServicesCatalog;