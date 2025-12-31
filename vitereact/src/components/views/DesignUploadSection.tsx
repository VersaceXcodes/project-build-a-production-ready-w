import React, { useState, useCallback, useRef } from 'react';
import axios from 'axios';

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

interface UploadedDesign {
  id: string;
  file_url: string;
  file_type: string;
  original_filename: string;
  num_pages: number;
  preview_images: string[];
}

interface PageMapping {
  [sideKey: string]: number | null; // null means "no page assigned", number is page index (0-based)
}

interface DesignUploadSectionProps {
  productId: string;
  printConfig: PrintConfig | null;
  onDesignChange: (design: UploadedDesign | null, pageMapping: PageMapping) => void;
  sessionId?: string;
}

// ===========================
// MAIN COMPONENT
// ===========================

const DesignUploadSection: React.FC<DesignUploadSectionProps> = ({
  productId,
  printConfig,
  onDesignChange,
  sessionId,
}) => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Design state
  const [uploadedDesign, setUploadedDesign] = useState<UploadedDesign | null>(null);
  const [pageMapping, setPageMapping] = useState<PageMapping>({});
  
  // Preview state
  const [selectedPreviewPage, setSelectedPreviewPage] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState(100);

  const sides = printConfig?.sides || [
    { key: 'front', label: 'Front', required: true },
    { key: 'back', label: 'Back', required: false },
  ];

  // ===========================
  // FILE HANDLING
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

  const uploadFile = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('product_id', productId);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }

    try {
      const response = await axios.post<UploadedDesign>(
        `${API_BASE_URL}/api/design-uploads`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(progress);
            }
          },
        }
      );

      const design: UploadedDesign = {
        id: response.data.id || (response.data as any).designUploadId,
        file_url: response.data.file_url,
        file_type: response.data.file_type,
        original_filename: response.data.original_filename,
        num_pages: response.data.num_pages || (response.data as any).numPages || 1,
        preview_images: response.data.preview_images || (response.data as any).previewImages || [],
      };

      setUploadedDesign(design);
      setSelectedPreviewPage(0);
      
      // Initialize page mapping - auto-assign first pages to required sides
      const initialMapping: PageMapping = {};
      let pageIndex = 0;
      sides.forEach((side) => {
        if (pageIndex < design.num_pages) {
          initialMapping[side.key] = pageIndex;
          pageIndex++;
        } else {
          initialMapping[side.key] = null;
        }
      });
      setPageMapping(initialMapping);
      onDesignChange(design, initialMapping);
      
    } catch (err: any) {
      setUploadError(err.response?.data?.message || 'Upload failed. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  }, [productId, sessionId]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleRemoveDesign = async () => {
    if (!uploadedDesign) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/api/design-uploads/${uploadedDesign.id}`);
    } catch (err) {
      console.error('Failed to delete design:', err);
    }
    
    setUploadedDesign(null);
    setPageMapping({});
    setUploadError(null);
    onDesignChange(null, {});
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ===========================
  // PAGE MAPPING
  // ===========================

  const handlePageMappingChange = (sideKey: string, pageIndex: number | null) => {
    const newMapping = { ...pageMapping, [sideKey]: pageIndex };
    setPageMapping(newMapping);
    onDesignChange(uploadedDesign, newMapping);
    
    // Update preview to show selected page
    if (pageIndex !== null) {
      setSelectedPreviewPage(pageIndex);
    }
  };

  // ===========================
  // RENDER
  // ===========================

  // Don't render if design upload is not required
  if (!printConfig?.requires_design_upload) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Upload Your Design</h3>
      
      {/* Dropzone - shown when no design uploaded */}
      {!uploadedDesign && !isUploading && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-yellow-400 bg-yellow-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center">
            <svg
              className={`w-12 h-12 mb-4 ${isDragging ? 'text-yellow-500' : 'text-gray-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-gray-700 font-medium mb-1">
              Drop your design file here
            </p>
            <p className="text-gray-500 text-sm mb-2">
              or click to browse
            </p>
            <p className="text-gray-400 text-xs">
              PDF, PNG, or JPG (max 50MB)
            </p>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="border-2 border-gray-200 rounded-xl p-8">
          <div className="flex flex-col items-center">
            <svg className="animate-spin w-10 h-10 text-yellow-500 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-700 font-medium mb-2">Uploading...</p>
            <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-yellow-400 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-gray-500 text-sm mt-2">{uploadProgress}%</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 text-sm">{uploadError}</p>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Uploaded Design Preview & Mapping */}
      {uploadedDesign && (
        <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
          {/* Header with file info */}
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                {uploadedDesign.file_type === 'pdf' ? (
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm truncate max-w-[200px]">
                  {uploadedDesign.original_filename}
                </p>
                <p className="text-gray-500 text-xs">
                  {uploadedDesign.num_pages} page{uploadedDesign.num_pages > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveDesign}
              className="text-gray-400 hover:text-red-500 transition-colors p-2"
              title="Remove design"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Main content - Mobile: Stack, Desktop: Side by side */}
          <div className="flex flex-col lg:flex-row">
            {/* Preview Panel */}
            <div className="lg:flex-1 p-4 border-b lg:border-b-0 lg:border-r border-gray-200">
              <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
                {/* Preview Image */}
                <div 
                  className="flex items-center justify-center p-4"
                  style={{ 
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.2s ease'
                  }}
                >
                  {uploadedDesign.preview_images[selectedPreviewPage] ? (
                    uploadedDesign.file_type === 'pdf' ? (
                      <div className="bg-white shadow-lg rounded p-4 text-center">
                        <svg className="w-24 h-24 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-gray-600 text-sm">Page {selectedPreviewPage + 1}</p>
                        <p className="text-gray-400 text-xs mt-1">(PDF preview)</p>
                      </div>
                    ) : (
                      <img
                        src={`${API_BASE_URL}${uploadedDesign.preview_images[selectedPreviewPage]}`}
                        alt={`Preview page ${selectedPreviewPage + 1}`}
                        className="max-w-full max-h-[400px] object-contain rounded shadow-lg"
                      />
                    )
                  ) : (
                    <div className="text-gray-400 text-center py-8">
                      <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">No preview available</p>
                    </div>
                  )}
                </div>

                {/* Zoom Controls */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
                  <button
                    onClick={() => setZoomLevel(Math.max(50, zoomLevel - 25))}
                    disabled={zoomLevel <= 50}
                    className="text-gray-600 hover:text-gray-900 disabled:text-gray-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-sm font-medium text-gray-700 min-w-[3rem] text-center">
                    {zoomLevel}%
                  </span>
                  <button
                    onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
                    disabled={zoomLevel >= 200}
                    className="text-gray-600 hover:text-gray-900 disabled:text-gray-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setZoomLevel(100)}
                    className="text-gray-500 hover:text-gray-700 text-xs ml-2"
                  >
                    Fit
                  </button>
                </div>
              </div>

              {/* Page Thumbnails - Horizontal scrollable */}
              {uploadedDesign.num_pages > 1 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">Pages</p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {Array.from({ length: uploadedDesign.num_pages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedPreviewPage(i)}
                        className={`flex-shrink-0 w-16 h-20 rounded-lg border-2 flex items-center justify-center transition-all ${
                          selectedPreviewPage === i
                            ? 'border-yellow-400 bg-yellow-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="text-center">
                          <svg className="w-6 h-6 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs text-gray-600">{i + 1}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Side Mapping Panel */}
            <div className="lg:w-64 p-4">
              <p className="text-sm font-medium text-gray-900 mb-3">Assign Pages to Print Sides</p>
              
              <div className="space-y-3">
                {sides.map((side) => (
                  <div key={side.key}>
                    <label className="flex items-center justify-between text-sm text-gray-700 mb-1">
                      <span>
                        {side.label}
                        {side.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                    </label>
                    <select
                      value={pageMapping[side.key] ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        handlePageMappingChange(
                          side.key,
                          value === '' ? null : parseInt(value, 10)
                        );
                      }}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                        side.required && pageMapping[side.key] === null
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <option value="">-- Select page --</option>
                      {Array.from({ length: uploadedDesign.num_pages }, (_, i) => (
                        <option key={i} value={i}>
                          Page {i + 1}
                        </option>
                      ))}
                    </select>
                    {side.required && pageMapping[side.key] === null && (
                      <p className="text-red-500 text-xs mt-1">Required</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Mapping Summary */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  {(() => {
                    const requiredSides = sides.filter(s => s.required);
                    const mappedRequired = requiredSides.filter(s => pageMapping[s.key] !== null && pageMapping[s.key] !== undefined);
                    return `${mappedRequired.length}/${requiredSides.length} required sides assigned`;
                  })()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-gray-500 mt-3">
        Upload your print-ready design file. For best results, use high-resolution images (300 DPI) with bleed marks if applicable.
      </p>
    </div>
  );
};

export default DesignUploadSection;
