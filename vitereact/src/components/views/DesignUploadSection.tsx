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
// MOCKUP PREVIEW COMPONENT
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
  const carouselRef = useRef<HTMLDivElement>(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Get mockup templates for this product
  const mockupTemplates = getMockupTemplatesForProduct(productSlug || 'business-cards');
  
  // Default templates if none configured
  const defaultTemplates: MockupTemplate[] = [
    {
      id: 'flat-front',
      label: 'Flat View',
      imageUrl: '',
      designPlacement: { sideKey: 'front', x: 10, y: 10, width: 80, height: 80 },
      aspectRatio: '4/3',
    },
    {
      id: 'stacked',
      label: 'Stacked',
      imageUrl: '',
      designPlacement: { sideKey: 'front', x: 15, y: 15, width: 70, height: 70, rotationDeg: -5 },
      aspectRatio: '4/3',
    },
    {
      id: 'perspective',
      label: 'Perspective',
      imageUrl: '',
      designPlacement: { sideKey: 'front', x: 20, y: 20, width: 60, height: 60, skewX: 5, skewY: -3 },
      aspectRatio: '4/3',
    },
  ];

  const templates = mockupTemplates.length > 0 ? mockupTemplates : defaultTemplates;

  // Get preview image for a specific side
  const getPreviewForSide = (sideKey: string): string | null => {
    const mapping = pageMapping[sideKey];
    if (!mapping || mapping.fileId === null || mapping.pageIndex === null) return null;

    const file = sideKey === 'front' ? frontDesign : backDesign;
    if (!file) {
      // Check if using "same file for both"
      const otherFile = sideKey === 'front' ? backDesign : frontDesign;
      if (otherFile && mapping.fileId === otherFile.id) {
        if (otherFile.localPreview) return otherFile.localPreview;
        if (otherFile.preview_images[mapping.pageIndex]) {
          return `${API_BASE_URL}${otherFile.preview_images[mapping.pageIndex]}`;
        }
      }
      return null;
    }

    if (file.localPreview) return file.localPreview;
    if (file.preview_images[mapping.pageIndex]) {
      return `${API_BASE_URL}${file.preview_images[mapping.pageIndex]}`;
    }
    return null;
  };

  const activeTemplate = templates[activeTemplateIndex];
  const previewImage = getPreviewForSide(activeTemplate?.designPlacement?.sideKey || 'front');

  // Swipe handling for mobile
  const handleTouchStart = useRef<number>(0);
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientX;
    const diff = handleTouchStart.current - touchEnd;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && activeTemplateIndex < templates.length - 1) {
        setActiveTemplateIndex(activeTemplateIndex + 1);
      } else if (diff < 0 && activeTemplateIndex > 0) {
        setActiveTemplateIndex(activeTemplateIndex - 1);
      }
    }
  };

  return (
    <div className="w-full">
      {/* Main Preview Area */}
      <div
        className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl overflow-hidden shadow-inner"
        style={{ minHeight: '320px' }}
        onTouchStart={(e) => { handleTouchStart.current = e.touches[0].clientX; }}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background scene - subtle pattern for premium feel */}
        <div className="absolute inset-0 opacity-30">
          <div 
            className="w-full h-full"
            style={{
              backgroundImage: 'radial-gradient(circle at 50% 50%, #f5f5f5 0%, #e8e8e8 100%)',
            }}
          />
        </div>

        {/* Mockup Frame */}
        <div 
          className="relative flex items-center justify-center p-8 min-h-[320px]"
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'center center',
            transition: 'transform 0.3s ease-out',
          }}
        >
          {previewImage ? (
            <div 
              className="relative bg-white rounded-lg shadow-2xl overflow-hidden"
              style={{
                transform: `rotate(${activeTemplate?.designPlacement?.rotationDeg || 0}deg) skewX(${activeTemplate?.designPlacement?.skewX || 0}deg) skewY(${activeTemplate?.designPlacement?.skewY || 0}deg)`,
                maxWidth: '85%',
                maxHeight: '280px',
              }}
            >
              {/* Print bleed indicator */}
              <div className="absolute inset-0 border-2 border-dashed border-gray-200 m-2 rounded pointer-events-none opacity-50" />
              
              <img
                src={previewImage}
                alt={`${activeTemplate?.label || 'Preview'}`}
                className="w-full h-full object-contain"
                style={{
                  borderRadius: `${activeTemplate?.designPlacement?.borderRadius || 0}px`,
                  opacity: activeTemplate?.designPlacement?.opacity || 1,
                }}
              />
              
              {/* Stacked effect for "Stacked" template */}
              {activeTemplate?.id?.includes('stack') && (
                <>
                  <div className="absolute -bottom-2 -left-2 w-full h-full bg-white rounded-lg shadow-lg -z-10 transform rotate-3" />
                  <div className="absolute -bottom-4 -left-4 w-full h-full bg-white rounded-lg shadow-md -z-20 transform rotate-6" />
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-32 h-24 mx-auto mb-4 bg-white rounded-lg shadow-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm font-medium">Upload your design to see preview</p>
              <p className="text-gray-400 text-xs mt-1">Your artwork will appear here</p>
            </div>
          )}
        </div>

        {/* View label badge */}
        <div className="absolute top-4 left-4">
          <span className="inline-flex items-center px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-gray-700 shadow-sm">
            {activeTemplate?.label || 'Preview'}
          </span>
        </div>

        {/* Side indicator */}
        {previewImage && (
          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center px-2.5 py-1 bg-yellow-400/90 backdrop-blur-sm rounded-full text-xs font-bold text-black shadow-sm uppercase">
              {activeTemplate?.designPlacement?.sideKey || 'Front'}
            </span>
          </div>
        )}

        {/* Zoom Controls - Modernized */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-gray-100">
            <button
              onClick={() => onZoomChange(Math.max(50, zoomLevel - 25))}
              disabled={zoomLevel <= 50}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            
            <div className="relative w-24">
              <input
                type="range"
                min="50"
                max="200"
                value={zoomLevel}
                onChange={(e) => onZoomChange(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
              <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600 bg-white px-1.5 py-0.5 rounded shadow-sm">
                {zoomLevel}%
              </span>
            </div>
            
            <button
              onClick={() => onZoomChange(Math.min(200, zoomLevel + 25))}
              disabled={zoomLevel >= 200}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            
            <div className="w-px h-5 bg-gray-200 mx-1" />
            
            <button
              onClick={() => onZoomChange(100)}
              className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title="Reset zoom"
            >
              Fit
            </button>
          </div>
        </div>
      </div>

      {/* Mockup Carousel Thumbnails */}
      <div 
        ref={carouselRef}
        className="mt-4 flex gap-3 overflow-x-auto pb-2 px-1 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {templates.map((template, idx) => {
          const thumbPreview = getPreviewForSide(template.designPlacement.sideKey);
          
          return (
            <button
              key={template.id}
              onClick={() => setActiveTemplateIndex(idx)}
              className={`
                flex-shrink-0 snap-center w-20 h-16 rounded-xl overflow-hidden border-2 transition-all duration-200
                ${idx === activeTemplateIndex
                  ? 'border-yellow-400 shadow-lg shadow-yellow-200/50 scale-105'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }
              `}
            >
              <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-1">
                {thumbPreview ? (
                  <img
                    src={thumbPreview}
                    alt={template.label}
                    className="w-full h-full object-contain rounded"
                    style={{
                      transform: `rotate(${(template.designPlacement.rotationDeg || 0) * 0.5}deg)`,
                    }}
                  />
                ) : (
                  <div className="w-8 h-6 bg-white rounded shadow-sm border border-gray-200" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Template Labels */}
      <div className="flex gap-3 mt-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {templates.map((template, idx) => (
          <span
            key={template.id}
            className={`flex-shrink-0 text-xs font-medium transition-colors ${
              idx === activeTemplateIndex ? 'text-gray-900' : 'text-gray-400'
            }`}
            style={{ width: '80px', textAlign: 'center' }}
          >
            {template.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ===========================
// FILE UPLOAD SLOT COMPONENT
// ===========================

const FileUploadSlot: React.FC<{
  label: string;
  required: boolean;
  file: UploadedFile | null;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  acceptedTypes: string;
}> = ({ label, required, file, isUploading, uploadProgress, error, onFileSelect, onRemove, acceptedTypes }) => {
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
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-gray-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {file && (
          <button
            onClick={onRemove}
            className="text-xs text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Remove
          </button>
        )}
      </div>

      {/* Upload Area */}
      {!file && !isUploading && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all
            ${isDragging
              ? 'border-yellow-400 bg-yellow-50'
              : error
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
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
          
          <div className="flex flex-col items-center py-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
              isDragging ? 'bg-yellow-100' : 'bg-gray-100'
            }`}>
              <svg
                className={`w-5 h-5 ${isDragging ? 'text-yellow-500' : 'text-gray-400'}`}
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
            <p className="text-sm text-gray-600 font-medium">
              Drop file or <span className="text-yellow-600">browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG (max 50MB)</p>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="border-2 border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <svg className="animate-spin w-6 h-6 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700">Uploading...</span>
                <span className="text-xs text-gray-500">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-yellow-400 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded File Info */}
      {file && !isUploading && (
        <div className="border-2 border-green-200 bg-green-50 rounded-xl p-3">
          <div className="flex items-center gap-3">
            {/* File icon or preview */}
            <div className="w-12 h-12 rounded-lg bg-white shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
              {file.localPreview || (file.preview_images && file.preview_images[0]) ? (
                <img
                  src={file.localPreview || `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}${file.preview_images[0]}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : file.file_type === 'pdf' ? (
                <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-3 9.5c0 .28-.22.5-.5.5H8v2h1.5c.28 0 .5.22.5.5s-.22.5-.5.5H7.5c-.28 0-.5-.22-.5-.5v-4c0-.28.22-.5.5-.5H9.5c.28 0 .5.22.5.5s-.22.5-.5.5H8v1h1.5c.28 0 .5.22.5.5zm4 2c0 .83-.67 1.5-1.5 1.5H11.5c-.28 0-.5-.22-.5-.5v-4c0-.28.22-.5.5-.5H13.5c.83 0 1.5.67 1.5 1.5v2zm3-2.5c.28 0 .5.22.5.5s-.22.5-.5.5H16v1h1c.28 0 .5.22.5.5s-.22.5-.5.5h-1v1.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-4c0-.28.22-.5.5-.5H17zm-5 .5v2c0 .28.22.5.5.5s.5-.22.5-.5v-2c0-.28-.22-.5-.5-.5s-.5.22-.5.5z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            
            {/* File details */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {file.original_filename}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500 uppercase">{file.file_type}</span>
                {file.num_pages > 1 && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-xs text-gray-500">{file.num_pages} pages</span>
                  </>
                )}
                <span className="text-gray-300">•</span>
                <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-2 flex items-center gap-2 text-red-600">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-xs">{error}</span>
        </div>
      )}
    </div>
  );
};

// ===========================
// PAGE ASSIGNMENT COMPONENT
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
      files.push({ id: frontFile.id, label: 'Front Design', file: frontFile });
    }
    if (backFile && !useSameFile) {
      files.push({ id: backFile.id, label: 'Back Design', file: backFile });
    }
    return files;
  };

  const availableFiles = getAvailableFiles();
  const hasAnyFile = frontFile || backFile;

  if (!hasAnyFile) {
    return null;
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900">Assign Pages to Print Sides</h4>
        {frontFile && isDoubleSided && !backFile && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useSameFile}
              onChange={(e) => onUseSameFileChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
            />
            <span className="text-xs text-gray-600">Use same file for both sides</span>
          </label>
        )}
      </div>

      <div className="space-y-3">
        {sides.map((side) => {
          const currentMapping = pageMapping[side.key] || { fileId: null, pageIndex: null };
          const selectedFile = availableFiles.find(f => f.id === currentMapping.fileId)?.file;
          const numPages = selectedFile?.num_pages || 0;
          
          // Skip back side if not double-sided
          if (side.key === 'back' && !isDoubleSided) {
            return null;
          }

          const isRequired = side.required || (side.key === 'back' && isDoubleSided);
          const hasError = isRequired && (currentMapping.fileId === null || currentMapping.pageIndex === null);

          return (
            <div 
              key={side.key}
              className={`bg-white rounded-lg p-3 border-2 transition-colors ${
                hasError ? 'border-red-200' : 'border-gray-100'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 min-w-[100px]">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    side.key === 'front' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                  }`}>
                    {side.key === 'front' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-gray-900">
                    {side.label}
                    {isRequired && <span className="text-red-500 ml-0.5">*</span>}
                  </span>
                </div>

                <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {/* File selector (only if multiple files) */}
                  {availableFiles.length > 1 && (
                    <select
                      value={currentMapping.fileId || ''}
                      onChange={(e) => {
                        const newFileId = e.target.value || null;
                        handleAssignment(side.key, newFileId, null);
                      }}
                      className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                        hasError && !currentMapping.fileId ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                    >
                      <option value="">Select file...</option>
                      {availableFiles.map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  )}

                  {/* Page selector */}
                  {(availableFiles.length === 1 || currentMapping.fileId) && (
                    <select
                      value={currentMapping.pageIndex ?? ''}
                      onChange={(e) => {
                        const pageIdx = e.target.value === '' ? null : parseInt(e.target.value);
                        const fileId = currentMapping.fileId || (availableFiles.length === 1 ? availableFiles[0].id : null);
                        handleAssignment(side.key, fileId, pageIdx);
                      }}
                      className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                        hasError && currentMapping.pageIndex === null ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                    >
                      <option value="">Select page...</option>
                      {Array.from({ 
                        length: availableFiles.length === 1 
                          ? (availableFiles[0].file.num_pages || 1)
                          : numPages || 1 
                      }, (_, i) => (
                        <option key={i} value={i}>
                          Page {i + 1}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {hasError && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Please assign a page for {side.label.toLowerCase()}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      {frontFile && frontFile.num_pages >= 2 && isDoubleSided && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              onMappingChange({
                front: { fileId: frontFile.id, pageIndex: 0 },
                back: { fileId: frontFile.id, pageIndex: 1 },
              });
            }}
            className="text-xs text-yellow-600 hover:text-yellow-700 font-medium flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Quick assign: Page 1 to Front, Page 2 to Back
          </button>
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
                        printConfig?.sides?.some(s => s.key === 'back' && s.required);

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
      return 'File must be PDF, PNG, or JPG';
    }
    
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return 'File size must be less than 50MB';
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
      // If PDF with multiple pages and double-sided, auto-assign
      if (side === 'front' && uploadedFile.num_pages >= 2 && isDoubleSided) {
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
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-200/50">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Upload Your Design</h3>
          <p className="text-sm text-gray-500">Upload print-ready files for your product</p>
        </div>
      </div>

      {/* Upload Slots - Stack vertically on mobile */}
      <div className={`flex flex-col ${showBackUpload ? 'lg:flex-row' : ''} gap-4 mb-4`}>
        {/* Front Upload */}
        <FileUploadSlot
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
            label="Back Design"
            required={isDoubleSided}
            file={backFile}
            isUploading={backUploading}
            uploadProgress={backProgress}
            error={backError}
            onFileSelect={(file) => uploadFile(file, 'back', setBackFile, setBackUploading, setBackProgress, setBackError)}
            onRemove={() => removeFile('back')}
            acceptedTypes=".pdf,.png,.jpg,.jpeg"
          />
        )}
      </div>

      {/* Page Assignment Panel */}
      <PageAssignmentPanel
        sides={sides}
        frontFile={frontFile}
        backFile={backFile}
        pageMapping={pageMapping}
        onMappingChange={setPageMapping}
        useSameFile={useSameFile}
        onUseSameFileChange={setUseSameFile}
        isDoubleSided={isDoubleSided}
      />

      {/* Preview Carousel */}
      {(frontFile || backFile) && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Preview Your Print</h4>
          <MockupPreviewCarousel
            frontDesign={frontFile}
            backDesign={backFile}
            pageMapping={pageMapping}
            productSlug={productSlug}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
          />
        </div>
      )}

      {/* Validation Errors */}
      {isDoubleSided && !frontFile && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium text-amber-800">Design Required</p>
              <p className="text-sm text-amber-700 mt-1">
                Please upload your design file{isDoubleSided ? 's' : ''} to continue with double-sided printing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>
          For best results, use high-resolution images (300 DPI) with bleed marks if applicable.
          Supported formats: PDF, PNG, JPG up to 50MB.
        </p>
      </div>
    </div>
  );
};

export default DesignUploadSection;
