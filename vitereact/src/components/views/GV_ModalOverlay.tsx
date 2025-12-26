import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/main';
import { X, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Info } from 'lucide-react';

const GV_ModalOverlay: React.FC = () => {
  // CRITICAL: Individual selectors to avoid infinite loops
  const activeModal = useAppStore(state => state.ui_state.active_modal);
  const isMobile = useAppStore(state => state.ui_state.is_mobile);
  const closeModal = useAppStore(state => state.close_modal);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLElement | null>(null);
  const lastFocusableRef = useRef<HTMLElement | null>(null);

  // Lightbox state (for image navigation)
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);

  // Focus trap implementation
  useEffect(() => {
    if (!activeModal.is_open || !modalRef.current) return;

    // Find all focusable elements
    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    firstFocusableRef.current = focusableElements[0];
    lastFocusableRef.current = focusableElements[focusableElements.length - 1];

    // Auto-focus first element
    firstFocusableRef.current?.focus();

    // Handle tab key for focus trap
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusableRef.current) {
          e.preventDefault();
          lastFocusableRef.current?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusableRef.current) {
          e.preventDefault();
          firstFocusableRef.current?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [activeModal.is_open]);

  // Escape key to close modal
  useEffect(() => {
    if (!activeModal.is_open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Check if modal has prevent_close flag
        const preventClose = activeModal.props?.prevent_close || false;
        if (!preventClose) {
          handleClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [activeModal.is_open, activeModal.props]);

  // Lightbox keyboard navigation
  useEffect(() => {
    if (!activeModal.is_open || activeModal.type !== 'lightbox') return;

    const handleArrowKeys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        navigate_lightbox('prev');
      } else if (e.key === 'ArrowRight') {
        navigate_lightbox('next');
      }
    };

    document.addEventListener('keydown', handleArrowKeys);
    return () => document.removeEventListener('keydown', handleArrowKeys);
  }, [activeModal.is_open, activeModal.type, lightboxIndex]);

  // Update lightbox index when modal props change
  useEffect(() => {
    if (activeModal.type === 'lightbox' && activeModal.props?.current_index !== undefined) {
      setLightboxIndex(activeModal.props.current_index);
    }
  }, [activeModal.type, activeModal.props?.current_index]);

  const handleClose = () => {
    closeModal();
    // Reset lightbox state
    setLightboxIndex(0);
    setImageLoading(false);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Only close if clicking directly on overlay (not modal content)
    if (e.target === e.currentTarget) {
      const preventClose = activeModal.props?.prevent_close || false;
      if (!preventClose) {
        handleClose();
      }
    }
  };

  const navigate_lightbox = (direction: 'prev' | 'next') => {
    const images = activeModal.props?.images || [];
    if (images.length === 0) return;

    if (direction === 'next') {
      setLightboxIndex((prev) => (prev + 1) % images.length);
    } else {
      setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
    }
    setImageLoading(true);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  // Don't render if modal is not open
  if (!activeModal.is_open || !activeModal.type) {
    return null;
  }

  const modalType = activeModal.type;
  const modalProps = activeModal.props || {};

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
          activeModal.is_open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleOverlayClick}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: isMobile ? 'none' : 'blur(4px)',
        }}
      >
        {/* Modal Container */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalProps.title ? 'modal-title' : undefined}
          className={`
            relative bg-white
            ${isMobile 
              ? 'w-full h-full overflow-y-auto' 
              : 'max-w-2xl w-full mx-4 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto'
            }
            ${activeModal.is_open ? 'animate-modal-enter' : 'animate-modal-exit'}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button - Always visible */}
          {!modalProps.hide_close_button && (
            <button
              type="button"
              onClick={handleClose}
              className={`
                absolute z-10 p-2 rounded-lg transition-all duration-200
                bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900
                focus:outline-none focus:ring-4 focus:ring-blue-100
                ${isMobile ? 'top-4 right-4' : 'top-6 right-6'}
              `}
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          )}

          {/* Modal Content by Type */}
          {modalType === 'confirmation' && (
            <div className={isMobile ? 'p-6' : 'p-8'}>
              {/* Icon based on confirmation type */}
              <div className="flex justify-center mb-4">
                {modalProps.is_destructive ? (
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Info className="w-6 h-6 text-blue-600" />
                  </div>
                )}
              </div>

              {/* Title */}
              <h3 id="modal-title" className="text-2xl font-bold text-gray-900 text-center mb-4">
                {modalProps.title || 'Confirm Action'}
              </h3>

              {/* Message */}
              <p className="text-base text-gray-600 text-center mb-6 leading-relaxed">
                {modalProps.message}
              </p>

              {/* Additional content if provided */}
              {modalProps.additional_content && (
                <div className="mb-6">
                  {modalProps.additional_content}
                </div>
              )}

              {/* Action Buttons */}
              <div className={`flex ${isMobile ? 'flex-col-reverse' : 'flex-row-reverse'} gap-3`}>
                <button
                  type="button"
                  onClick={() => {
                    modalProps.on_confirm?.();
                    handleClose();
                  }}
                  className={`
                    px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200
                    focus:outline-none focus:ring-4
                    ${modalProps.is_destructive
                      ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-100'
                      : 'bg-yellow-400 hover:bg-yellow-500 text-black focus:ring-yellow-100'
                    }
                    ${isMobile ? 'w-full' : ''}
                  `}
                >
                  {modalProps.confirm_text || 'Confirm'}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    modalProps.on_cancel?.();
                    handleClose();
                  }}
                  className={`
                    px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200
                    bg-white hover:bg-gray-100 text-gray-900 border-2 border-gray-300
                    focus:outline-none focus:ring-4 focus:ring-gray-100
                    ${isMobile ? 'w-full' : ''}
                  `}
                >
                  {modalProps.cancel_text || 'Cancel'}
                </button>
              </div>
            </div>
          )}

          {modalType === 'lightbox' && (
            <div className="relative w-full h-full bg-black">
              {/* Image */}
              <div className="flex items-center justify-center h-full p-4">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-400 border-t-transparent"></div>
                  </div>
                )}
                
                <img
                  src={modalProps.images?.[lightboxIndex]?.url}
                  alt={modalProps.images?.[lightboxIndex]?.caption || `Image ${lightboxIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                  onLoad={handleImageLoad}
                  style={{ opacity: imageLoading ? 0 : 1, transition: 'opacity 300ms' }}
                />
              </div>

              {/* Image Caption */}
              {modalProps.images?.[lightboxIndex]?.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                  <p className="text-white text-center text-sm">
                    {modalProps.images[lightboxIndex].caption}
                  </p>
                </div>
              )}

              {/* Navigation Arrows */}
              {modalProps.images?.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => navigate_lightbox('prev')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-yellow-400"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate_lightbox('next')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-yellow-400"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Image Counter */}
              {modalProps.images?.length > 1 && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                  {lightboxIndex + 1} / {modalProps.images.length}
                </div>
              )}
            </div>
          )}

          {modalType === 'form' && (
            <div className={isMobile ? 'p-6' : 'p-8'}>
              {/* Title */}
              <h3 id="modal-title" className="text-2xl font-bold text-gray-900 mb-6">
                {modalProps.title || 'Form'}
              </h3>

              {/* Form Content */}
              <div className="mb-6">
                {modalProps.form_component}
              </div>

              {/* Submit Button (if not handled by form_component) */}
              {modalProps.on_submit && (
                <button
                  type="button"
                  onClick={() => {
                    modalProps.on_submit?.();
                    if (!modalProps.keep_open_after_submit) {
                      handleClose();
                    }
                  }}
                  className={`
                    px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200
                    bg-yellow-400 hover:bg-yellow-500 text-black
                    focus:outline-none focus:ring-4 focus:ring-yellow-100
                    ${isMobile ? 'w-full' : ''}
                  `}
                >
                  {modalProps.submit_text || 'Submit'}
                </button>
              )}
            </div>
          )}

          {modalType === 'info' && (
            <div className={isMobile ? 'p-6' : 'p-8'}>
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Info className="w-6 h-6 text-blue-600" />
                </div>
              </div>

              {/* Title */}
              <h3 id="modal-title" className="text-2xl font-bold text-gray-900 text-center mb-4">
                {modalProps.title || 'Information'}
              </h3>

              {/* Content */}
              <div className="text-base text-gray-700 leading-relaxed mb-6">
                {typeof modalProps.content === 'string' ? (
                  <p className="text-center">{modalProps.content}</p>
                ) : (
                  modalProps.content
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleClose}
                className={`
                  px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200
                  bg-gray-900 hover:bg-black text-white
                  focus:outline-none focus:ring-4 focus:ring-gray-200
                  ${isMobile ? 'w-full' : 'mx-auto block'}
                `}
              >
                {modalProps.close_text || 'Got it'}
              </button>
            </div>
          )}

          {modalType === 'invoice_preview' && (
            <div className={`${isMobile ? 'p-6' : 'p-8'} bg-gray-50`}>
              {/* Title */}
              <h3 id="modal-title" className="text-2xl font-bold text-gray-900 mb-6">
                Invoice Preview
              </h3>

              {/* Invoice Details */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                {/* Customer Info */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Billed To
                  </h4>
                  <p className="text-base text-gray-900 font-medium">
                    {modalProps.customer?.name}
                  </p>
                  {modalProps.customer?.company_name && (
                    <p className="text-sm text-gray-600">{modalProps.customer.company_name}</p>
                  )}
                  <p className="text-sm text-gray-600">{modalProps.customer?.email}</p>
                </div>

                {/* Line Items */}
                <div className="border-t border-gray-200 pt-6 mb-6">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Order Details
                  </h4>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-base">
                      <span className="text-gray-700">
                        {modalProps.service?.name} - {modalProps.tier?.name}
                      </span>
                      <span className="text-gray-900 font-medium">
                        €{Number(modalProps.subtotal || 0).toFixed(2)}
                      </span>
                    </div>

                    {modalProps.emergency_fee && Number(modalProps.emergency_fee) > 0 && (
                      <div className="flex justify-between text-base">
                        <span className="text-gray-700">Emergency Booking Fee</span>
                        <span className="text-gray-900 font-medium">
                          €{Number(modalProps.emergency_fee).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between text-base mb-2">
                    <span className="text-gray-700">Subtotal</span>
                    <span className="text-gray-900">€{Number(modalProps.subtotal || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-base mb-4">
                    <span className="text-gray-700">VAT (23%)</span>
                    <span className="text-gray-900">€{Number(modalProps.tax_amount || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-xl font-bold border-t border-gray-300 pt-4">
                    <span className="text-gray-900">Total Amount</span>
                    <span className="text-gray-900">€{Number(modalProps.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Close Actions */}
              <div className={`flex ${isMobile ? 'flex-col' : 'flex-row-reverse'} gap-3`}>
                {modalProps.on_confirm && (
                  <button
                    type="button"
                    onClick={() => {
                      modalProps.on_confirm?.();
                      handleClose();
                    }}
                    className={`
                      px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200
                      bg-yellow-400 hover:bg-yellow-500 text-black
                      focus:outline-none focus:ring-4 focus:ring-yellow-100
                      ${isMobile ? 'w-full' : ''}
                    `}
                  >
                    {modalProps.confirm_text || 'Looks Good'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClose}
                  className={`
                    px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200
                    bg-white hover:bg-gray-100 text-gray-900 border-2 border-gray-300
                    focus:outline-none focus:ring-4 focus:ring-gray-100
                    ${isMobile ? 'w-full' : ''}
                  `}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {modalType === 'tier_comparison' && (
            <div className={isMobile ? 'p-6' : 'p-8'}>
              {/* Title */}
              <h3 id="modal-title" className="text-2xl font-bold text-gray-900 mb-6">
                Compare All Tier Features
              </h3>

              {/* Table (Desktop) / Accordion (Mobile) */}
              {isMobile ? (
                <div className="space-y-4">
                  {/* Mobile: Each tier is a collapsible section */}
                  {modalProps.tiers?.map((tierData: any, idx: number) => (
                    <details key={tierData.tier.id} className="bg-white rounded-lg border border-gray-200">
                      <summary className="px-4 py-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50">
                        {tierData.tier.name}
                      </summary>
                      <div className="px-4 py-3 border-t border-gray-200">
                        {tierData.features?.map((feature: any) => (
                          <div key={feature.id} className="py-2 flex justify-between items-center">
                            <span className="text-sm text-gray-700">{feature.feature_label}</span>
                            <span className="text-sm font-medium text-gray-900">
                              {feature.is_included ? (
                                feature.feature_value || <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <X className="w-5 h-5 text-gray-400" />
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          Feature
                        </th>
                        {modalProps.tiers?.map((tierData: any) => (
                          <th key={tierData.tier.id} className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                            {tierData.tier.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Group features by group_name */}
                      {Object.entries(
                        (modalProps.tiers?.[0]?.features || []).reduce((acc: any, feature: any) => {
                          if (!acc[feature.group_name]) acc[feature.group_name] = [];
                          acc[feature.group_name].push(feature.feature_key);
                          return acc;
                        }, {})
                      ).map(([groupName, featureKeys]: [string, any]) => (
                        <React.Fragment key={groupName}>
                          {/* Group Header */}
                          <tr className="bg-gray-50">
                            <td colSpan={modalProps.tiers?.length + 1} className="px-4 py-2 text-sm font-semibold text-gray-700 uppercase tracking-wide">
                              {groupName}
                            </td>
                          </tr>
                          
                          {/* Features in this group */}
                          {featureKeys.map((featureKey: string) => {
                            // Find this feature in each tier
                            const featureRow = modalProps.tiers?.map((tierData: any) =>
                              tierData.features.find((f: any) => f.feature_key === featureKey)
                            );
                            
                            const featureLabel = featureRow?.[0]?.feature_label || featureKey;

                            return (
                              <tr key={featureKey} className="border-t border-gray-200">
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {featureLabel}
                                </td>
                                {featureRow?.map((feature: any, idx: number) => (
                                  <td key={idx} className="px-4 py-3 text-center text-sm">
                                    {feature?.is_included ? (
                                      feature.feature_value ? (
                                        <span className="text-gray-900 font-medium">
                                          {feature.feature_value}
                                        </span>
                                      ) : (
                                        <CheckCircle className="w-5 h-5 text-green-600 inline-block" />
                                      )
                                    ) : (
                                      <X className="w-5 h-5 text-gray-400 inline-block" />
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Close Button */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleClose}
                  className={`
                    px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200
                    bg-gray-900 hover:bg-black text-white
                    focus:outline-none focus:ring-4 focus:ring-gray-200
                    ${isMobile ? 'w-full' : 'mx-auto block'}
                  `}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {modalType === 'custom' && (
            <div className={isMobile ? 'p-6' : 'p-8'}>
              {/* Title (optional) */}
              {modalProps.title && (
                <h3 id="modal-title" className="text-2xl font-bold text-gray-900 mb-6">
                  {modalProps.title}
                </h3>
              )}

              {/* Custom Content */}
              <div>
                {modalProps.content}
              </div>
            </div>
          )}

          {modalType === 'success' && (
            <div className={isMobile ? 'p-6' : 'p-8'}>
              {/* Success Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
              </div>

              {/* Title */}
              <h3 id="modal-title" className="text-2xl font-bold text-gray-900 text-center mb-4">
                {modalProps.title || 'Success'}
              </h3>

              {/* Message */}
              <p className="text-base text-gray-600 text-center mb-6 leading-relaxed">
                {modalProps.message}
              </p>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => {
                  modalProps.on_confirm?.();
                  handleClose();
                }}
                className={`
                  px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200
                  bg-green-600 hover:bg-green-700 text-white
                  focus:outline-none focus:ring-4 focus:ring-green-100
                  ${isMobile ? 'w-full' : 'mx-auto block'}
                `}
              >
                {modalProps.confirm_text || 'Continue'}
              </button>
            </div>
          )}

          {modalType === 'error' && (
            <div className={isMobile ? 'p-6' : 'p-8'}>
              {/* Error Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
              </div>

              {/* Title */}
              <h3 id="modal-title" className="text-2xl font-bold text-gray-900 text-center mb-4">
                {modalProps.title || 'Error'}
              </h3>

              {/* Message */}
              <p className="text-base text-gray-600 text-center mb-6 leading-relaxed">
                {modalProps.message}
              </p>

              {/* Error Details (if provided) */}
              {modalProps.error_details && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                  <p className="text-sm text-red-800 font-mono">{modalProps.error_details}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className={`flex ${isMobile ? 'flex-col' : 'flex-row-reverse'} gap-3`}>
                {modalProps.on_retry && (
                  <button
                    type="button"
                    onClick={() => {
                      modalProps.on_retry?.();
                      handleClose();
                    }}
                    className={`
                      px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200
                      bg-blue-600 hover:bg-blue-700 text-white
                      focus:outline-none focus:ring-4 focus:ring-blue-100
                      ${isMobile ? 'w-full' : ''}
                    `}
                  >
                    {modalProps.retry_text || 'Try Again'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClose}
                  className={`
                    px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200
                    bg-white hover:bg-gray-100 text-gray-900 border-2 border-gray-300
                    focus:outline-none focus:ring-4 focus:ring-gray-100
                    ${isMobile ? 'w-full' : ''}
                  `}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes modal-enter {
          from {
            opacity: 0;
            transform: ${isMobile ? 'translateY(100%)' : 'scale(0.95)'};
          }
          to {
            opacity: 1;
            transform: ${isMobile ? 'translateY(0)' : 'scale(1)'};
          }
        }

        @keyframes modal-exit {
          from {
            opacity: 1;
            transform: ${isMobile ? 'translateY(0)' : 'scale(1)'};
          }
          to {
            opacity: 0;
            transform: ${isMobile ? 'translateY(100%)' : 'scale(0.95)'};
          }
        }

        .animate-modal-enter {
          animation: modal-enter 300ms ease-out forwards;
        }

        .animate-modal-exit {
          animation: modal-exit 300ms ease-in forwards;
        }
      `}</style>
    </>
  );
};

export default GV_ModalOverlay;