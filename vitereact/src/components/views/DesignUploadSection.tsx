import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { getMockupTemplatesForProduct, MockupTemplate } from '@/config/mockupTemplates';

// ===========================
// TYPE DEFINITIONS
// ===========================

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

interface UploadedFile {
  id: string;
  file: File | null;
  file_url: string;
  file_type: string;
  original_filename: string;
  num_pages: number;
  preview_images: string[];
  localPreview?: string; // For local preview before upload completes
}

interface PageMapping {
  [sideKey: string]: {
    fileId: string | null;
    pageIndex: number | null;
  };
}

interface UploadedDesign {
  id: string;
  file_url: string;
  file_type: string;
  original_filename: string;
  num_pages: number;
  preview_images: string[];
}

interface DesignUploadSectionProps {
  productId: string;
  productSlug?: string;
  printConfig: PrintConfig | null;
  selectedConfig?: Record<string, string>; // To detect double-sided option
  onDesignChange: (
    designs: { front: UploadedDesign | null; back: UploadedDesign | null },
    pageMapping: PageMapping
  ) => void;
  sessionId?: string;
}

// ===========================
// MOCKUP PREVIEW COMPONENT - ENHANCED
// ===========================

const MockupPreviewCarousel: React.FC<{
  frontDesign: UploadedFile | null;
  backDesign: UploadedFile | null;
  pageMapping: PageMapping;
  productSlug?: string;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
}> = ({ frontDesign, backDesign, pageMapping, productSlug, zoomLevel, onZoomChange }) => {
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [showFront, setShowFront] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Get mockup templates for this product
  const mockupTemplates = getMockupTemplatesForProduct(productSlug || 'business-cards');
  
  // Enhanced default templates with multiple realistic views
  const defaultTemplates: MockupTemplate[] = [
    {
      id: 'flat-single',
      label: 'Single Flat Card',
      imageUrl: '',
      designPlacement: { sideKey: 'front', x: 10, y: 10, width: 80, height: 80 },
      aspectRatio: '4/3',
    },
    {
      id: 'stacked-cards',
      label: 'Stacked Cards',
      imageUrl: '',
      designPlacement: { sideKey: 'front', x: 12, y: 12, width: 76, height: 76, rotationDeg: -3 },
      aspectRatio: '4/3',
    },
    {
      id: 'perspective-view',
      label: 'Perspective View',
      imageUrl: '',
      designPlacement: { sideKey: 'front', x: 15, y: 18, width: 70, height: 65, skewX: -8, skewY: 4 },
      aspectRatio: '4/3',
    },
    {
      id: 'floating-shadow',
      label: 'Floating',
      imageUrl: '',
      designPlacement: { sideKey: 'front', x: 18, y: 15, width: 64, height: 70, rotationDeg: 5 },
      aspectRatio: '4/3',
    },
    {
      id: 'back-view',
      label: 'Back Side',
      imageUrl: '',
      designPlacement: { sideKey: 'back', x: 10, y: 10, width: 80, height: 80 },
      aspectRatio: '4/3',
    },
  ];

  const templates = mockupTemplates.length > 0 ? mockupTemplates : defaultTemplates;

  // Get preview image for a specific side
  const getPreviewForSide = (sideKey: string): string | null => {
    const mapping = pageMapping[sideKey];
    if (!mapping || mapping.fileId === null || mapping.pageIndex === null) return null;

    // Determine which file to use based on mapping
    let file: UploadedFile | null = null;
    if (frontDesign && mapping.fileId === frontDesign.id) {
      file = frontDesign;
    } else if (backDesign && mapping.fileId === backDesign.id) {
      file = backDesign;
    }

    if (!file) {
      // Fallback: check if front or back design matches
      file = sideKey === 'front' ? frontDesign : backDesign;
      if (!file) {
        // Try the other file if using same file for both sides
        file = sideKey === 'front' ? backDesign : frontDesign;
      }
    }

    if (!file) return null;

    if (file.localPreview) return file.localPreview;
    if (file.preview_images && file.preview_images[mapping.pageIndex]) {
      return `${API_BASE_URL}${file.preview_images[mapping.pageIndex]}`;
    }
    if (file.preview_images && file.preview_images[0]) {
      return `${API_BASE_URL}${file.preview_images[0]}`;
    }
    return null;
  };

  const activeTemplate = templates[activeTemplateIndex];
  const previewImage = getPreviewForSide(activeTemplate?.designPlacement?.sideKey || 'front');
  const hasFrontPreview = getPreviewForSide('front') !== null;
  const hasBackPreview = getPreviewForSide('back') !== null;

  // Swipe handling for mobile
  const touchStartX = useRef<number>(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEnd;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && activeTemplateIndex < templates.length - 1) {
        setActiveTemplateIndex(activeTemplateIndex + 1);
      } else if (diff < 0 && activeTemplateIndex > 0) {
        setActiveTemplateIndex(activeTemplateIndex - 1);
      }
    }
  };

  // Scroll carousel to show active item
  useEffect(() => {
    if (carouselRef.current) {
      const activeThumb = carouselRef.current.children[activeTemplateIndex] as HTMLElement;
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTemplateIndex]);

  // Get mockup-specific styling
  const getMockupStyles = () => {
    const template = activeTemplate;
    if (!template) return {};

    switch (template.id) {
      case 'stacked-cards':
        return { transform: 'rotate(-3deg)', boxShadow: '20px 20px 60px rgba(0,0,0,0.15), -5px -5px 20px rgba(255,255,255,0.8)' };
      case 'perspective-view':
        return { transform: 'perspective(1000px) rotateY(-15deg) rotateX(5deg)', boxShadow: '25px 25px 50px rgba(0,0,0,0.2)' };
      case 'floating-shadow':
        return { transform: 'rotate(5deg) translateY(-10px)', boxShadow: '0 30px 60px rgba(0,0,0,0.25)' };
      default:
        return { boxShadow: '0 10px 40px rgba(0,0,0,0.12)' };
    }
  };

  return (
    <div className="w-full">
      {/* Main Preview Area */}
      <div
        className="relative bg-gradient-to-br from-slate-100 via-gray-50 to-stone-100 rounded-2xl overflow-hidden"
        style={{ minHeight: '360px' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Premium background pattern */}
        <div className="absolute inset-0">
          <div 
            className="w-full h-full"
            style={{
              backgroundImage: `
                radial-gradient(circle at 20% 80%, rgba(253, 224, 71, 0.08) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(251, 191, 36, 0.08) 0%, transparent 50%),
                linear-gradient(135deg, #fafafa 0%, #f5f5f4 50%, #fafaf9 100%)
              `,
            }}
          />
          {/* Subtle grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
        </div>

        {/* Mockup Frame */}
        <div 
          className="relative flex items-center justify-center p-6 sm:p-10 min-h-[360px]"
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'center center',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {previewImage ? (
            <div className="relative">
              {/* Stacked cards effect for stacked template */}
              {activeTemplate?.id === 'stacked-cards' && (
                <>
                  <div 
                    className="absolute w-full h-full bg-white rounded-lg"
                    style={{
                      transform: 'rotate(8deg) translateX(8px) translateY(8px)',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                      zIndex: 1,
                    }}
                  />
                  <div 
                    className="absolute w-full h-full bg-white rounded-lg"
                    style={{
                      transform: 'rotate(4deg) translateX(4px) translateY(4px)',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
                      zIndex: 2,
                    }}
                  />
                </>
              )}

              {/* Main card */}
              <div 
                className="relative bg-white rounded-xl overflow-hidden transition-all duration-500"
                style={{
                  ...getMockupStyles(),
                  maxWidth: '320px',
                  maxHeight: '220px',
                  zIndex: 10,
                }}
              >
                {/* Safe area / bleed indicator */}
                <div className="absolute inset-2 border border-dashed border-gray-200 rounded-lg pointer-events-none opacity-40 z-20" />
                
                <img
                  src={previewImage}
                  alt={`${activeTemplate?.label || 'Preview'}`}
                  className="w-full h-full object-contain"
                  style={{
                    borderRadius: activeTemplate?.designPlacement?.borderRadius 
                      ? `${activeTemplate.designPlacement.borderRadius}px` 
                      : '4px',
                  }}
                  loading="eager"
                />
              </div>

              {/* Floating shadow for floating template */}
              {activeTemplate?.id === 'floating-shadow' && (
                <div 
                  className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-3/4 h-8 bg-black/10 rounded-full blur-xl"
                />
              )}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-40 h-28 mx-auto mb-6 bg-white rounded-xl shadow-xl border-2 border-dashed border-gray-200 flex items-center justify-center transform hover:scale-105 transition-transform">
                <svg className="w-14 h-14 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium mb-1">Upload your design to preview</p>
              <p className="text-gray-400 text-sm">See how your artwork will look on the final product</p>
            </div>
          )}
        </div>

        {/* View label badge */}
        <div className="absolute top-4 left-4">
          <span className="inline-flex items-center px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-full text-xs font-semibold text-gray-700 shadow-sm border border-gray-100">
            <svg className="w-3.5 h-3.5 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {activeTemplate?.label || 'Preview'}
          </span>
        </div>

        {/* Side indicator - only show if we have a preview */}
        {previewImage && (
          <div className="absolute top-4 right-4">
            <span className={`inline-flex items-center px-3 py-1.5 backdrop-blur-md rounded-full text-xs font-bold shadow-sm uppercase tracking-wide ${
              activeTemplate?.designPlacement?.sideKey === 'back'
                ? 'bg-purple-500/90 text-white'
                : 'bg-yellow-400/90 text-black'
            }`}>
              {activeTemplate?.designPlacement?.sideKey === 'back' ? (
                <>
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Back
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Front
                </>
              )}
            </span>
          </div>
        )}

        {/* Front/Back Toggle - show when both sides have designs */}
        {hasFrontPreview && hasBackPreview && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
            <div className="inline-flex bg-white/95 backdrop-blur-md rounded-full p-1 shadow-lg border border-gray-100">
              <button
                onClick={() => {
                  const frontTemplateIdx = templates.findIndex(t => t.designPlacement.sideKey === 'front');
                  if (frontTemplateIdx >= 0) setActiveTemplateIndex(frontTemplateIdx);
                }}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  activeTemplate?.designPlacement?.sideKey === 'front'
                    ? 'bg-yellow-400 text-black shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Front
              </button>
              <button
                onClick={() => {
                  const backTemplateIdx = templates.findIndex(t => t.designPlacement.sideKey === 'back');
                  if (backTemplateIdx >= 0) setActiveTemplateIndex(backTemplateIdx);
                }}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  activeTemplate?.designPlacement?.sideKey === 'back'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Modernized Zoom Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md rounded-full px-3 py-2 shadow-lg border border-gray-100">
            <button
              onClick={() => onZoomChange(Math.max(50, zoomLevel - 25))}
              disabled={zoomLevel <= 50}
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            
            <div className="relative w-20 px-1">
              <input
                type="range"
                min="50"
                max="200"
                value={zoomLevel}
                onChange={(e) => onZoomChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${(zoomLevel - 50) / 1.5}%, #e5e7eb ${(zoomLevel - 50) / 1.5}%, #e5e7eb 100%)`,
                }}
              />
            </div>
            
            <button
              onClick={() => onZoomChange(Math.min(200, zoomLevel + 25))}
              disabled={zoomLevel >= 200}
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>
            
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            
            <button
              onClick={() => onZoomChange(100)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                zoomLevel === 100 
                  ? 'bg-yellow-400 text-black' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Reset to 100%"
            >
              {zoomLevel}%
            </button>
          </div>
        </div>
      </div>

      {/* Mockup Carousel Thumbnails - Swipe-scroll on mobile */}
      <div className="mt-4">
        <div 
          ref={carouselRef}
          className="flex gap-3 overflow-x-auto pb-2 px-1 snap-x snap-mandatory touch-pan-x"
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {templates.map((template, idx) => {
            const thumbPreview = getPreviewForSide(template.designPlacement.sideKey);
            const isActive = idx === activeTemplateIndex;
            
            return (
              <button
                key={template.id}
                onClick={() => setActiveTemplateIndex(idx)}
                className={`
                  flex-shrink-0 snap-center rounded-xl overflow-hidden border-2 transition-all duration-300
                  ${isActive
                    ? 'border-yellow-400 shadow-lg shadow-yellow-200/50 scale-105 ring-2 ring-yellow-200'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }
                `}
                style={{ width: '72px', height: '54px' }}
              >
                <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-1.5 relative">
                  {thumbPreview ? (
                    <img
                      src={thumbPreview}
                      alt={template.label}
                      className="w-full h-full object-contain rounded"
                      style={{
                        transform: template.id === 'stacked-cards' ? 'rotate(-2deg)' :
                                   template.id === 'perspective-view' ? 'perspective(100px) rotateY(-5deg)' :
                                   template.id === 'floating-shadow' ? 'rotate(3deg)' : 'none',
                      }}
                    />
                  ) : (
                    <div className={`w-8 h-6 rounded shadow-sm border ${
                      template.designPlacement.sideKey === 'back' 
                        ? 'bg-purple-100 border-purple-200' 
                        : 'bg-white border-gray-200'
                    }`} />
                  )}
                  {/* Side indicator dot */}
                  <div className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${
                    template.designPlacement.sideKey === 'back' 
                      ? 'bg-purple-400' 
                      : 'bg-yellow-400'
                  }`} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Template Labels */}
        <div className="flex gap-3 mt-2 overflow-x-auto pb-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {templates.map((template, idx) => (
            <button
              key={template.id}
              onClick={() => setActiveTemplateIndex(idx)}
              className={`flex-shrink-0 text-[11px] font-medium transition-colors whitespace-nowrap ${
                idx === activeTemplateIndex ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
              style={{ width: '72px', textAlign: 'center' }}
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ===========================
// ENHANCED FILE UPLOAD SLOT COMPONENT
// ===========================

const FileUploadSlot: React.FC<{
  side: 'front' | 'back';
  label: string;
  required: boolean;
  file: UploadedFile | null;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  acceptedTypes: string;
  showUseSameOption?: boolean;
  onUseSameFile?: () => void;
  otherSideFile?: UploadedFile | null;
}> = ({ 
  side, 
  label, 
  required, 
  file, 
  isUploading, 
  uploadProgress, 
  error, 
  onFileSelect, 
  onRemove, 
  acceptedTypes,
  showUseSameOption,
  onUseSameFile,
  otherSideFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      onFileSelect(droppedFile);
    }
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
    // Reset input value to allow re-selecting same file
    e.target.value = '';
  };

  const sideColor = side === 'front' ? 'yellow' : 'purple';
  const sideIcon = side === 'front' ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );

  return (
    <div className="flex-1 min-w-0">
      {/* Header with label and actions */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            side === 'front' 
              ? 'bg-yellow-100 text-yellow-600' 
              : 'bg-purple-100 text-purple-600'
          }`}>
            {sideIcon}
          </div>
          <div>
            <label className="text-sm font-bold text-gray-900">
              {label}
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">
              {side === 'front' ? 'Primary design' : 'Secondary design'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Use same file option */}
          {showUseSameOption && otherSideFile && !file && (
            <button
              onClick={onUseSameFile}
              className="text-xs text-yellow-600 hover:text-yellow-700 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-yellow-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Use front file
            </button>
          )}
          
          {file && (
            <button
              onClick={onRemove}
              className="text-xs text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Upload Area */}
      {!file && !isUploading && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200
            ${isDragging
              ? side === 'front' 
                ? 'border-yellow-400 bg-yellow-50 scale-[1.02]'
                : 'border-purple-400 bg-purple-50 scale-[1.02]'
              : error
                ? 'border-red-300 bg-red-50'
                : 'border-gray-200 hover:border-gray-300 bg-gray-50/50 hover:bg-gray-50'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes}
            onChange={handleFileChange}
            className="hidden"
          />
          
          <div className="flex flex-col items-center">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
              isDragging 
                ? side === 'front' ? 'bg-yellow-100' : 'bg-purple-100'
                : 'bg-gray-100'
            }`}>
              <svg
                className={`w-6 h-6 transition-colors ${
                  isDragging 
                    ? side === 'front' ? 'text-yellow-500' : 'text-purple-500'
                    : 'text-gray-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-700 font-medium">
              Drag & drop or{' '}
              <span className={side === 'front' ? 'text-yellow-600' : 'text-purple-600'}>
                browse
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-1.5">PDF, PNG, JPG up to 50MB</p>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className={`border-2 rounded-xl p-4 ${
          side === 'front' ? 'border-yellow-200 bg-yellow-50/50' : 'border-purple-200 bg-purple-50/50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              side === 'front' ? 'bg-yellow-100' : 'bg-purple-100'
            }`}>
              <svg className={`animate-spin w-5 h-5 ${
                side === 'front' ? 'text-yellow-500' : 'text-purple-500'
              }`} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-700">Uploading...</span>
                <span className={`text-xs font-semibold ${
                  side === 'front' ? 'text-yellow-600' : 'text-purple-600'
                }`}>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    side === 'front' ? 'bg-yellow-400' : 'bg-purple-400'
                  }`}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded File Info */}
      {file && !isUploading && (
        <div className={`border-2 rounded-xl p-3 transition-all ${
          side === 'front' 
            ? 'border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50' 
            : 'border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50'
        }`}>
          <div className="flex items-center gap-3">
            {/* File preview thumbnail */}
            <div className="w-14 h-14 rounded-lg bg-white shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100">
              {file.localPreview || (file.preview_images && file.preview_images[0]) ? (
                <img
                  src={file.localPreview || `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}${file.preview_images[0]}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : file.file_type === 'pdf' ? (
                <svg className="w-7 h-7 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-3 9.5c0 .28-.22.5-.5.5H8v2h1.5c.28 0 .5.22.5.5s-.22.5-.5.5H7.5c-.28 0-.5-.22-.5-.5v-4c0-.28.22-.5.5-.5H9.5c.28 0 .5.22.5.5s-.22.5-.5.5H8v1h1.5c.28 0 .5.22.5.5zm4 2c0 .83-.67 1.5-1.5 1.5H11.5c-.28 0-.5-.22-.5-.5v-4c0-.28.22-.5.5-.5H13.5c.83 0 1.5.67 1.5 1.5v2zm3-2.5c.28 0 .5.22.5.5s-.22.5-.5.5H16v1h1c.28 0 .5.22.5.5s-.22.5-.5.5h-1v1.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-4c0-.28.22-.5.5-.5H17zm-5 .5v2c0 .28.22.5.5.5s.5-.22.5-.5v-2c0-.28-.22-.5-.5-.5s-.5.22-.5.5z"/>
                </svg>
              ) : (
                <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            
            {/* File details */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {file.original_filename}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  file.file_type === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {file.file_type.toUpperCase()}
                </span>
                {file.num_pages > 1 && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {file.num_pages} pages
                  </span>
                )}
                <span className={`flex items-center gap-0.5 text-xs font-medium ${
                  side === 'front' ? 'text-yellow-600' : 'text-purple-600'
                }`}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Uploaded
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-2.5 flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-medium">{error}</span>
        </div>
      )}
    </div>
  );
};

// ===========================
// ENHANCED PAGE ASSIGNMENT COMPONENT
// ===========================

const PageAssignmentPanel: React.FC<{
  sides: PrintSide[];
  frontFile: UploadedFile | null;
  backFile: UploadedFile | null;
  pageMapping: PageMapping;
  onMappingChange: (mapping: PageMapping) => void;
  useSameFile: boolean;
  onUseSameFileChange: (value: boolean) => void;
  isDoubleSided: boolean;
}> = ({ sides, frontFile, backFile, pageMapping, onMappingChange, useSameFile, onUseSameFileChange, isDoubleSided }) => {
  
  const handleAssignment = (sideKey: string, fileId: string | null, pageIndex: number | null) => {
    onMappingChange({
      ...pageMapping,
      [sideKey]: { fileId, pageIndex },
    });
  };

  // Get available files for selection
  const getAvailableFiles = () => {
    const files: { id: string; label: string; file: UploadedFile }[] = [];
    if (frontFile) {
      files.push({ id: frontFile.id, label: 'Front Upload', file: frontFile });
    }
    if (backFile && !useSameFile && backFile.id !== frontFile?.id) {
      files.push({ id: backFile.id, label: 'Back Upload', file: backFile });
    }
    return files;
  };

  const availableFiles = getAvailableFiles();
  const hasAnyFile = frontFile || backFile;
  const multiPageFile = frontFile?.num_pages && frontFile.num_pages > 1 ? frontFile : 
                        (backFile?.num_pages && backFile.num_pages > 1 ? backFile : null);

  if (!hasAnyFile) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 mt-5 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">Assign Pages to Print Sides</h4>
            <p className="text-[10px] text-gray-500">Select which page appears on each side</p>
          </div>
        </div>
        
        {/* Use same file toggle - only show when front file exists and double-sided */}
        {frontFile && isDoubleSided && (
          <label className="flex items-center gap-2 cursor-pointer group">
            <span className="relative">
              <input
                type="checkbox"
                checked={useSameFile}
                onChange={(e) => onUseSameFileChange(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-5 rounded-full transition-colors ${
                useSameFile ? 'bg-yellow-400' : 'bg-gray-200 group-hover:bg-gray-300'
              }`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                  useSameFile ? 'translate-x-5' : ''
                }`} />
              </div>
            </span>
            <span className="text-xs text-gray-600 font-medium">Same file for both</span>
          </label>
        )}
      </div>

      <div className="space-y-3">
        {sides.map((side) => {
          const currentMapping = pageMapping[side.key] || { fileId: null, pageIndex: null };
          const selectedFile = availableFiles.find(f => f.id === currentMapping.fileId)?.file;
          const numPages = selectedFile?.num_pages || (availableFiles.length === 1 ? availableFiles[0].file.num_pages : 1);
          
          // Skip back side if not double-sided
          if (side.key === 'back' && !isDoubleSided) {
            return null;
          }

          const isRequired = side.required || (side.key === 'back' && isDoubleSided);
          const hasError = isRequired && (currentMapping.fileId === null || currentMapping.pageIndex === null);
          const hasFile = availableFiles.length > 0;

          return (
            <div 
              key={side.key}
              className={`bg-white rounded-xl p-4 border-2 transition-all ${
                hasError ? 'border-red-200 shadow-red-100' : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Side indicator */}
                <div className="flex items-center gap-2 sm:min-w-[120px]">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    side.key === 'front' 
                      ? 'bg-gradient-to-br from-yellow-400 to-amber-400 text-white shadow-lg shadow-yellow-200' 
                      : 'bg-gradient-to-br from-purple-400 to-fuchsia-400 text-white shadow-lg shadow-purple-200'
                  }`}>
                    {side.key === 'front' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-gray-900 text-sm">
                      {side.label}
                    </span>
                    {isRequired && (
                      <span className="text-red-500 ml-0.5 text-xs">*</span>
                    )}
                    <p className="text-[10px] text-gray-400">
                      {side.key === 'front' ? 'Main print side' : 'Reverse side'}
                    </p>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="hidden sm:flex items-center text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>

                {/* Page assignment dropdowns */}
                <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {!hasFile ? (
                    <div className="flex-1 px-3 py-2.5 text-sm text-gray-400 bg-gray-50 rounded-lg border border-gray-200 text-center">
                      Upload a file first
                    </div>
                  ) : (
                    <>
                      {/* File selector (only if multiple files available) */}
                      {availableFiles.length > 1 && (
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1 block">
                            Source File
                          </label>
                          <select
                            value={currentMapping.fileId || ''}
                            onChange={(e) => {
                              const newFileId = e.target.value || null;
                              handleAssignment(side.key, newFileId, 0);
                            }}
                            className={`w-full px-3 py-2.5 text-sm border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 appearance-none bg-white cursor-pointer ${
                              hasError && !currentMapping.fileId 
                                ? 'border-red-300 focus:ring-red-400 bg-red-50' 
                                : 'border-gray-200 focus:ring-yellow-400 hover:border-gray-300'
                            }`}
                          >
                            <option value="">Select file...</option>
                            {availableFiles.map(f => (
                              <option key={f.id} value={f.id}>
                                {f.label} {f.file.num_pages > 1 ? `(${f.file.num_pages} pages)` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Page selector */}
                      {(availableFiles.length === 1 || currentMapping.fileId) && (
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1 block">
                            Assign to {side.label}
                          </label>
                          <select
                            value={currentMapping.pageIndex ?? ''}
                            onChange={(e) => {
                              const pageIdx = e.target.value === '' ? null : parseInt(e.target.value);
                              const fileId = currentMapping.fileId || (availableFiles.length === 1 ? availableFiles[0].id : null);
                              handleAssignment(side.key, fileId, pageIdx);
                            }}
                            className={`w-full px-3 py-2.5 text-sm border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 appearance-none bg-white cursor-pointer font-medium ${
                              hasError && currentMapping.pageIndex === null 
                                ? 'border-red-300 focus:ring-red-400 bg-red-50' 
                                : side.key === 'front'
                                  ? 'border-yellow-200 focus:ring-yellow-400 hover:border-yellow-300'
                                  : 'border-purple-200 focus:ring-purple-400 hover:border-purple-300'
                            }`}
                          >
                            <option value="">Select page...</option>
                            {Array.from({ 
                              length: numPages || 1 
                            }, (_, i) => (
                              <option key={i} value={i}>
                                Page {i + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Inline validation error */}
              {hasError && hasFile && (
                <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-medium">
                    Please select a page for the {side.label.toLowerCase()} side
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions for multi-page PDFs */}
      {multiPageFile && multiPageFile.num_pages >= 2 && isDoubleSided && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Detected {multiPageFile.num_pages} pages in your PDF
            </span>
            <button
              onClick={() => {
                onMappingChange({
                  front: { fileId: multiPageFile.id, pageIndex: 0 },
                  back: { fileId: multiPageFile.id, pageIndex: 1 },
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick assign: Page 1 & 2
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ===========================
// MAIN COMPONENT
// ===========================

const DesignUploadSection: React.FC<DesignUploadSectionProps> = ({
  productId,
  productSlug,
  printConfig,
  selectedConfig,
  onDesignChange,
  sessionId,
}) => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  // File state for front and back
  const [frontFile, setFrontFile] = useState<UploadedFile | null>(null);
  const [backFile, setBackFile] = useState<UploadedFile | null>(null);
  
  // Upload state
  const [frontUploading, setFrontUploading] = useState(false);
  const [backUploading, setBackUploading] = useState(false);
  const [frontProgress, setFrontProgress] = useState(0);
  const [backProgress, setBackProgress] = useState(0);
  const [frontError, setFrontError] = useState<string | null>(null);
  const [backError, setBackError] = useState<string | null>(null);
  
  // Page mapping state
  const [pageMapping, setPageMapping] = useState<PageMapping>({
    front: { fileId: null, pageIndex: null },
    back: { fileId: null, pageIndex: null },
  });
  
  // UI state
  const [useSameFile, setUseSameFile] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Determine if double-sided is selected
  const isDoubleSided = selectedConfig?.print_sides === 'double_sided' || 
                        selectedConfig?.print_sides === 'double-sided' ||
                        selectedConfig?.printSides === 'double_sided' ||
                        selectedConfig?.printSides === 'double-sided' ||
                        (printConfig?.sides?.some(s => s.key === 'back' && s.required) ?? false);

  const sides: PrintSide[] = printConfig?.sides || [
    { key: 'front', label: 'Front', required: true },
    { key: 'back', label: 'Back', required: isDoubleSided },
  ];

  // ===========================
  // FILE VALIDATION
  // ===========================

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return 'Invalid format. Please use PDF, PNG, or JPG files.';
    }
    
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return 'File too large. Maximum size is 50MB.';
    }
    
    return null;
  };

  // ===========================
  // FILE UPLOAD HANDLER
  // ===========================

  const uploadFile = async (
    file: File, 
    side: 'front' | 'back',
    setFile: React.Dispatch<React.SetStateAction<UploadedFile | null>>,
    setUploading: React.Dispatch<React.SetStateAction<boolean>>,
    setProgress: React.Dispatch<React.SetStateAction<number>>,
    setError: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Create local preview
    const localPreview = await createLocalPreview(file);
    
    // Set initial file state with local preview
    const tempId = `temp_${Date.now()}_${side}`;
    setFile({
      id: tempId,
      file,
      file_url: '',
      file_type: file.type.includes('pdf') ? 'pdf' : 'image',
      original_filename: file.name,
      num_pages: 1, // Will be updated after upload
      preview_images: [],
      localPreview,
    });

    setUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('product_id', productId);
    formData.append('side', side);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/design-uploads`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setProgress(progress);
            }
          },
        }
      );

      const uploadedFile: UploadedFile = {
        id: response.data.id || response.data.designUploadId,
        file: null,
        file_url: response.data.file_url,
        file_type: response.data.file_type,
        original_filename: response.data.original_filename || file.name,
        num_pages: response.data.num_pages || response.data.numPages || 1,
        preview_images: response.data.preview_images || response.data.previewImages || [],
        localPreview: localPreview,
      };

      setFile(uploadedFile);
      
      // Auto-assign page if this is the first upload
      const newMapping = { ...pageMapping };
      if (side === 'front' && !pageMapping.front?.fileId) {
        newMapping.front = { fileId: uploadedFile.id, pageIndex: 0 };
      }
      if (side === 'back' && !pageMapping.back?.fileId) {
        newMapping.back = { fileId: uploadedFile.id, pageIndex: 0 };
      }
      // If PDF with multiple pages and double-sided, auto-assign page 2 to back
      if (side === 'front' && uploadedFile.num_pages >= 2 && isDoubleSided && !pageMapping.back?.fileId) {
        newMapping.back = { fileId: uploadedFile.id, pageIndex: 1 };
      }
      setPageMapping(newMapping);

    } catch (err: any) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
      setFile(null);
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  // Create local preview for immediate display
  const createLocalPreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        // For PDFs, we can't easily create a preview without a library
        resolve('');
      }
    });
  };

  // ===========================
  // FILE REMOVAL HANDLER
  // ===========================

  const removeFile = async (side: 'front' | 'back') => {
    const file = side === 'front' ? frontFile : backFile;
    
    if (file && file.id && !file.id.startsWith('temp_')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/design-uploads/${file.id}`);
      } catch (err) {
        console.error('Failed to delete design:', err);
      }
    }

    if (side === 'front') {
      setFrontFile(null);
      setFrontError(null);
    } else {
      setBackFile(null);
      setBackError(null);
    }

    // Clear mapping for removed file
    const newMapping = { ...pageMapping };
    if (side === 'front') {
      newMapping.front = { fileId: null, pageIndex: null };
      // Also clear back if it was using front file
      if (pageMapping.back?.fileId === file?.id) {
        newMapping.back = { fileId: null, pageIndex: null };
      }
    } else {
      newMapping.back = { fileId: null, pageIndex: null };
    }
    setPageMapping(newMapping);
    
    // Reset useSameFile if removing front file
    if (side === 'front' && useSameFile) {
      setUseSameFile(false);
    }
  };

  // Handle "use same file for back" action
  const handleUseSameFileForBack = () => {
    if (frontFile) {
      setUseSameFile(true);
      setPageMapping(prev => ({
        ...prev,
        back: {
          fileId: frontFile.id,
          pageIndex: frontFile.num_pages >= 2 ? 1 : 0,
        },
      }));
    }
  };

  // ===========================
  // EFFECT: Notify parent of changes
  // ===========================

  useEffect(() => {
    const frontDesign = frontFile && !frontFile.id.startsWith('temp_') ? {
      id: frontFile.id,
      file_url: frontFile.file_url,
      file_type: frontFile.file_type,
      original_filename: frontFile.original_filename,
      num_pages: frontFile.num_pages,
      preview_images: frontFile.preview_images,
    } : null;

    const backDesign = backFile && !backFile.id.startsWith('temp_') ? {
      id: backFile.id,
      file_url: backFile.file_url,
      file_type: backFile.file_type,
      original_filename: backFile.original_filename,
      num_pages: backFile.num_pages,
      preview_images: backFile.preview_images,
    } : null;

    onDesignChange(
      { front: frontDesign, back: backDesign },
      pageMapping
    );
  }, [frontFile, backFile, pageMapping]);

  // ===========================
  // HANDLE SAME FILE FOR BOTH
  // ===========================

  useEffect(() => {
    if (useSameFile && frontFile) {
      // When using same file for both, update back mapping to use front file
      setPageMapping(prev => ({
        ...prev,
        back: {
          fileId: frontFile.id,
          pageIndex: frontFile.num_pages >= 2 ? 1 : 0,
        },
      }));
    }
  }, [useSameFile, frontFile]);

  // ===========================
  // RENDER
  // ===========================

  // Don't render if design upload is not required
  if (!printConfig?.requires_design_upload) {
    return null;
  }

  const showBackUpload = isDoubleSided && !useSameFile;

  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-300/40">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Upload Your Design</h3>
          <p className="text-sm text-gray-500">Upload print-ready files for your {productSlug?.replace(/-/g, ' ') || 'product'}</p>
        </div>
      </div>

      {/* Upload Slots - Stack vertically on mobile, horizontal on larger screens */}
      <div className={`flex flex-col gap-4 ${showBackUpload ? 'lg:flex-row' : ''}`}>
        {/* Front Upload */}
        <FileUploadSlot
          side="front"
          label="Front Design"
          required={true}
          file={frontFile}
          isUploading={frontUploading}
          uploadProgress={frontProgress}
          error={frontError}
          onFileSelect={(file) => uploadFile(file, 'front', setFrontFile, setFrontUploading, setFrontProgress, setFrontError)}
          onRemove={() => removeFile('front')}
          acceptedTypes=".pdf,.png,.jpg,.jpeg"
        />

        {/* Back Upload - Only show if double-sided and not using same file */}
        {showBackUpload && (
          <FileUploadSlot
            side="back"
            label="Back Design"
            required={isDoubleSided}
            file={backFile}
            isUploading={backUploading}
            uploadProgress={backProgress}
            error={backError}
            onFileSelect={(file) => uploadFile(file, 'back', setBackFile, setBackUploading, setBackProgress, setBackError)}
            onRemove={() => removeFile('back')}
            acceptedTypes=".pdf,.png,.jpg,.jpeg"
            showUseSameOption={frontFile !== null && !backFile}
            onUseSameFile={handleUseSameFileForBack}
            otherSideFile={frontFile}
          />
        )}
      </div>

      {/* Page Assignment Panel */}
      <PageAssignmentPanel
        sides={sides}
        frontFile={frontFile}
        backFile={useSameFile ? frontFile : backFile}
        pageMapping={pageMapping}
        onMappingChange={setPageMapping}
        useSameFile={useSameFile}
        onUseSameFileChange={setUseSameFile}
        isDoubleSided={isDoubleSided}
      />

      {/* Preview Carousel */}
      {(frontFile || backFile) && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-900">Preview Your Print</h4>
            <span className="text-xs text-gray-400">
              Swipe to see different views
            </span>
          </div>
          <MockupPreviewCarousel
            frontDesign={frontFile}
            backDesign={useSameFile ? frontFile : backFile}
            pageMapping={pageMapping}
            productSlug={productSlug}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
          />
        </div>
      )}

      {/* Validation Errors */}
      {isDoubleSided && !frontFile && (
        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-amber-800">Design Required</p>
              <p className="text-sm text-amber-700 mt-1">
                Please upload your design file{isDoubleSided ? 's' : ''} to continue with {isDoubleSided ? 'double-sided' : ''} printing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="mt-5 flex items-start gap-2.5 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="font-medium text-gray-600 mb-1">Upload Tips</p>
          <ul className="space-y-0.5 text-gray-500">
            <li>Use high-resolution images (300 DPI recommended)</li>
            <li>Include 3mm bleed for edge-to-edge printing</li>
            <li>Supported formats: PDF, PNG, JPG (max 50MB)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DesignUploadSection;
