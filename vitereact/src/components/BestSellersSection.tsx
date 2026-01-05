import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface BestSellerProduct {
  name: string;
  slug: string;
  badge: 'Popular' | 'Best Value';
  startingPrice: string;
  icon: React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
  badgeColor: string;
}

// =====================================================
// BEST SELLERS DATA
// =====================================================

const BEST_SELLERS: BestSellerProduct[] = [
  {
    name: 'Business Cards',
    slug: '/products/business-cards',
    badge: 'Popular',
    startingPrice: '€17.50',
    gradientFrom: 'from-blue-400',
    gradientTo: 'to-blue-600',
    badgeColor: 'bg-emerald-500',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    name: 'Flyers',
    slug: '/products/flyers',
    badge: 'Best Value',
    startingPrice: '€25',
    gradientFrom: 'from-purple-400',
    gradientTo: 'to-purple-600',
    badgeColor: 'bg-sky-500',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: 'Vinyl Banners',
    slug: '/products/vinyl-banners',
    badge: 'Popular',
    startingPrice: '€40',
    gradientFrom: 'from-orange-400',
    gradientTo: 'to-orange-600',
    badgeColor: 'bg-emerald-500',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: 'Stickers',
    slug: '/products/stickers',
    badge: 'Best Value',
    startingPrice: '€12',
    gradientFrom: 'from-pink-400',
    gradientTo: 'to-pink-600',
    badgeColor: 'bg-sky-500',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
];

// =====================================================
// PRODUCT CARD COMPONENT
// =====================================================

interface ProductCardProps {
  product: BestSellerProduct;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <Link
      to={product.slug}
      className="group relative bg-white rounded-lg sm:rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100"
    >
      {/* Colored gradient top area - COMPACT on mobile */}
      <div className={`relative h-16 sm:h-28 md:h-32 lg:h-36 bg-gradient-to-br ${product.gradientFrom} ${product.gradientTo} flex items-center justify-center`}>
        {/* Badge in top-right corner - scaled down on mobile */}
        <div className="absolute top-1.5 right-1.5 sm:top-3 sm:right-3">
          <span className={`${product.badgeColor} text-white text-[9px] sm:text-xs font-bold px-1.5 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-md`}>
            {product.badge}
          </span>
        </div>
        
        {/* Icon in center - smaller on mobile */}
        <div className="transform group-hover:scale-110 transition-transform duration-300 scale-75 sm:scale-100">
          {product.icon}
        </div>
      </div>

      {/* Card content - COMPACT padding on mobile */}
      <div className="p-2.5 sm:p-4 md:p-5">
        {/* Title - clamped to 1-2 lines */}
        <h3 className="text-xs sm:text-base md:text-lg font-bold text-gray-900 mb-1 sm:mb-2 group-hover:text-yellow-600 transition-colors line-clamp-2 leading-tight sm:leading-normal">
          {product.name}
        </h3>
        
        {product.startingPrice && (
          <p className="text-[11px] sm:text-sm md:text-base text-gray-700 font-semibold mb-2 sm:mb-3">
            <span className="text-yellow-600">From {product.startingPrice}</span>
          </p>
        )}

        {/* CTA Button - smaller and full-width on mobile */}
        <button className="w-full bg-yellow-500 text-black font-bold text-[11px] sm:text-sm md:text-base py-1.5 sm:py-2.5 md:py-3 px-2 sm:px-3 md:px-4 rounded-md sm:rounded-lg hover:bg-yellow-600 transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 shadow-sm min-h-[32px] sm:min-h-[40px]">
          Order Now
          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
        </button>
      </div>
    </Link>
  );
};

// =====================================================
// MAIN BEST SELLERS SECTION COMPONENT
// =====================================================

const BestSellersSection: React.FC = () => {
  return (
    <section className="py-8 sm:py-12 lg:py-28 bg-white pb-24 sm:pb-12 lg:pb-28">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Section Header - Compact on mobile, premium on desktop */}
        <div className="text-center mb-6 sm:mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-gray-900 mb-2 sm:mb-3 lg:mb-4">
            Best Sellers — Our Most Ordered Print Products
          </h2>
          <p className="text-sm sm:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Fast turnaround, premium finish, and clear pricing — trusted by businesses across Ireland.
          </p>
        </div>

        {/* Product Grid - Dense 2-col on mobile with proper padding */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
          {BEST_SELLERS.map((product) => (
            <ProductCard key={product.name} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default BestSellersSection;
