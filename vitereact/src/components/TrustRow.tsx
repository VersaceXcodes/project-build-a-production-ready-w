import React from 'react';
import { Zap, Award, Heart } from 'lucide-react';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface TrustCard {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bgColor: string;
}

// =====================================================
// TRUST CARDS DATA
// =====================================================

const TRUST_CARDS: TrustCard[] = [
  {
    icon: <Zap className="w-6 h-6 text-blue-600" />,
    title: 'Fast Delivery',
    subtitle: 'Quick turnaround times',
    bgColor: 'bg-blue-50',
  },
  {
    icon: <Award className="w-6 h-6 text-emerald-600" />,
    title: 'Premium Quality',
    subtitle: 'Consistent colour & finish',
    bgColor: 'bg-emerald-50',
  },
  {
    icon: <Heart className="w-6 h-6 text-amber-600" />,
    title: 'Local Business Support',
    subtitle: 'Built for Irish SMEs',
    bgColor: 'bg-amber-50',
  },
];

// =====================================================
// TRUST ROW COMPONENT
// =====================================================

const TrustRow: React.FC = () => {
  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TRUST_CARDS.map((card, index) => (
            <div
              key={index}
              className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-gray-200 hover:-translate-y-1"
            >
              <div className="flex items-start gap-4">
                {/* Icon in colored circle */}
                <div className={`${card.bgColor} w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                  {card.icon}
                </div>
                
                {/* Text content */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {card.subtitle}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustRow;
