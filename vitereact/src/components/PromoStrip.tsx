import React from 'react';
import { Link } from 'react-router-dom';
import { Tag, Package, Truck } from 'lucide-react';

// =====================================================
// PROMO STRIP COMPONENT
// =====================================================

const PromoStrip: React.FC = () => {
  return (
    <section className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
          {/* Special Offers */}
          <Link
            to="/pricing"
            className="flex items-center gap-2 group hover:scale-105 transition-transform duration-200"
          >
            <div className="w-8 h-8 flex items-center justify-center bg-amber-600 rounded-full">
              <Tag className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-900 font-semibold text-sm group-hover:text-slate-800 transition-colors">
              Special Offers
            </span>
          </Link>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-amber-600/30"></div>

          {/* Bulk Discounts */}
          <Link
            to="/pricing"
            className="flex items-center gap-2 group hover:scale-105 transition-transform duration-200"
          >
            <div className="w-8 h-8 flex items-center justify-center bg-amber-600 rounded-full">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-900 font-semibold text-sm group-hover:text-slate-800 transition-colors">
              Bulk Discounts
            </span>
          </Link>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-amber-600/30"></div>

          {/* Free Delivery */}
          <Link
            to="/products"
            className="flex items-center gap-2 group hover:scale-105 transition-transform duration-200"
          >
            <div className="w-8 h-8 flex items-center justify-center bg-amber-600 rounded-full">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-900 font-semibold text-sm group-hover:text-slate-800 transition-colors">
              Free Delivery on Select Orders
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PromoStrip;
