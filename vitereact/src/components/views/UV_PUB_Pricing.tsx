import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface TierPackage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface TierFeature {
  id: string;
  tier_id: string;
  group_name: string;
  feature_key: string;
  feature_label: string;
  feature_value: string | null;
  is_included: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface TierWithFeatures {
  tier: TierPackage;
  features: TierFeature[];
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchTiersAndFeatures = async (): Promise<TierWithFeatures[]> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const response = await axios.get(`${API_BASE_URL}/api/public/tiers`);
  return response.data;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_Pricing: React.FC = () => {
  const navigate = useNavigate();
  
  // Global state access - CRITICAL: Use individual selectors
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);

  // Local state
  const [comparison_modal_open, setComparisonModalOpen] = useState(false);
  const [active_tier_index, setActiveTierIndex] = useState<number | null>(null);

  // Business constants (would come from settings in production)
  const current_tax_rate = 23; // 23% VAT
  const current_deposit_pct = 50; // 50% deposit
  const current_urgent_fee_pct = 20; // 20% emergency fee

  // Fetch tiers and features using React Query
  const { 
    data: tiers_response, 
    isLoading, 
    error 
  } = useQuery<TierWithFeatures[]>({
    queryKey: ['public-tiers'],
    queryFn: fetchTiersAndFeatures,
    staleTime: 300000, // 5 minutes
    retry: 2
  });

  // Transform data for easier rendering
  const available_tiers = tiers_response?.map(item => item.tier).sort((a, b) => a.sort_order - b.sort_order) || [];
  
  const tier_features: Record<string, TierFeature[]> = {};
  tiers_response?.forEach(item => {
    tier_features[item.tier.id] = item.features.sort((a, b) => {
      if (a.group_name !== b.group_name) return a.group_name.localeCompare(b.group_name);
      return a.sort_order - b.sort_order;
    });
  });

  // Get unique feature groups for table rows
  const feature_groups: string[] = [];
  Object.values(tier_features).forEach(features => {
    features.forEach(feature => {
      if (!feature_groups.includes(feature.group_name)) {
        feature_groups.push(feature.group_name);
      }
    });
  });

  // Handle navigation to quote wizard
  const handleGetQuoteClick = () => {
    if (isAuthenticated) {
      navigate('/app/quotes/new');
    } else {
      navigate('/login?returnTo=/app/quotes/new');
    }
  };

  // Handle modal controls
  const openComparisonModal = () => setComparisonModalOpen(true);
  const closeComparisonModal = () => {
    setComparisonModalOpen(false);
    setActiveTierIndex(null);
  };

  // Toggle tier accordion on mobile
  const toggleTierAccordion = (index: number) => {
    setActiveTierIndex(active_tier_index === index ? null : index);
  };

  // Keyboard event listener for modal close
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && comparison_modal_open) {
        closeComparisonModal();
      }
    };

    if (comparison_modal_open) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
    };
  }, [comparison_modal_open]);

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b-2 border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Transparent, Project-Based Pricing
              </h1>
              <p className="text-xl text-gray-700 leading-relaxed mb-8">
                All pricing is calculated per project based on quantity, complexity, materials, and timeline. 
                Contact us for a custom quote tailored to your specific requirements.
              </p>
              <button
                onClick={handleGetQuoteClick}
                className="inline-block bg-yellow-400 text-black font-semibold px-8 py-4 rounded-lg hover:bg-yellow-500 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Get a Custom Quote
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="animate-pulse space-y-8">
              <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
              <div className="bg-gray-100 rounded-xl p-8 space-y-4">
                {[...Array(5)].map((_, idx) => (
                  <div key={idx} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
              <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-red-900 mb-2">Failed to Load Pricing</h3>
              <p className="text-red-700 mb-4">We couldn't load the pricing information. Please try again.</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        {!isLoading && !error && available_tiers.length > 0 && (
          <>
            {/* Tier Comparison Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                  Service Tier Comparison
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  Choose the service level that matches your timeline and quality requirements
                </p>
              </div>

              {/* Desktop/Tablet Table View - Hidden on Mobile */}
              <div className="hidden md:block overflow-x-auto bg-white rounded-xl shadow-lg border border-gray-200">
                <table className="w-full table-fixed">
                  <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 z-10">
                    <tr>
                      <th className="w-1/5 px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Feature
                      </th>
                      {available_tiers.map(tier => (
                        <th 
                          key={tier.id}
                          className="w-1/5 px-6 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wider"
                        >
                          <div className="mb-2">{tier.name}</div>
                          {tier.description && (
                            <div className="text-xs font-normal text-gray-600 normal-case">
                              {tier.description}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {feature_groups.map((group_name, groupIdx) => {
                      // Get all features for this group across all tiers
                      const group_features_map: Record<string, Record<string, TierFeature>> = {};
                      
                      available_tiers.forEach(tier => {
                        const tier_feature_list = tier_features[tier.id] || [];
                        tier_feature_list
                          .filter(f => f.group_name === group_name)
                          .forEach(feature => {
                            if (!group_features_map[feature.feature_label]) {
                              group_features_map[feature.feature_label] = {};
                            }
                            group_features_map[feature.feature_label][tier.id] = feature;
                          });
                      });

                      const feature_rows = Object.entries(group_features_map);

                      return (
                        <React.Fragment key={group_name}>
                          {/* Group Header Row */}
                          <tr className="bg-gray-100">
                            <td 
                              colSpan={available_tiers.length + 1}
                              className="px-6 py-3 text-left text-sm font-bold text-gray-900 uppercase tracking-wide"
                            >
                              {group_name}
                            </td>
                          </tr>
                          
                          {/* Feature Rows */}
                          {feature_rows.map(([feature_label, tier_features_obj], featureIdx) => (
                            <tr 
                              key={`${group_name}-${feature_label}`}
                              className={featureIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                            >
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                {feature_label}
                              </td>
                              {available_tiers.map(tier => {
                                const feature = tier_features_obj[tier.id];
                                
                                if (!feature) {
                                  return (
                                    <td key={tier.id} className="px-6 py-4 text-center">
                                      <span className="text-gray-400">—</span>
                                    </td>
                                  );
                                }

                                return (
                                  <td key={tier.id} className="px-6 py-4 text-center">
                                    {feature.is_included ? (
                                      feature.feature_value ? (
                                        <span className="text-sm text-gray-900 font-medium">
                                          {feature.feature_value}
                                        </span>
                                      ) : (
                                        <svg className="w-6 h-6 text-green-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )
                                    ) : (
                                      <svg className="w-6 h-6 text-red-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Accordion View - Visible Only on Mobile */}
              <div className="md:hidden space-y-4">
                {available_tiers.map((tier, index) => {
                  const tier_feature_list = tier_features[tier.id] || [];
                  const is_active = active_tier_index === index;

                  return (
                    <div 
                      key={tier.id}
                      className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden"
                    >
                      {/* Tier Header - Clickable */}
                      <button
                        onClick={() => toggleTierAccordion(index)}
                        className="w-full px-6 py-5 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="text-left">
                          <h3 className="text-xl font-bold text-gray-900">{tier.name}</h3>
                          {tier.description && (
                            <p className="text-sm text-gray-600 mt-1">{tier.description}</p>
                          )}
                        </div>
                        <svg 
                          className={`w-6 h-6 text-gray-600 transition-transform duration-200 ${is_active ? 'rotate-180' : ''}`}
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Tier Features - Collapsible */}
                      {is_active && (
                        <div className="px-6 py-4 space-y-6 bg-white">
                          {feature_groups.map(group_name => {
                            const group_feature_list = tier_feature_list.filter(f => f.group_name === group_name);
                            
                            if (group_feature_list.length === 0) return null;

                            return (
                              <div key={group_name}>
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 border-b border-gray-200 pb-2">
                                  {group_name}
                                </h4>
                                <ul className="space-y-2">
                                  {group_feature_list.map(feature => (
                                    <li key={feature.id} className="flex items-start">
                                      {feature.is_included ? (
                                        <>
                                          <svg className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                          <div>
                                            <span className="text-sm font-medium text-gray-900">{feature.feature_label}</span>
                                            {feature.feature_value && (
                                              <span className="text-sm text-gray-600"> - {feature.feature_value}</span>
                                            )}
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <svg className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                          <span className="text-sm text-gray-500">{feature.feature_label}</span>
                                        </>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mobile: View Full Comparison Link */}
              <div className="md:hidden mt-6 text-center">
                <button
                  onClick={openComparisonModal}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm underline"
                >
                  Compare All Features Side-by-Side
                </button>
              </div>
            </div>

            {/* Disclaimer Section */}
            <div className="bg-gray-50 border-t-2 border-gray-200 border-b-2">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                  Important Pricing Information
                </h3>
                
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Emergency Booking Fee */}
                  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                    <div className="flex items-start">
                      <svg className="w-6 h-6 text-yellow-400 mr-3 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-2">Emergency Booking Fee</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          Emergency bookings on fully booked dates incur an additional <strong className="text-yellow-600">+{current_urgent_fee_pct}%</strong> urgent fee.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Deposit Requirement */}
                  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                    <div className="flex items-start">
                      <svg className="w-6 h-6 text-blue-600 mr-3 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-2">Deposit Requirement</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          A <strong className="text-blue-600">{current_deposit_pct}% deposit</strong> is required upfront to confirm your order. Balance due before delivery.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tax Information */}
                  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                    <div className="flex items-start">
                      <svg className="w-6 h-6 text-green-600 mr-3 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-2">Tax Applied</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          All prices exclude <strong className="text-green-600">{current_tax_rate}% VAT</strong>, which will be added to your final invoice.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <svg className="w-6 h-6 text-blue-600 mr-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-900 leading-relaxed">
                      <p className="font-semibold mb-2">Custom Pricing Policy</p>
                      <p>
                        Each project is quoted individually based on your specific requirements. 
                        Final pricing is determined after we review your project details, required materials, 
                        timeline, and selected service tier. You'll receive a detailed quote within 24 hours 
                        of submission with no obligation to proceed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-t-2 border-gray-200">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Ready to Get Started?
                </h3>
                <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">
                  Let's bring your vision to life. Get a custom quote tailored to your project requirements.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={handleGetQuoteClick}
                    className="bg-yellow-400 text-black font-semibold px-8 py-4 rounded-lg hover:bg-yellow-500 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    Get a Custom Quote
                  </button>
                  <Link
                    to="/contact"
                    className="bg-white text-gray-900 font-semibold px-8 py-4 rounded-lg border-2 border-black hover:bg-gray-900 hover:text-white transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Contact Us
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Mobile Comparison Modal */}
        {comparison_modal_open && (
          <div 
            className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60"
            onClick={closeComparisonModal}
          >
            <div className="min-h-screen px-4 py-8">
              <div 
                className="bg-white rounded-xl shadow-2xl max-w-4xl mx-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="sticky top-0 bg-white border-b-2 border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
                  <h3 className="text-xl font-bold text-gray-900">Tier Comparison</h3>
                  <button
                    onClick={closeComparisonModal}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="Close comparison"
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Content - Scrollable */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-6">
                    {available_tiers.map((tier) => {
                      const tier_feature_list = tier_features[tier.id] || [];

                      return (
                        <div key={tier.id} className="border-2 border-gray-200 rounded-lg p-4">
                          <h4 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                            {tier.name}
                          </h4>
                          
                          <div className="space-y-4">
                            {feature_groups.map(group_name => {
                              const group_feature_list = tier_feature_list.filter(f => f.group_name === group_name);
                              
                              if (group_feature_list.length === 0) return null;

                              return (
                                <div key={group_name}>
                                  <h5 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">
                                    {group_name}
                                  </h5>
                                  <ul className="space-y-2">
                                    {group_feature_list.map(feature => (
                                      <li key={feature.id} className="flex items-start text-sm">
                                        {feature.is_included ? (
                                          <>
                                            <svg className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className="text-gray-900">
                                              {feature.feature_label}
                                              {feature.feature_value && ` - ${feature.feature_value}`}
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            <svg className="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            <span className="text-gray-500">{feature.feature_label}</span>
                                          </>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-200 px-6 py-4 rounded-b-xl">
                  <button
                    onClick={closeComparisonModal}
                    className="w-full bg-gray-900 text-white font-semibold px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Close Comparison
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_PUB_Pricing;