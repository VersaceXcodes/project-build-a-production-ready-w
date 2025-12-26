import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface CaseStudyResponse {
  id: string;
  slug: string;
  title: string;
  service_id: string;
  tier_id: string;
  gallery_image_id: string;
  description: string | null;
  client_testimonial: string | null;
  additional_images: string | null; // JSON string
  is_published: boolean;
  created_at: string;
  updated_at: string;
  service_name: string; // Joined data
  tier_name: string; // Joined data
  image_url: string; // Joined data
}

interface CaseStudy {
  id: string;
  slug: string;
  title: string;
  service_id: string;
  tier_id: string;
  gallery_image_id: string;
  description: string | null;
  client_testimonial: string | null;
  additional_images: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface Service {
  id: string;
  name: string;
}

interface TierPackage {
  id: string;
  name: string;
}

interface GalleryImage {
  image_url: string;
}

interface AdditionalImage {
  url: string;
  caption?: string;
}

// ===========================
// API FUNCTIONS
// ===========================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const fetchCaseStudyDetail = async (case_study_slug: string): Promise<{
  case_study: CaseStudy;
  service: Service;
  tier: TierPackage;
  gallery_image: GalleryImage;
  additional_images: AdditionalImage[];
}> => {
  const response = await axios.get<CaseStudyResponse>(
    `${API_BASE_URL}/api/public/case-studies/${case_study_slug}`
  );

  const data = response.data;

  // Parse additional_images JSON string
  let additional_images: AdditionalImage[] = [];
  if (data.additional_images) {
    try {
      additional_images = JSON.parse(data.additional_images);
    } catch (e) {
      console.error('Failed to parse additional_images:', e);
    }
  }

  return {
    case_study: {
      id: data.id,
      slug: data.slug,
      title: data.title,
      service_id: data.service_id,
      tier_id: data.tier_id,
      gallery_image_id: data.gallery_image_id,
      description: data.description,
      client_testimonial: data.client_testimonial,
      additional_images: data.additional_images,
      is_published: data.is_published,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
    service: {
      id: data.service_id,
      name: data.service_name,
    },
    tier: {
      id: data.tier_id,
      name: data.tier_name,
    },
    gallery_image: {
      image_url: data.image_url,
    },
    additional_images,
  };
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_CaseStudy: React.FC = () => {
  const { case_study_slug } = useParams<{ case_study_slug: string }>();
  const navigate = useNavigate();

  // Global state access - CRITICAL: Individual selectors only
  const isAuthenticated = useAppStore(
    (state) => state.authentication_state.authentication_status.is_authenticated
  );

  // Fetch case study data
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['case_study', case_study_slug],
    queryFn: () => fetchCaseStudyDetail(case_study_slug || ''),
    enabled: !!case_study_slug,
    staleTime: 60000, // 1 minute
    retry: 1,
  });

  // ===========================
  // ACTIONS
  // ===========================

  const handleNavigateToSimilarQuote = () => {
    if (!data?.service) return;

    const quote_wizard_url = `/app/quotes/new?service=${data.service.id}`;

    if (isAuthenticated) {
      navigate(quote_wizard_url);
    } else {
      navigate(`/login?returnTo=${encodeURIComponent(quote_wizard_url)}`);
    }
  };

  // ===========================
  // LOADING STATE
  // ===========================

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-white">
          {/* Breadcrumb Skeleton */}
          <div className="bg-gray-50 border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Title Skeleton */}
            <div className="mb-6">
              <div className="h-10 bg-gray-200 rounded w-3/4 mb-4 animate-pulse"></div>
              <div className="flex space-x-2">
                <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
                <div className="h-6 bg-gray-200 rounded w-24 animate-pulse"></div>
              </div>
            </div>

            {/* Image Skeleton */}
            <div className="w-full aspect-[16/9] bg-gray-200 rounded-xl mb-8 animate-pulse"></div>

            {/* Content Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
                </div>
              </div>
              <div>
                <div className="h-48 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ===========================
  // ERROR STATE
  // ===========================

  if (error || !data) {
    return (
      <>
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Case Study Not Found
            </h2>
            <p className="text-gray-600 mb-6">
              The case study you're looking for doesn't exist or has been removed.
            </p>
            <Link
              to="/gallery"
              className="inline-flex items-center px-6 py-3 bg-yellow-400 text-black text-base font-semibold rounded-lg hover:bg-yellow-500 transition-colors duration-200"
            >
              Back to Gallery
            </Link>
          </div>
        </div>
      </>
    );
  }

  // ===========================
  // SUCCESS STATE - RENDER
  // ===========================

  const { case_study, service, tier, gallery_image, additional_images } = data;

  return (
    <>
      {/* Breadcrumb Navigation */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center space-x-2 text-sm">
            <Link
              to="/gallery"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Gallery
            </Link>
            <svg
              className="h-4 w-4 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-gray-900 font-medium">{case_study.title}</span>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 leading-tight">
              {case_study.title}
            </h1>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center px-4 py-1.5 bg-gray-100 text-gray-900 text-sm font-semibold rounded-full border border-gray-300">
                {service.name}
              </span>
              <span className="inline-flex items-center px-4 py-1.5 bg-yellow-400 text-black text-sm font-semibold rounded-full">
                {tier.name} Tier
              </span>
            </div>
          </div>

          {/* Main Image */}
          <div className="mb-8 lg:mb-12">
            <div className="w-full aspect-[16/9] rounded-xl overflow-hidden bg-gray-100 shadow-lg">
              <img
                src={gallery_image.image_url}
                alt={case_study.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* Main Content Column */}
            <div className="lg:col-span-2">
              {/* Client Testimonial */}
              {case_study.client_testimonial && (
                <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="flex items-start space-x-3">
                    <svg
                      className="h-8 w-8 text-blue-600 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                    </svg>
                    <div>
                      <blockquote className="text-lg text-gray-900 italic leading-relaxed">
                        "{case_study.client_testimonial}"
                      </blockquote>
                    </div>
                  </div>
                </div>
              )}

              {/* Project Description */}
              {case_study.description && (
                <div className="prose prose-lg max-w-none mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Project Overview
                  </h2>
                  <div
                    className="text-gray-700 leading-relaxed whitespace-pre-line"
                    dangerouslySetInnerHTML={{ __html: case_study.description }}
                  />
                </div>
              )}

              {/* Additional Images Gallery */}
              {additional_images.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    Project Gallery
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {additional_images.map((img, index) => (
                      <div
                        key={index}
                        className="aspect-square rounded-lg overflow-hidden bg-gray-100 shadow-md hover:shadow-xl transition-shadow duration-200"
                      >
                        <img
                          src={img.url}
                          alt={img.caption || `Project image ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        {img.caption && (
                          <p className="text-sm text-gray-600 mt-2 px-2">
                            {img.caption}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar - Project Details */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden sticky top-8">
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4">
                  <h3 className="text-lg font-bold text-white">
                    Project Details
                  </h3>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Service */}
                  <div>
                    <dt className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Service
                    </dt>
                    <dd className="text-base font-medium text-gray-900">
                      {service.name}
                    </dd>
                  </div>

                  {/* Tier */}
                  <div className="border-t border-gray-200 pt-6">
                    <dt className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Service Tier
                    </dt>
                    <dd className="text-base font-medium text-gray-900">
                      {tier.name}
                    </dd>
                  </div>

                  {/* Date */}
                  <div className="border-t border-gray-200 pt-6">
                    <dt className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Completed
                    </dt>
                    <dd className="text-base font-medium text-gray-900">
                      {new Date(case_study.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                      })}
                    </dd>
                  </div>

                  {/* CTA Section */}
                  <div className="border-t border-gray-200 pt-6">
                    <button
                      onClick={handleNavigateToSimilarQuote}
                      className="w-full bg-yellow-400 text-black px-6 py-3 rounded-lg font-semibold text-base hover:bg-yellow-500 transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-yellow-100"
                    >
                      Request a Similar Project
                    </button>
                    <p className="text-xs text-gray-500 text-center mt-3">
                      Get a custom quote for {service.name}
                    </p>
                  </div>

                  {/* Secondary Link */}
                  <div>
                    <Link
                      to="/gallery"
                      className="block text-center text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                    >
                      ← Back to Gallery
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom CTA for Mobile */}
          <div className="lg:hidden mt-12 border-t border-gray-200 pt-8">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
              <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                Ready to Start Your Project?
              </h3>
              <p className="text-gray-700 mb-6 text-center">
                Let's bring your vision to life with {service.name}
              </p>
              <button
                onClick={handleNavigateToSimilarQuote}
                className="w-full bg-yellow-400 text-black px-6 py-4 rounded-lg font-semibold text-lg hover:bg-yellow-500 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-yellow-100"
              >
                Request a Similar Project
              </button>
            </div>
          </div>

          {/* Related Links */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
              <Link
                to={`/services/${service.id}`}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Learn More About {service.name} →
              </Link>
              <Link
                to="/pricing"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                View Pricing & Tiers →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PUB_CaseStudy;