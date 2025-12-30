import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  base_price: number;
  thumbnail_url: string | null;
  category_id: string | null;
  category_name?: string;
  category_slug?: string;
  is_active: boolean;
  from_price?: number;
}

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

interface ProductsResponse {
  products: Product[];
  categories: ProductCategory[];
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchProducts = async (
  category?: string | null,
  search?: string | null
): Promise<ProductsResponse> => {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (search && search.trim()) params.append('search', search.trim());

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const url = `${API_BASE_URL}/api/public/products${params.toString() ? '?' + params.toString() : ''}`;

  const response = await axios.get<ProductsResponse>(url);
  return response.data;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_ProductsCatalog: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(
    searchParams.get('category')
  );
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '');
  const [searchInput, setSearchInput] = useState<string>(searchParams.get('search') || '');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show_toast = useAppStore(state => state.show_toast);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // ===========================
  // DATA FETCHING
  // ===========================

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['products', activeCategoryFilter, searchQuery],
    queryFn: () => fetchProducts(activeCategoryFilter, searchQuery),
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const products = data?.products || [];
  const categories = data?.categories || [];

  // ===========================
  // URL SYNC
  // ===========================

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategoryFilter) params.set('category', activeCategoryFilter);
    if (searchQuery) params.set('search', searchQuery);
    setSearchParams(params, { replace: true });
  }, [activeCategoryFilter, searchQuery, setSearchParams]);

  // ===========================
  // ACTIONS
  // ===========================

  const handleCategoryFilter = (categorySlug: string | null) => {
    setActiveCategoryFilter(categorySlug);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  const clearFilters = () => {
    setActiveCategoryFilter(null);
    setSearchQuery('');
    setSearchInput('');
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);

    if (value.length >= 3 || value.length === 0) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        setSearchQuery(value);
      }, 500);
    }
  };

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Header Section */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-b-2 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Shop Products
              </h1>
              <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Browse our ready-to-order print products. Customize, add to cart, and checkout - no quotes needed!
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          {/* Search Bar */}
          <div className="mb-8">
            <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={searchInput}
                  onChange={handleSearchInputChange}
                  placeholder="Search products..."
                  className="w-full px-4 py-3 pl-12 rounded-lg border-2 border-gray-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 focus:outline-none text-base transition-all"
                />
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(''); setSearchQuery(''); }}
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
              {(activeCategoryFilter || searchQuery) && (
                <button onClick={clearFilters} className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
                  Clear Filters
                </button>
              )}
            </div>

            {/* Desktop: Flex wrap */}
            <div className="hidden md:flex flex-wrap gap-3">
              <button
                onClick={() => handleCategoryFilter(null)}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  activeCategoryFilter === null
                    ? 'bg-yellow-400 text-black shadow-lg'
                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300'
                }`}
              >
                All Products
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryFilter(category.slug)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    activeCategoryFilter === category.slug
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
              <div className="flex gap-3 pb-2">
                <button
                  onClick={() => handleCategoryFilter(null)}
                  className={`flex-shrink-0 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    activeCategoryFilter === null
                      ? 'bg-yellow-400 text-black shadow-lg'
                      : 'bg-white text-gray-700 border-2 border-gray-200'
                  }`}
                >
                  All Products
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryFilter(category.slug)}
                    className={`flex-shrink-0 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                      activeCategoryFilter === category.slug
                        ? 'bg-yellow-400 text-black shadow-lg'
                        : 'bg-white text-gray-700 border-2 border-gray-200'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Info */}
          {!isLoading && (
            <div className="mb-6">
              <p className="text-gray-600 text-sm">
                {products.length === 0
                  ? 'No products found'
                  : `${products.length} product${products.length !== 1 ? 's' : ''} found`}
                {activeCategoryFilter && (
                  <span className="ml-1">
                    in <span className="font-medium">{categories.find(c => c.slug === activeCategoryFilter)?.name}</span>
                  </span>
                )}
                {searchQuery && (
                  <span className="ml-1">
                    for <span className="font-medium">"{searchQuery}"</span>
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
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
          {error && !isLoading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Products</h3>
              <p className="text-gray-600 mb-6">
                {error instanceof Error ? error.message : 'An error occurred while loading products'}
              </p>
              <button
                onClick={() => refetch()}
                className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && products.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? `No products match your search "${searchQuery}"`
                  : activeCategoryFilter
                    ? 'No products found in this category'
                    : 'No products are currently available'}
              </p>
              {(activeCategoryFilter || searchQuery) && (
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors duration-200"
                >
                  View All Products
                </button>
              )}
            </div>
          )}

          {/* Products Grid */}
          {!isLoading && !error && products.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <Link
                  key={product.id}
                  to={`/products/${product.slug}`}
                  className="group block bg-white border border-gray-200 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
                >
                  {/* Product Image */}
                  <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                    {product.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    {/* Direct Purchase Badge */}
                    <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      Direct Buy
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-yellow-600 transition-colors">
                      {product.name}
                    </h3>

                    <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-2">
                      {product.description || 'High-quality print product with fast delivery.'}
                    </p>

                    {/* Price */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-lg font-bold text-gray-900">
                        From €{(product.from_price || product.base_price).toFixed(2)}
                      </span>
                      {product.category_name && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {product.category_name}
                        </span>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="flex items-center justify-between">
                      <span className="text-yellow-600 font-semibold group-hover:text-yellow-700">
                        Customize & Buy
                      </span>
                      <svg
                        className="w-5 h-5 text-yellow-600 transform group-hover:translate-x-1 transition-transform duration-200"
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

          {/* Bottom CTA */}
          {!isLoading && !error && products.length > 0 && (
            <div className="mt-16 text-center bg-gray-50 rounded-xl p-8 lg:p-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Need Something Custom?
              </h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto leading-relaxed">
                Can't find what you're looking for? Our Services section offers custom quote-based solutions for complex projects.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/services"
                  className="px-8 py-4 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-500 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  View Services
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

      {/* Custom Scrollbar Hide CSS */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </>
  );
};

export default UV_PUB_ProductsCatalog;
