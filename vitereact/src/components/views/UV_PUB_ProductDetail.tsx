import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { formatMoney } from '@/lib/utils';

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
  category_name?: string;
  config_schema: ConfigSchema | null;
}

interface ConfigSchema {
  [key: string]: {
    label: string;
    options: { value: string; label: string }[];
    default: string;
  };
}

interface ProductVariant {
  id: string;
  product_id: string;
  label: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  compare_at_price: number | null;
  discount_label: string | null;
  sort_order: number;
}

interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
}

interface ProductResponse {
  product: Product;
  variants: ProductVariant[];
  images: ProductImage[];
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchProduct = async (slug: string): Promise<ProductResponse> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const response = await axios.get<ProductResponse>(`${API_BASE_URL}/api/public/products/${slug}`);
  
  // Ensure all numeric fields are actually numbers (PostgreSQL may return them as strings)
  const data = response.data;
  if (data.variants) {
    data.variants = data.variants.map(v => ({
      ...v,
      quantity: Number(v.quantity),
      unit_price: Number(v.unit_price),
      total_price: Number(v.total_price),
      compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
      sort_order: Number(v.sort_order),
    }));
  }
  if (data.product) {
    data.product.base_price = Number(data.product.base_price);
  }
  
  return data;
};

const addToCart = async (data: {
  product_id: string;
  product_variant_id: string | null;
  quantity: number;
  config: Record<string, string>;
}, guestId: string | null, authToken: string | null): Promise<{ item: any; guest_id: string }> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (guestId) headers['x-guest-id'] = guestId;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  const response = await axios.post(`${API_BASE_URL}/api/cart/items`, data, { headers });
  return response.data;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editItemId = searchParams.get('edit');
  
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const show_toast = useAppStore(state => state.show_toast);
  
  // Local state
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<Record<string, string>>({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(() => localStorage.getItem('guest_cart_id'));

  // ===========================
  // DATA FETCHING
  // ===========================

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => fetchProduct(slug!),
    enabled: !!slug,
    staleTime: 60000,
  });

  const product = data?.product;
  const variants = data?.variants || [];
  const images = data?.images || [];
  const configSchema = product?.config_schema;

  // Initialize defaults
  useEffect(() => {
    if (variants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(variants[0].id);
    }
  }, [variants, selectedVariantId]);

  useEffect(() => {
    if (configSchema && Object.keys(selectedConfig).length === 0) {
      const defaults: Record<string, string> = {};
      Object.entries(configSchema).forEach(([key, config]) => {
        defaults[key] = config.default;
      });
      setSelectedConfig(defaults);
    }
  }, [configSchema, selectedConfig]);

  // ===========================
  // COMPUTED VALUES
  // ===========================

  const selectedVariant = variants.find(v => v.id === selectedVariantId);
  const currentPrice = selectedVariant?.total_price || product?.base_price || 0;
  const compareAtPrice = selectedVariant?.compare_at_price;
  const discountLabel = selectedVariant?.discount_label;
  const unitPrice = selectedVariant?.unit_price || 0;
  const quantity = selectedVariant?.quantity || 1;

  const primaryImage = images.find(img => img.is_primary) || images[0];
  const displayImages = images.length > 0 ? images : [{ id: '1', image_url: product?.thumbnail_url || '', alt_text: product?.name || '', sort_order: 0, is_primary: true, product_id: '' }];

  // ===========================
  // ACTIONS
  // ===========================

  const handleAddToCart = async () => {
    if (!product) return;
    
    setIsAddingToCart(true);
    try {
      const result = await addToCart({
        product_id: product.id,
        product_variant_id: selectedVariantId,
        quantity: 1,
        config: selectedConfig,
      }, guestId, authToken);
      
      // Save guest ID for future requests
      if (result.guest_id && !authToken) {
        localStorage.setItem('guest_cart_id', result.guest_id);
        setGuestId(result.guest_id);
      }
      
      show_toast({
        type: 'success',
        message: `${product.name} added to cart!`,
        duration: 3000,
      });
      
      // Navigate to cart
      navigate('/cart');
    } catch (err: any) {
      show_toast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to add to cart',
        duration: 5000,
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleConfigChange = (key: string, value: string) => {
    setSelectedConfig(prev => ({ ...prev, [key]: value }));
  };

  // ===========================
  // RENDER
  // ===========================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 w-24 bg-gray-200 rounded mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="aspect-square bg-gray-200 rounded-xl"></div>
              <div className="space-y-4">
                <div className="h-10 bg-gray-200 rounded w-3/4"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product not found</h2>
          <Link to="/products" className="text-yellow-600 hover:underline">
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-8">
      {/* Back Navigation */}
      <div className="sticky top-20 bg-white border-b border-gray-100 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/products"
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Products
            </Link>
            <Link
              to="/cart"
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Images */}
          <div>
            {/* Main Image */}
            <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-4">
              {displayImages[activeImageIndex]?.image_url ? (
                <img
                  src={displayImages[activeImageIndex].image_url}
                  alt={displayImages[activeImageIndex].alt_text || product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <svg className="w-24 h-24 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {displayImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {displayImages.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      idx === activeImageIndex ? 'border-yellow-400' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Info */}
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">{product.name}</h1>
            
            {product.category_name && (
              <p className="text-gray-500 mb-4">{product.category_name}</p>
            )}
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              {product.description || 'High-quality print product with professional finish and fast delivery.'}
            </p>

            {/* Configuration Options */}
            {configSchema && Object.keys(configSchema).length > 0 && (
              <div className="space-y-6 mb-8">
                {Object.entries(configSchema).map(([key, config]) => (
                  <div key={key}>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      {config.label}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {config.options.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handleConfigChange(key, option.value)}
                          className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            selectedConfig[key] === option.value
                              ? 'border-yellow-400 bg-yellow-50 text-gray-900'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quantity/Variant Selection */}
            {variants.length > 0 && (
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  How many?
                </label>
                <div className="space-y-2">
                  {variants.map((variant) => {
                    // Defensive check: ensure prices are valid numbers
                    const totalPrice = Number(variant.total_price);
                    const unitPrice = Number(variant.unit_price);
                    const comparePrice = variant.compare_at_price ? Number(variant.compare_at_price) : null;
                    
                    if (!Number.isFinite(totalPrice) || !Number.isFinite(unitPrice)) {
                      console.warn('Invalid pricing data for variant:', variant);
                      return null; // Skip rendering this variant
                    }
                    
                    return (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border-2 transition-all ${
                          selectedVariantId === variant.id
                            ? 'border-yellow-400 bg-yellow-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedVariantId === variant.id
                              ? 'border-yellow-400 bg-yellow-400'
                              : 'border-gray-300'
                          }`}>
                            {selectedVariantId === variant.id && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="font-medium text-gray-900">{variant.label}</span>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{formatMoney(totalPrice)}</span>
                            {comparePrice && Number.isFinite(comparePrice) && (
                              <span className="text-sm text-gray-400 line-through">{formatMoney(comparePrice)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">{formatMoney(unitPrice)} each</span>
                            {variant.discount_label && (
                              <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded">
                                {variant.discount_label}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Desktop Add to Cart */}
            <div className="hidden lg:block">
              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-600">Subtotal</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-900">{formatMoney(currentPrice)}</span>
                    {compareAtPrice && Number.isFinite(Number(compareAtPrice)) && (
                      <span className="ml-2 text-gray-400 line-through">{formatMoney(compareAtPrice)}</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-green-600 mb-4">+ FREE delivery</p>
                <button
                  onClick={handleAddToCart}
                  disabled={isAddingToCart}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-300 text-black font-bold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  {isAddingToCart ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      {editItemId ? 'Update Cart' : 'Add to Cart'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-2xl font-bold text-gray-900">{formatMoney(currentPrice)}</span>
            {compareAtPrice && Number.isFinite(Number(compareAtPrice)) && (
              <span className="ml-2 text-sm text-gray-400 line-through">{formatMoney(compareAtPrice)}</span>
            )}
          </div>
          <span className="text-sm text-green-600">+ FREE delivery</span>
        </div>
        <button
          onClick={handleAddToCart}
          disabled={isAddingToCart}
          className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-300 text-black font-bold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {isAddingToCart ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Adding...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {editItemId ? 'Update Cart' : 'Add to Cart'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default UV_PUB_ProductDetail;
