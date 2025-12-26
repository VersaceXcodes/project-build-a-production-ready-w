import React from 'react';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'black' | 'yellow' | 'white';
  className?: string;
}

interface SkeletonProps {
  variant?: 'text' | 'card' | 'table' | 'image' | 'button';
  count?: number;
  className?: string;
}

interface ProgressBarProps {
  progress: number; // 0-100
  height?: 'sm' | 'md' | 'lg';
  color?: 'yellow' | 'blue' | 'green';
  showPercentage?: boolean;
  label?: string;
  className?: string;
}

// ===========================
// SPINNER COMPONENT
// ===========================

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md', 
  color = 'black',
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  const colorClasses = {
    black: 'text-black',
    yellow: 'text-yellow-400',
    white: 'text-white'
  };

  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
};

// ===========================
// FULL-SCREEN LOADER
// ===========================

export const FullScreenLoader: React.FC = () => {
  const isGlobalLoading = useAppStore(state => state.ui_state.is_global_loading);

  if (!isGlobalLoading) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
        role="alert"
        aria-live="assertive"
        aria-busy="true"
      >
        <div className="flex flex-col items-center space-y-4">
          <Spinner size="xl" color="black" />
          <p className="text-black text-lg font-semibold">Loading...</p>
        </div>
      </div>
    </>
  );
};

// ===========================
// INLINE SPINNER
// ===========================

export const InlineSpinner: React.FC<{ text?: string; size?: 'sm' | 'md' | 'lg' }> = ({ 
  text = 'Loading...', 
  size = 'md' 
}) => {
  return (
    <>
      <div className="flex items-center justify-center space-x-3 py-8">
        <Spinner size={size} color="black" />
        <span className="text-gray-700 text-sm font-medium">{text}</span>
      </div>
    </>
  );
};

// ===========================
// BUTTON SPINNER
// ===========================

export const ButtonSpinner: React.FC<{ text?: string; size?: 'sm' | 'md' }> = ({ 
  text = 'Processing...', 
  size = 'sm' 
}) => {
  return (
    <>
      <span className="flex items-center justify-center space-x-2">
        <Spinner size={size} color="white" />
        <span>{text}</span>
      </span>
    </>
  );
};

// ===========================
// SKELETON COMPONENTS
// ===========================

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 3, 
  className = '' 
}) => {
  return (
    <>
      <div className={`animate-pulse space-y-3 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className="h-4 bg-gray-200 rounded"
            style={{ width: `${Math.random() * 30 + 70}%` }}
          ></div>
        ))}
      </div>
    </>
  );
};

export const SkeletonCard: React.FC<{ count?: number; className?: string }> = ({ 
  count = 1, 
  className = '' 
}) => {
  return (
    <>
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse"
          >
            {/* Image skeleton */}
            <div className="h-48 bg-gray-200 rounded-md mb-4"></div>
            
            {/* Title skeleton */}
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
            
            {/* Text skeleton */}
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
            
            {/* Button skeleton */}
            <div className="h-10 bg-gray-200 rounded w-32 mt-4"></div>
          </div>
        ))}
      </div>
    </>
  );
};

export const SkeletonTable: React.FC<{ rows?: number; columns?: number; className?: string }> = ({ 
  rows = 5, 
  columns = 4,
  className = '' 
}) => {
  return (
    <>
      <div className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}>
        <div className="animate-pulse">
          {/* Table header */}
          <div className="bg-gray-100 border-b border-gray-200 px-6 py-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, index) => (
                <div key={index} className="h-4 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
          
          {/* Table rows */}
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="border-b border-gray-200 px-6 py-4">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div key={colIndex} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export const SkeletonImage: React.FC<{ 
  aspectRatio?: 'square' | 'video' | 'portrait';
  className?: string;
}> = ({ 
  aspectRatio = 'square',
  className = '' 
}) => {
  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]'
  };

  return (
    <>
      <div className={`bg-gray-200 rounded-lg animate-pulse ${aspectClasses[aspectRatio]} ${className}`}></div>
    </>
  );
};

// ===========================
// PROGRESS BAR
// ===========================

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 'md',
  color = 'yellow',
  showPercentage = false,
  label = '',
  className = ''
}) => {
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const colorClasses = {
    yellow: 'bg-yellow-400',
    blue: 'bg-blue-600',
    green: 'bg-green-600'
  };

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <>
      <div className={`space-y-2 ${className}`}>
        {(label || showPercentage) && (
          <div className="flex justify-between items-center text-sm">
            {label && <span className="text-gray-700 font-medium">{label}</span>}
            {showPercentage && <span className="text-gray-600">{Math.round(clampedProgress)}%</span>}
          </div>
        )}
        
        <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${heightClasses[height]}`}>
          <div
            className={`${heightClasses[height]} ${colorClasses[color]} transition-all duration-300 ease-out rounded-full`}
            style={{ width: `${clampedProgress}%` }}
            role="progressbar"
            aria-valuenow={clampedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          ></div>
        </div>
      </div>
    </>
  );
};

// ===========================
// UPLOAD PROGRESS INDICATOR
// ===========================

export const UploadProgress: React.FC<{
  fileName: string;
  progress: number;
  onCancel?: () => void;
  className?: string;
}> = ({ fileName, progress, onCancel, className = '' }) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const isComplete = clampedProgress >= 100;

  return (
    <>
      <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              {isComplete ? (
                <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {fileName}
              </p>
              <p className="text-xs text-gray-600">
                {isComplete ? 'Upload complete' : `${Math.round(clampedProgress)}% uploaded`}
              </p>
            </div>
          </div>
          
          {!isComplete && onCancel && (
            <button
              onClick={onCancel}
              className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Cancel upload"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        
        <ProgressBar
          progress={clampedProgress}
          height="sm"
          color={isComplete ? 'green' : 'yellow'}
          showPercentage={false}
        />
      </div>
    </>
  );
};

// ===========================
// LOADING BUTTON
// ===========================

export const LoadingButton: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
}> = ({ 
  isLoading, 
  children, 
  loadingText = 'Processing...',
  variant = 'primary',
  size = 'md',
  onClick,
  type = 'button',
  disabled = false,
  className = ''
}) => {
  const variantClasses = {
    primary: 'bg-yellow-400 hover:bg-yellow-500 text-black border-2 border-black',
    secondary: 'bg-white hover:bg-gray-50 text-black border-2 border-black',
    danger: 'bg-red-600 hover:bg-red-700 text-white border-2 border-red-700'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  return (
    <>
      <button
        type={type}
        onClick={onClick}
        disabled={isLoading || disabled}
        className={`
          relative inline-flex items-center justify-center
          font-semibold rounded-md
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
      >
        {isLoading ? (
          <ButtonSpinner text={loadingText} size="sm" />
        ) : (
          children
        )}
      </button>
    </>
  );
};

// ===========================
// SKELETON GRID
// ===========================

export const SkeletonGrid: React.FC<{
  columns?: 1 | 2 | 3 | 4;
  rows?: number;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ 
  columns = 3, 
  rows = 3, 
  gap = 'md',
  className = '' 
}) => {
  const gapClasses = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8'
  };

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <>
      <div className={`grid ${columnClasses[columns]} ${gapClasses[gap]} ${className}`}>
        {Array.from({ length: rows * columns }).map((_, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
            {/* Image placeholder */}
            <div className="aspect-video bg-gray-200 rounded-md mb-4"></div>
            
            {/* Title placeholder */}
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
            
            {/* Description placeholders */}
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            </div>
            
            {/* Button placeholder */}
            <div className="h-9 bg-gray-200 rounded w-28 mt-4"></div>
          </div>
        ))}
      </div>
    </>
  );
};

// ===========================
// LOADING OVERLAY (Section-specific)
// ===========================

export const LoadingOverlay: React.FC<{
  isLoading: boolean;
  text?: string;
  children?: React.ReactNode;
  className?: string;
}> = ({ isLoading, text = 'Loading...', children, className = '' }) => {
  return (
    <>
      <div className={`relative ${className}`}>
        {children}
        
        {isLoading && (
          <div 
            className="absolute inset-0 bg-white/90 flex items-center justify-center z-10 rounded-lg"
            role="alert"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex flex-col items-center space-y-3">
              <Spinner size="lg" color="black" />
              <p className="text-black text-sm font-medium">{text}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ===========================
// SHIMMER SKELETON (Advanced)
// ===========================

export const ShimmerSkeleton: React.FC<{
  variant: 'card' | 'list' | 'table' | 'detail';
  count?: number;
  className?: string;
}> = ({ variant, count = 1, className = '' }) => {
  const shimmerStyle = `
    relative overflow-hidden
    before:absolute before:inset-0
    before:-translate-x-full
    before:animate-[shimmer_2s_infinite]
    before:bg-gradient-to-r
    before:from-transparent before:via-white/60 before:to-transparent
  `;

  if (variant === 'card') {
    return (
      <>
        <div className={`space-y-6 ${className}`}>
          {Array.from({ length: count }).map((_, index) => (
            <div key={index} className={`bg-gray-100 rounded-xl p-6 ${shimmerStyle}`}>
              <div className="flex items-start space-x-4">
                <div className="h-16 w-16 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (variant === 'list') {
    return (
      <>
        <div className={`space-y-4 ${className}`}>
          {Array.from({ length: count }).map((_, index) => (
            <div key={index} className={`bg-gray-100 rounded-lg p-4 ${shimmerStyle}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
                <div className="h-8 w-20 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (variant === 'table') {
    return <SkeletonTable rows={count} columns={5} className={className} />;
  }

  // Detail view skeleton
  return (
    <>
      <div className={`space-y-6 ${className}`}>
        {/* Header */}
        <div className={`bg-gray-100 rounded-lg p-6 ${shimmerStyle}`}>
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        
        {/* Content sections */}
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className={`bg-gray-100 rounded-lg p-6 ${shimmerStyle}`}>
            <div className="h-5 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

// ===========================
// EMPTY STATE (Not loading, but related)
// ===========================

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}> = ({ icon, title, description, action, className = '' }) => {
  return (
    <>
      <div className={`text-center py-12 px-4 ${className}`}>
        {icon && (
          <div className="flex justify-center mb-4">
            <div className="text-gray-400">
              {icon}
            </div>
          </div>
        )}
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        
        {description && (
          <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            {description}
          </p>
        )}
        
        {action && (
          <button
            onClick={action.onClick}
            className="inline-flex items-center px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-md border-2 border-black transition-colors duration-200"
          >
            {action.label}
          </button>
        )}
      </div>
    </>
  );
};

// ===========================
// DOTS LOADER (Alternative)
// ===========================

export const DotsLoader: React.FC<{ 
  color?: 'black' | 'yellow' | 'white';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ color = 'black', size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2.5 w-2.5',
    lg: 'h-4 w-4'
  };

  const colorClasses = {
    black: 'bg-black',
    yellow: 'bg-yellow-400',
    white: 'bg-white'
  };

  return (
    <>
      <div className={`flex items-center space-x-2 ${className}`} role="alert" aria-label="Loading">
        <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
        <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
        <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
      </div>
    </>
  );
};

// ===========================
// MAIN COMPONENT (Global Manager)
// ===========================

const GV_LoadingStates: React.FC = () => {
  // This component manages global loading states and renders full-screen overlay
  // Other loading components are exported for use in individual views
  
  return (
    <>
      <FullScreenLoader />
      
      {/* Add shimmer animation to global styles */}
      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </>
  );
};

export default GV_LoadingStates;

