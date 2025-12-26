import React from 'react';
import { useAppStore } from '@/store/main';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

const GV_ToastNotifications: React.FC = () => {
  // CRITICAL: Individual selectors to avoid infinite loops
  const toast_queue = useAppStore((state) => state.ui_state.toast_queue);
  const is_mobile = useAppStore((state) => state.ui_state.is_mobile);
  const dismiss_toast = useAppStore((state) => state.dismiss_toast);

  // Display max 3 toasts at a time
  const max_visible_toasts = 3;
  const visible_toasts = toast_queue.slice(0, max_visible_toasts);

  // Get color and icon based on toast type
  const get_toast_styles = (type: string) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-600',
          icon: <CheckCircle className="h-5 w-5 text-white flex-shrink-0" />,
          aria_live: 'polite' as const,
        };
      case 'error':
        return {
          bg: 'bg-red-600',
          icon: <XCircle className="h-5 w-5 text-white flex-shrink-0" />,
          aria_live: 'assertive' as const,
        };
      case 'warning':
        return {
          bg: 'bg-orange-600',
          icon: <AlertTriangle className="h-5 w-5 text-white flex-shrink-0" />,
          aria_live: 'polite' as const,
        };
      case 'info':
        return {
          bg: 'bg-blue-600',
          icon: <Info className="h-5 w-5 text-white flex-shrink-0" />,
          aria_live: 'polite' as const,
        };
      default:
        return {
          bg: 'bg-gray-600',
          icon: <Info className="h-5 w-5 text-white flex-shrink-0" />,
          aria_live: 'polite' as const,
        };
    }
  };

  const handle_close = (toast_id: string) => {
    dismiss_toast(toast_id);
  };

  const handle_action_click = (toast_id: string, action_callback: () => void) => {
    action_callback();
    dismiss_toast(toast_id);
  };

  if (visible_toasts.length === 0) {
    return null;
  }

  return (
    <>
      {/* Toast Container */}
      <div
        className={`fixed z-[9999] flex flex-col space-y-3 pointer-events-none ${
          is_mobile
            ? 'top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)]'
            : 'top-4 right-4 w-auto max-w-md'
        }`}
      >
        {visible_toasts.map((toast) => {
          const styles = get_toast_styles(toast.type);

          return (
            <div
              key={toast.id}
              role="alert"
              aria-live={styles.aria_live}
              className={`${styles.bg} text-white rounded-lg shadow-lg overflow-hidden pointer-events-auto transform transition-all duration-300 ease-in-out animate-slide-in-right`}
              style={{
                animation: 'slideInRight 0.3s ease-out',
              }}
            >
              <div className="p-4 flex items-start space-x-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>

                {/* Message */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-relaxed break-words">
                    {toast.message}
                  </p>

                  {/* Action Button (if provided) */}
                  {toast.action && (
                    <button
                      onClick={() =>
                        handle_action_click(toast.id, toast.action!.on_click)
                      }
                      className="mt-2 text-sm font-semibold underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-current rounded"
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={() => handle_close(toast.id)}
                  aria-label="Close notification"
                  className="flex-shrink-0 text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white rounded transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Animation Keyframes (injected via style tag) */}
      <style>
        {`
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
      </style>
    </>
  );
};

export default GV_ToastNotifications;