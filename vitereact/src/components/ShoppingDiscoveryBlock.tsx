import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Store, 
  Megaphone, 
  Truck, 
  ShoppingBag, 
  Package,
  FileText,
  Sparkles,
  Palette,
  Tag,
  Mail,
  CreditCard,
  Home,
  Wrench,
  Car
} from 'lucide-react';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface GoalTile {
  title: string;
  description: string;
  icon: React.ReactNode;
  linkTo: string;
  accentColor: string;
}

interface CategoryTile {
  title: string;
  description: string;
  icon: React.ReactNode;
  linkTo: string;
  type: 'product' | 'service';
  gradientFrom: string;
  gradientTo: string;
}

// =====================================================
// GOAL-BASED NAVIGATION DATA
// =====================================================

const GOAL_TILES: GoalTile[] = [
  {
    title: 'Open a New Shop',
    description: 'Complete starter package for new businesses',
    icon: <Store className="w-6 h-6" />,
    linkTo: '/products/business-cards',
    accentColor: 'from-blue-500 to-indigo-600',
  },
  {
    title: 'Promote an Event',
    description: 'Flyers, posters & banners that get noticed',
    icon: <Megaphone className="w-6 h-6" />,
    linkTo: '/products/flyers',
    accentColor: 'from-purple-500 to-pink-600',
  },
  {
    title: 'Brand My Vehicles',
    description: 'Professional vehicle wraps & graphics',
    icon: <Car className="w-6 h-6" />,
    linkTo: '/services/vehicle-branding',
    accentColor: 'from-emerald-500 to-teal-600',
  },
  {
    title: 'Upgrade Storefront',
    description: 'Signage, window graphics & installations',
    icon: <Home className="w-6 h-6" />,
    linkTo: '/services/signage-installation',
    accentColor: 'from-orange-500 to-red-600',
  },
  {
    title: 'Packaging & Labels',
    description: 'Custom stickers, labels & packaging solutions',
    icon: <Package className="w-6 h-6" />,
    linkTo: '/products/stickers',
    accentColor: 'from-amber-500 to-yellow-600',
  },
];

// =====================================================
// CATEGORY TILES DATA
// =====================================================

const CATEGORY_TILES: CategoryTile[] = [
  // PRODUCTS (brighter, colorful)
  {
    title: 'Business Cards',
    description: 'Premium cards that make lasting impressions',
    icon: <CreditCard className="w-7 h-7" />,
    linkTo: '/products/business-cards',
    type: 'product',
    gradientFrom: 'from-blue-50',
    gradientTo: 'to-indigo-100',
  },
  {
    title: 'Flyers & Posters',
    description: 'Eye-catching promotional materials',
    icon: <FileText className="w-7 h-7" />,
    linkTo: '/products/flyers',
    type: 'product',
    gradientFrom: 'from-purple-50',
    gradientTo: 'to-pink-100',
  },
  {
    title: 'Stickers & Labels',
    description: 'Custom vinyl for products & branding',
    icon: <Tag className="w-7 h-7" />,
    linkTo: '/products/stickers',
    type: 'product',
    gradientFrom: 'from-amber-50',
    gradientTo: 'to-yellow-100',
  },
  {
    title: 'Letterheads',
    description: 'Professional stationery for your brand',
    icon: <Mail className="w-7 h-7" />,
    linkTo: '/products/letterheads',
    type: 'product',
    gradientFrom: 'from-emerald-50',
    gradientTo: 'to-teal-100',
  },
  
  // SERVICES (darker, premium)
  {
    title: 'Signage Installation',
    description: 'Expert installation & setup services',
    icon: <Wrench className="w-7 h-7" />,
    linkTo: '/services',
    type: 'service',
    gradientFrom: 'from-slate-800',
    gradientTo: 'to-slate-900',
  },
  {
    title: 'Vehicle Branding',
    description: 'Professional vehicle wraps & decals',
    icon: <Truck className="w-7 h-7" />,
    linkTo: '/services',
    type: 'service',
    gradientFrom: 'from-slate-800',
    gradientTo: 'to-slate-900',
  },
  {
    title: 'Custom Design',
    description: 'Bespoke design solutions by our team',
    icon: <Palette className="w-7 h-7" />,
    linkTo: '/services',
    type: 'service',
    gradientFrom: 'from-slate-800',
    gradientTo: 'to-slate-900',
  },
  {
    title: 'Premium Finishing',
    description: 'Specialist finishing & lamination',
    icon: <Sparkles className="w-7 h-7" />,
    linkTo: '/services',
    type: 'service',
    gradientFrom: 'from-slate-800',
    gradientTo: 'to-slate-900',
  },
];

// =====================================================
// MAIN COMPONENT
// =====================================================

const ShoppingDiscoveryBlock: React.FC = () => {
  return (
    <section className="py-20 lg:py-28 bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ========== A) START WITH YOUR GOAL ========== */}
        <div className="mb-20">
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-full text-blue-700 text-sm font-semibold tracking-wider uppercase">
                Shop by Goal
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Start with Your Goal
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Tell us what you're trying to achieve, and we'll guide you to the perfect solution
            </p>
          </div>

          {/* Goal Tiles - Horizontal scroll on mobile, grid on desktop */}
          <div className="relative">
            {/* Mobile: Horizontal scroll */}
            <div className="md:hidden overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4">
              <div className="flex gap-4 min-w-max">
                {GOAL_TILES.map((goal, index) => (
                  <Link
                    key={index}
                    to={goal.linkTo}
                    className="group relative bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-transparent w-72 flex-shrink-0"
                  >
                    {/* Gradient accent on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${goal.accentColor} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`}></div>
                    
                    <div className="relative">
                      {/* Icon */}
                      <div className={`w-14 h-14 bg-gradient-to-br ${goal.accentColor} rounded-xl flex items-center justify-center mb-4 text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        {goal.icon}
                      </div>
                      
                      {/* Content */}
                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {goal.title}
                      </h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {goal.description}
                      </p>
                      
                      {/* Arrow indicator */}
                      <div className="mt-4 flex items-center gap-2 text-blue-600 font-semibold text-sm group-hover:gap-3 transition-all">
                        Explore
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Desktop: Grid layout */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              {GOAL_TILES.map((goal, index) => (
                <Link
                  key={index}
                  to={goal.linkTo}
                  className="group relative bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-transparent hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                  aria-label={`${goal.title}: ${goal.description}`}
                >
                  {/* Gradient accent on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${goal.accentColor} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`}></div>
                  
                  <div className="relative">
                    {/* Icon */}
                    <div className={`w-14 h-14 bg-gradient-to-br ${goal.accentColor} rounded-xl flex items-center justify-center mb-4 text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      {goal.icon}
                    </div>
                    
                    {/* Content */}
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {goal.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {goal.description}
                    </p>
                    
                    {/* Arrow indicator */}
                    <div className="mt-4 flex items-center gap-2 text-blue-600 font-semibold text-sm group-hover:gap-3 transition-all">
                      Explore
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Scroll hint for mobile */}
            <div className="md:hidden text-center mt-4">
              <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-bounce-horizontal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Swipe to see more
              </p>
            </div>
          </div>
        </div>

        {/* ========== B) EXPLORE CATEGORIES ========== */}
        <div>
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="px-4 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-full text-amber-700 text-sm font-semibold tracking-wider uppercase">
                Browse Categories
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Explore Our Range
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              From everyday print products to premium installation services
            </p>
          </div>

          {/* Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CATEGORY_TILES.map((category, index) => (
              <Link
                key={index}
                to={category.linkTo}
                className={`group relative rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 hover:-translate-y-1 focus:outline-none focus:ring-4 ${
                  category.type === 'product'
                    ? 'bg-gradient-to-br ' + category.gradientFrom + ' ' + category.gradientTo + ' border-gray-200 hover:border-amber-500/50 focus:ring-amber-500/20'
                    : 'bg-gradient-to-br ' + category.gradientFrom + ' ' + category.gradientTo + ' border-slate-700 hover:border-amber-500/50 focus:ring-amber-500/20 text-white'
                }`}
                aria-label={`${category.title}: ${category.description}`}
              >
                {/* Decorative corner accent */}
                {category.type === 'product' ? (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-400/10 to-yellow-500/10 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                ) : (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
                
                <div className="relative">
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300 ${
                    category.type === 'product'
                      ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white'
                      : 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-900'
                  }`}>
                    {category.icon}
                  </div>
                  
                  {/* Content */}
                  <h3 className={`text-xl font-bold mb-3 transition-colors ${
                    category.type === 'product'
                      ? 'text-gray-900 group-hover:text-amber-600'
                      : 'text-white group-hover:text-amber-400'
                  }`}>
                    {category.title}
                  </h3>
                  <p className={`leading-relaxed mb-6 text-sm ${
                    category.type === 'product'
                      ? 'text-gray-700'
                      : 'text-gray-300'
                  }`}>
                    {category.description}
                  </p>
                  
                  {/* CTA Button */}
                  <span className={`inline-flex items-center gap-2 font-semibold group-hover:gap-3 transition-all ${
                    category.type === 'product'
                      ? 'text-amber-600'
                      : 'text-amber-400'
                  }`}>
                    Shop Now
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* View All CTA */}
          <div className="text-center mt-12">
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold rounded-xl hover:from-amber-400 hover:to-yellow-400 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 min-w-[200px] justify-center"
              >
                All Products
                <ShoppingBag className="w-5 h-5" />
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 min-w-[200px] justify-center"
              >
                All Services
                <Wrench className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ShoppingDiscoveryBlock;
