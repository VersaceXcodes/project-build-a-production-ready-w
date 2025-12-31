import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { formatMoney } from '@/lib/utils';
import DesignUploadSection from './DesignUploadSection';

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
    options: { value: string; label: string; description?: string }[];
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

interface PrintSide {
  key: string;
  label: string;
  required: boolean;
}

interface PrintConfig {
  product_id: string;
  sides: PrintSide[];
  requires_design_upload: boolean;
}

interface UploadedDesign {
  id: string;
  file_url: string;
  file_type: string;
  original_filename: string;
  num_pages: number;
  preview_images: string[];
}

interface PageMapping {
  [sideKey: string]: number | null;
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchProduct = async (slug: string): Promise<ProductResponse> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const response = await axios.get<ProductResponse>(`${API_BASE_URL}/api/public/products/${slug}`);
  
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

const fetchPrintConfig = async (slug: string): Promise<PrintConfig | null> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  try {
    const response = await axios.get<PrintConfig>(`${API_BASE_URL}/api/public/products/${slug}/print-config`);
    return response.data;
  } catch (err) {
    console.error('Failed to fetch print config:', err);
    return null;
  }
};

const addToCart = async (data: {
  product_id: string;
  product_variant_id: string | null;
  quantity: number;
  config: Record<string, string>;
  design_upload_id?: string;
  page_mapping?: PageMapping;
}, guestId: string | null, authToken: string | null): Promise<{ item: any; guest_id: string }> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (guestId) headers['x-guest-id'] = guestId;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  const response = await axios.post(`${API_BASE_URL}/api/cart/items`, data, { headers });
  return response.data;
};

// ===========================
// SUB-COMPONENTS
// ===========================

// Option Card Component
const OptionCard: React.FC<{
  label: string;
  description?: string;
  isSelected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}> = ({ label, description, isSelected, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`
      relative w-full p-4 rounded-xl border-2 text-left transition-all duration-200
      transform hover:scale-[1.02] active:scale-[0.98]
      ${isSelected
        ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-lg shadow-yellow-100'
        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
      }
    `}
  >
    <div className="flex items-start gap-3">
      {icon && (
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
          isSelected ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-500'
        }`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
            {label}
          </span>
          {isSelected && (
            <span className="flex-shrink-0 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{description}</p>
        )}
      </div>
    </div>
  </button>
);

// Pricing Tile Component
const PricingTile: React.FC<{
  variant: ProductVariant;
  isSelected: boolean;
  onClick: () => void;
  isPopular?: boolean;
}> = ({ variant, isSelected, onClick, isPopular }) => {
  const totalPrice = Number(variant.total_price);
  const unitPrice = Number(variant.unit_price);
  const comparePrice = variant.compare_at_price ? Number(variant.compare_at_price) : null;
  
  // Calculate discount percentage
  const discountPercent = comparePrice && comparePrice > totalPrice
    ? Math.round(((comparePrice - totalPrice) / comparePrice) * 100)
    : null;

  return (
    <button
      onClick={onClick}
      className={`
        relative w-full p-5 rounded-2xl border-2 text-left transition-all duration-300
        transform hover:scale-[1.02] active:scale-[0.98]
        ${isSelected
          ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 shadow-xl shadow-yellow-200/50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'
        }
      `}
    >
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute -top-3 left-4">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Popular
          </span>
        </div>
      )}

      {/* Discount Badge */}
      {discountPercent && discountPercent > 0 && (
        <div className="absolute -top-3 right-4">
          <span className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full shadow-lg">
            {discountPercent}% OFF
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {/* Left: Quantity and Selection Indicator */}
        <div className="flex items-center gap-4">
          <div className={`
            w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
            ${isSelected
              ? 'border-yellow-400 bg-yellow-400'
              : 'border-gray-300 bg-white'
            }
          `}>
            {isSelected && (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div>
            <span className="text-lg font-bold text-gray-900">{variant.label}</span>
            <p className="text-sm text-gray-500">{formatMoney(unitPrice)} per unit</p>
          </div>
        </div>

        {/* Right: Price */}
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-2xl font-bold text-gray-900">{formatMoney(totalPrice)}</span>
          </div>
          {comparePrice && comparePrice > totalPrice && (
            <span className="text-sm text-gray-400 line-through">{formatMoney(comparePrice)}</span>
          )}
          {variant.discount_label && !discountPercent && (
            <span className="inline-block mt-1 text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
              {variant.discount_label}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

// Image Lightbox Component
const ImageLightbox: React.FC<{
  images: ProductImage[];
  activeIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}> = ({ images, activeIndex, onClose, onPrev, onNext }) => (
  <div 
    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
    onClick={onClose}
  >
    <button
      onClick={onClose}
      className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
    
    {images.length > 1 && (
      <>
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </>
    )}
    
    <div className="max-w-5xl max-h-[85vh] p-4" onClick={(e) => e.stopPropagation()}>
      <img
        src={images[activeIndex]?.image_url}
        alt={images[activeIndex]?.alt_text || ''}
        className="max-w-full max-h-[80vh] object-contain rounded-lg"
      />
    </div>
    
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
      {images.map((_, idx) => (
        <button
          key={idx}
          onClick={(e) => { e.stopPropagation(); }}
          className={`w-2 h-2 rounded-full transition-all ${
            idx === activeIndex ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'
          }`}
        />
      ))}
    </div>
  </div>
);

// View Tabs Component
const ViewTabs: React.FC<{
  activeView: string;
  onViewChange: (view: string) => void;
  hasBackView: boolean;
  hasLifestyleMockups: boolean;
}> = ({ activeView, onViewChange, hasBackView, hasLifestyleMockups }) => {
  const views = [
    { id: 'front', label: 'Front', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )},
    ...(hasBackView ? [{ id: 'back', label: 'Back', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )}] : []),
    ...(hasLifestyleMockups ? [{ id: 'lifestyle', label: 'In Use', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )}] : []),
  ];

  return (
    <div className="inline-flex bg-gray-100 rounded-xl p-1">
      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => onViewChange(view.id)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${activeView === view.id
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          {view.icon}
          {view.label}
        </button>
      ))}
    </div>
  );
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const editItemId = searchParams.get('edit');
  
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const show_toast = useAppStore(state => state.show_toast);
  const incrementCartCount = useAppStore(state => state.increment_cart_count);
  
  // Local state
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<Record<string, string>>({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeView, setActiveView] = useState('front');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(() => localStorage.getItem('guest_cart_id'));
  
  // Design upload state
  const [uploadedDesign, setUploadedDesign] = useState<UploadedDesign | null>(null);
  const [pageMapping, setPageMapping] = useState<PageMapping>({});
  const [sessionId] = useState<string>(() => {
    let sid = sessionStorage.getItem('design_session_id');
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('design_session_id', sid);
    }
    return sid;
  });

  // ===========================
  // DATA FETCHING
  // ===========================

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => fetchProduct(slug!),
    enabled: !!slug,
    staleTime: 60000,
  });

  const { data: printConfig } = useQuery({
    queryKey: ['print-config', slug],
    queryFn: () => fetchPrintConfig(slug!),
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
      // Select the most popular variant (usually the middle one) by default
      const popularIndex = Math.min(1, variants.length - 1);
      setSelectedVariantId(variants[popularIndex].id);
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
  const unitPrice = selectedVariant?.unit_price || 0;
  const quantity = selectedVariant?.quantity || 1;

  // Calculate VAT (assuming 15% VAT)
  const vatRate = 0.15;
  const subtotal = currentPrice;
  const vatAmount = subtotal * vatRate;
  const deliveryFee = 0; // Free delivery
  const totalPrice = subtotal + vatAmount + deliveryFee;

  const displayImages = images.length > 0 
    ? images 
    : [{ id: '1', image_url: product?.thumbnail_url || '', alt_text: product?.name || '', sort_order: 0, is_primary: true, product_id: '' }];

  // Check if product has back view or lifestyle mockups (based on image count or naming)
  const hasBackView = displayImages.length > 1;
  const hasLifestyleMockups = displayImages.length > 2;

  // Filter images based on active view
  const getFilteredImages = () => {
    // For now, return all images - in the future this could filter by view type
    return displayImages;
  };

  // Check if design requirements are met
  const isDesignRequired = printConfig?.requires_design_upload ?? false;
  const requiredSides = printConfig?.sides?.filter(s => s.required) || [];
  const allRequiredSidesMapped = requiredSides.every(
    side => pageMapping[side.key] !== null && pageMapping[side.key] !== undefined
  );
  const isDesignValid = !isDesignRequired || (uploadedDesign !== null && allRequiredSidesMapped);
  const canAddToCart = selectedVariantId !== null && isDesignValid;

  // ===========================
  // ACTIONS
  // ===========================

  const handleAddToCart = async () => {
    if (!product || !canAddToCart) return;
    
    setIsAddingToCart(true);
    try {
      const cartData: {
        product_id: string;
        product_variant_id: string | null;
        quantity: number;
        config: Record<string, string>;
        design_upload_id?: string;
        page_mapping?: PageMapping;
      } = {
        product_id: product.id,
        product_variant_id: selectedVariantId,
        quantity: 1,
        config: selectedConfig,
      };
      
      if (uploadedDesign) {
        cartData.design_upload_id = uploadedDesign.id;
        cartData.page_mapping = pageMapping;
      }
      
      const result = await addToCart(cartData, guestId, authToken);
      
      if (uploadedDesign && result.item?.id) {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        try {
          await axios.patch(`${API_BASE_URL}/api/design-uploads/${uploadedDesign.id}/link-cart`, {
            cart_item_id: result.item.id,
          });
        } catch (linkErr) {
          console.error('Failed to link design to cart item:', linkErr);
        }
      }
      
      if (result.guest_id && !authToken) {
        localStorage.setItem('guest_cart_id', result.guest_id);
        setGuestId(result.guest_id);
      }
      
      // Enhanced toast message with action buttons
      show_toast({
        type: 'success',
        message: `Added to cart - Continue shopping or view cart`,
        duration: 5000,
      });
      
      incrementCartCount();
      
      // Reset design state
      setUploadedDesign(null);
      setPageMapping({});
      
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

  const handleDesignChange = (design: UploadedDesign | null, mapping: PageMapping) => {
    setUploadedDesign(design);
    setPageMapping(mapping);
  };

  const handlePrevImage = useCallback(() => {
    setActiveImageIndex(prev => prev === 0 ? displayImages.length - 1 : prev - 1);
  }, [displayImages.length]);

  const handleNextImage = useCallback(() => {
    setActiveImageIndex(prev => prev === displayImages.length - 1 ? 0 : prev + 1);
  }, [displayImages.length]);

  // Get icon for config option
  const getConfigIcon = (key: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      paper_type: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      finish: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      print_sides: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      size: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      ),
    };
    return iconMap[key] || iconMap['paper_type'];
  };

  // ===========================
  // RENDER
  // ===========================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 w-32 bg-gray-200 rounded-lg mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
              <div className="lg:col-span-3">
                <div className="aspect-square bg-gray-200 rounded-2xl mb-4"></div>
                <div className="flex gap-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-20 h-20 bg-gray-200 rounded-xl"></div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2 space-y-6">
                <div className="h-10 bg-gray-200 rounded-lg w-3/4"></div>
                <div className="h-6 bg-gray-200 rounded-lg w-1/2"></div>
                <div className="h-32 bg-gray-200 rounded-xl"></div>
                <div className="h-32 bg-gray-200 rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product not found</h2>
          <p className="text-gray-600 mb-6">The product you're looking for doesn't exist or has been removed.</p>
          <Link 
            to="/products" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-40 lg:pb-8">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Link to="/products" className="text-gray-500 hover:text-gray-700 transition-colors">
                Products
              </Link>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {product.category_name && (
                <>
                  <span className="text-gray-500">{product.category_name}</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
              <span className="text-gray-900 font-medium truncate max-w-[200px]">{product.name}</span>
            </div>
            <Link
              to="/cart"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="hidden sm:inline text-sm font-medium">Cart</span>
            </Link>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
          
          {/* ================================ */}
          {/* LEFT SIDE - Visual Preview Area */}
          {/* ================================ */}
          <div className="lg:col-span-3">
            {/* View Toggle Tabs */}
            <div className="mb-4">
              <ViewTabs
                activeView={activeView}
                onViewChange={setActiveView}
                hasBackView={hasBackView}
                hasLifestyleMockups={hasLifestyleMockups}
              />
            </div>

            {/* Main Product Image */}
            <div 
              className="relative aspect-square bg-white rounded-2xl overflow-hidden shadow-lg cursor-zoom-in group"
              onClick={() => setIsLightboxOpen(true)}
            >
              {displayImages[activeImageIndex]?.image_url ? (
                <>
                  <img
                    src={displayImages[activeImageIndex].image_url}
                    alt={displayImages[activeImageIndex].alt_text || product.name}
                    className="w-full h-full object-contain p-8 transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Zoom hint overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Click to zoom</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <svg className="w-24 h-24 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-500">Product preview</p>
                  </div>
                </div>
              )}

              {/* Image navigation arrows */}
              {displayImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}

              {/* Fullscreen button */}
              <button
                onClick={(e) => { e.stopPropagation(); setIsLightboxOpen(true); }}
                className="absolute top-4 right-4 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>

            {/* Thumbnail Carousel */}
            {displayImages.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2 px-1">
                {displayImages.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`
                      flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-200
                      ${idx === activeImageIndex 
                        ? 'border-yellow-400 shadow-lg shadow-yellow-200/50 scale-105' 
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }
                    `}
                  >
                    <img 
                      src={img.image_url} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Placeholder for future PDF upload preview */}
            <div className="hidden mt-6 p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <div className="text-center">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-600 font-medium">Upload your design (coming soon)</p>
                <p className="text-xs text-gray-500 mt-1">Support for PDF, PNG, JPG</p>
              </div>
            </div>
          </div>

          {/* ================================ */}
          {/* RIGHT SIDE - Guided Options Panel */}
          {/* ================================ */}
          <div className="lg:col-span-2">
            {/* Product Header */}
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                  {product.name}
                </h1>
                {/* Quick info badges */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    In Stock
                  </span>
                </div>
              </div>
              
              {product.category_name && (
                <p className="text-sm text-gray-500 mb-3">{product.category_name}</p>
              )}
              
              <p className="text-gray-600 leading-relaxed">
                {product.description || 'Premium quality print product with professional finish. Fast turnaround and free delivery on all orders.'}
              </p>
            </div>

            {/* Divider */}
            <hr className="border-gray-200 mb-6" />

            {/* ================================ */}
            {/* Configuration Options as Cards */}
            {/* ================================ */}
            {configSchema && Object.keys(configSchema).length > 0 && (
              <div className="space-y-6 mb-8">
                {Object.entries(configSchema).map(([key, config]) => (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                        {getConfigIcon(key)}
                      </span>
                      <label className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                        {config.label}
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {config.options.map((option) => (
                        <OptionCard
                          key={option.value}
                          label={option.label}
                          description={option.description}
                          isSelected={selectedConfig[key] === option.value}
                          onClick={() => handleConfigChange(key, option.value)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ================================ */}
            {/* Quantity & Pricing Tiles */}
            {/* ================================ */}
            {variants.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </span>
                  <label className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Select Quantity
                  </label>
                </div>
                <div className="space-y-3">
                  {variants.map((variant, idx) => {
                    const totalPrice = Number(variant.total_price);
                    const unitPrice = Number(variant.unit_price);
                    
                    if (!Number.isFinite(totalPrice) || !Number.isFinite(unitPrice)) {
                      return null;
                    }
                    
                    // Mark the second variant as popular (usually best value)
                    const isPopular = idx === 1 && variants.length > 2;
                    
                    return (
                      <PricingTile
                        key={variant.id}
                        variant={variant}
                        isSelected={selectedVariantId === variant.id}
                        onClick={() => setSelectedVariantId(variant.id)}
                        isPopular={isPopular}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* ================================ */}
            {/* Design Upload Section */}
            {/* ================================ */}
            {product && (
              <DesignUploadSection
                productId={product.id}
                printConfig={printConfig || null}
                onDesignChange={handleDesignChange}
                sessionId={sessionId}
              />
            )}

            {/* Design Validation Warning */}
            {isDesignRequired && !isDesignValid && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-amber-800">
                      {!uploadedDesign ? 'Design Required' : 'Complete Setup'}
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      {!uploadedDesign
                        ? 'Please upload your design file to continue'
                        : 'Please assign pages to all required print sides'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ================================ */}
            {/* Sticky Price Summary (Desktop) */}
            {/* ================================ */}
            <div className="hidden lg:block sticky bottom-6">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6">
                {/* Price breakdown */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-gray-900">{formatMoney(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">VAT (15%)</span>
                    <span className="text-gray-900">{formatMoney(vatAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Delivery</span>
                    <span className="text-green-600 font-medium">FREE</span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 font-semibold">Total</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-gray-900">{formatMoney(totalPrice)}</span>
                      {compareAtPrice && Number.isFinite(Number(compareAtPrice)) && (
                        <span className="ml-2 text-sm text-gray-400 line-through">
                          {formatMoney(Number(compareAtPrice) * (1 + vatRate))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <button
                  onClick={handleAddToCart}
                  disabled={isAddingToCart || !canAddToCart}
                  className={`
                    w-full font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-3
                    transform hover:scale-[1.02] active:scale-[0.98]
                    ${canAddToCart
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-500 hover:to-amber-500 text-black shadow-lg shadow-yellow-400/30'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  {isAddingToCart ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding to Cart...
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

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Secure checkout
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                    </svg>
                    Free delivery
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================ */}
      {/* Mobile Sticky Bottom Bar */}
      {/* ================================ */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 shadow-2xl">
        <div className="max-w-lg mx-auto px-4 py-4">
          {/* Price summary row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Total (incl. VAT)</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{formatMoney(totalPrice)}</span>
                {compareAtPrice && Number.isFinite(Number(compareAtPrice)) && (
                  <span className="text-sm text-gray-400 line-through">
                    {formatMoney(Number(compareAtPrice) * (1 + vatRate))}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                </svg>
                Free delivery
              </span>
            </div>
          </div>
          
          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={isAddingToCart || !canAddToCart}
            className={`
              w-full font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-3
              ${canAddToCart
                ? 'bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-500 hover:to-amber-500 text-black shadow-lg'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }
            `}
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

      {/* ================================ */}
      {/* Image Lightbox */}
      {/* ================================ */}
      {isLightboxOpen && (
        <ImageLightbox
          images={displayImages}
          activeIndex={activeImageIndex}
          onClose={() => setIsLightboxOpen(false)}
          onPrev={handlePrevImage}
          onNext={handleNextImage}
        />
      )}
    </div>
  );
};

export default UV_PUB_ProductDetail;
