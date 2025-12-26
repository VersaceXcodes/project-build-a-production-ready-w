import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface User {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CustomerProfile {
  id: string;
  user_id: string;
  phone: string | null;
  company_name: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

interface StaffProfile {
  id: string;
  user_id: string;
  department: string | null;
  permissions: string; // JSON string
  created_at: string;
  updated_at: string;
}

interface AuthenticationState {
  current_user: User | null;
  user_profile: CustomerProfile | StaffProfile | null;
  auth_token: string | null;
  authentication_status: {
    is_authenticated: boolean;
    is_loading: boolean;
  };
  error_message: string | null;
}

interface Notification {
  id: string;
  user_id: string;
  type: 'ORDER_STATUS' | 'PROOF_READY' | 'MESSAGE' | 'PAYMENT' | 'BOOKING' | 'SYSTEM';
  title: string;
  message: string;
  action_url: string | null;
  is_read: boolean;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  related_object_type: string | null;
  related_object_id: string | null;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  unread_count: number;
  is_loading: boolean;
  last_fetched_at: string | null;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
  action?: {
    label: string;
    on_click: () => void;
  };
  created_at: number;
}

interface Modal {
  type: string | null;
  props: Record<string, any> | null;
  is_open: boolean;
}

interface UIState {
  mobile_nav_open: boolean;
  is_global_loading: boolean;
  active_modal: Modal;
  toast_queue: Toast[];
  window_width: number;
  is_mobile: boolean;
  scroll_position: number;
}

interface RealtimeState {
  is_connected: boolean;
  connection_status: 'disconnected' | 'connecting' | 'connected' | 'error';
  socket_instance: Socket | null;
  reconnect_attempts: number;
  last_event_at: string | null;
}

interface FeatureFlags {
  feature_b2b_enabled: boolean;
  feature_inventory_enabled: boolean;
  feature_analytics_enabled: boolean;
  is_loading: boolean;
  last_fetched_at: string | null;
}

interface QuoteWizardState {
  current_step: number;
  selected_service_id: string | null;
  project_details: Record<string, any>;
  uploaded_files: string[];
  selected_tier_id: string | null;
  is_complete: boolean;
  estimated_price: { min: number; max: number } | null;
}

interface SearchFilterState {
  search_query: string;
  selected_category: string | null;
  status_filter: string | null;
  date_range: {
    start: string | null;
    end: string | null;
  };
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

// ===========================
// MAIN STORE INTERFACE
// ===========================

interface AppStore {
  // State domains
  authentication_state: AuthenticationState;
  notification_state: NotificationState;
  ui_state: UIState;
  realtime_state: RealtimeState;
  feature_flags: FeatureFlags;
  quote_wizard_state: QuoteWizardState;
  search_filter_state: SearchFilterState;

  // Authentication actions
  login_user: (email: string, password: string, role: 'CUSTOMER' | 'STAFF' | 'ADMIN') => Promise<void>;
  register_user: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    company_name?: string;
    address?: string;
  }) => Promise<void>;
  logout_user: () => void;
  check_auth_status: () => Promise<void>;
  update_user_profile: (profile_updates: Partial<CustomerProfile | StaffProfile>) => void;
  clear_auth_error: () => void;

  // Notification actions
  fetch_notifications: () => Promise<void>;
  mark_notification_read: (notification_id: string) => void;
  clear_all_notifications: () => void;
  add_realtime_notification: (notification: Notification) => void;

  // UI actions
  toggle_mobile_nav: () => void;
  set_global_loading: (is_loading: boolean) => void;
  show_modal: (type: string, props?: Record<string, any>) => void;
  close_modal: () => void;
  show_toast: (toast_options: Omit<Toast, 'id' | 'created_at'>) => void;
  dismiss_toast: (toast_id: string) => void;
  update_window_dimensions: () => void;
  update_scroll_position: (position: number) => void;

  // Realtime actions
  connect_websocket: () => void;
  disconnect_websocket: () => void;
  subscribe_to_event: (event_channel: string, handler: (data: any) => void) => void;
  emit_event: (event_channel: string, data: any) => void;

  // Feature flags actions
  fetch_feature_flags: () => Promise<void>;
  toggle_feature_flag: (flag_key: string, enabled: boolean) => Promise<void>;

  // Quote wizard actions
  update_wizard_step: (step: number) => void;
  update_wizard_data: (data: Partial<QuoteWizardState>) => void;
  clear_wizard_data: () => void;

  // Search/filter actions
  update_search_query: (query: string) => void;
  update_category_filter: (category: string | null) => void;
  update_status_filter: (status: string | null) => void;
  update_date_range: (range: { start: string | null; end: string | null }) => void;
  update_sort_config: (sort_by: string, sort_order: 'asc' | 'desc') => void;
  clear_all_filters: () => void;
}

// ===========================
// STORE IMPLEMENTATION
// ===========================

const API_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL 
  ? import.meta.env.VITE_API_BASE_URL 
  : 'http://localhost:3000';

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ===========================
      // INITIAL STATE
      // ===========================
      
      authentication_state: {
        current_user: null,
        user_profile: null,
        auth_token: null,
        authentication_status: {
          is_authenticated: false,
          is_loading: true,
        },
        error_message: null,
      },

      notification_state: {
        notifications: [],
        unread_count: 0,
        is_loading: false,
        last_fetched_at: null,
      },

      ui_state: {
        mobile_nav_open: false,
        is_global_loading: false,
        active_modal: {
          type: null,
          props: null,
          is_open: false,
        },
        toast_queue: [],
        window_width: typeof window !== 'undefined' ? window.innerWidth : 1440,
        is_mobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
        scroll_position: 0,
      },

      realtime_state: {
        is_connected: false,
        connection_status: 'disconnected',
        socket_instance: null,
        reconnect_attempts: 0,
        last_event_at: null,
      },

      feature_flags: {
        feature_b2b_enabled: false,
        feature_inventory_enabled: false,
        feature_analytics_enabled: false,
        is_loading: false,
        last_fetched_at: null,
      },

      quote_wizard_state: {
        current_step: 1,
        selected_service_id: null,
        project_details: {},
        uploaded_files: [],
        selected_tier_id: null,
        is_complete: false,
        estimated_price: null,
      },

      search_filter_state: {
        search_query: '',
        selected_category: null,
        status_filter: null,
        date_range: {
          start: null,
          end: null,
        },
        sort_by: 'created_at',
        sort_order: 'desc',
      },

      // ===========================
      // AUTHENTICATION ACTIONS
      // ===========================

      login_user: async (email: string, password: string, role: 'CUSTOMER' | 'STAFF' | 'ADMIN') => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_loading: true,
            },
            error_message: null,
          },
        }));

        try {
          const response = await axios.post(
            `${API_BASE_URL}/api/auth/login`,
            { email, password, role },
            { headers: { 'Content-Type': 'application/json' } }
          );

          const { user, token, profile } = response.data;

          set((state) => ({
            authentication_state: {
              current_user: user,
              user_profile: profile,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
              },
              error_message: null,
            },
          }));

          // Connect WebSocket after successful login
          get().connect_websocket();

          // Fetch feature flags for admin users
          if (user.role === 'ADMIN') {
            await get().fetch_feature_flags();
          }
        } catch (error: any) {
          const error_message = error.response?.data?.message || error.message || 'Login failed';

          set((state) => ({
            authentication_state: {
              current_user: null,
              user_profile: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
              },
              error_message,
            },
          }));

          throw new Error(error_message);
        }
      },

      register_user: async (data) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_loading: true,
            },
            error_message: null,
          },
        }));

        try {
          const response = await axios.post(
            `${API_BASE_URL}/api/auth/register`,
            data,
            { headers: { 'Content-Type': 'application/json' } }
          );

          const { user, token, customer_profile } = response.data;

          set((state) => ({
            authentication_state: {
              current_user: user,
              user_profile: customer_profile,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
              },
              error_message: null,
            },
          }));

          // Connect WebSocket after registration
          get().connect_websocket();
        } catch (error: any) {
          const error_message = error.response?.data?.message || error.message || 'Registration failed';

          set((state) => ({
            authentication_state: {
              ...state.authentication_state,
              authentication_status: {
                ...state.authentication_state.authentication_status,
                is_loading: false,
              },
              error_message,
            },
          }));

          throw new Error(error_message);
        }
      },

      logout_user: () => {
        // Disconnect WebSocket
        get().disconnect_websocket();

        // Clear all state
        set({
          authentication_state: {
            current_user: null,
            user_profile: null,
            auth_token: null,
            authentication_status: {
              is_authenticated: false,
              is_loading: false,
            },
            error_message: null,
          },
          notification_state: {
            notifications: [],
            unread_count: 0,
            is_loading: false,
            last_fetched_at: null,
          },
          quote_wizard_state: {
            current_step: 1,
            selected_service_id: null,
            project_details: {},
            uploaded_files: [],
            selected_tier_id: null,
            is_complete: false,
            estimated_price: null,
          },
        });
      },

      check_auth_status: async () => {
        const { auth_token } = get().authentication_state;

        if (!auth_token) {
          set((state) => ({
            authentication_state: {
              ...state.authentication_state,
              authentication_status: {
                ...state.authentication_state.authentication_status,
                is_loading: false,
              },
            },
          }));
          return;
        }

        try {
          const response = await axios.get(
            `${API_BASE_URL}/api/auth/me`,
            { headers: { Authorization: `Bearer ${auth_token}` } }
          );

          const { user, profile } = response.data;

          set((state) => ({
            authentication_state: {
              current_user: user,
              user_profile: profile,
              auth_token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
              },
              error_message: null,
            },
          }));

          // Reconnect WebSocket if token valid
          get().connect_websocket();

          // Fetch feature flags for admin users
          if (user.role === 'ADMIN') {
            await get().fetch_feature_flags();
          }
        } catch (error: any) {
          // Token invalid, clear auth
          set((state) => ({
            authentication_state: {
              current_user: null,
              user_profile: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
              },
              error_message: null,
            },
          }));
        }
      },

      update_user_profile: (profile_updates) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            user_profile: state.authentication_state.user_profile
              ? { ...state.authentication_state.user_profile, ...profile_updates }
              : null,
          },
        }));
      },

      clear_auth_error: () => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            error_message: null,
          },
        }));
      },

      // ===========================
      // NOTIFICATION ACTIONS
      // ===========================

      fetch_notifications: async () => {
        const { auth_token, current_user } = get().authentication_state;
        if (!auth_token || !current_user) return;

        set((state) => ({
          notification_state: {
            ...state.notification_state,
            is_loading: true,
          },
        }));

        try {
          // NOTE: This is a placeholder - actual implementation would aggregate from messages/orders
          // For now, we'll derive from other sources or wait for real-time events
          
          set((state) => ({
            notification_state: {
              ...state.notification_state,
              is_loading: false,
              last_fetched_at: new Date().toISOString(),
            },
          }));
        } catch (error: any) {
          console.error('Fetch notifications error:', error);
          set((state) => ({
            notification_state: {
              ...state.notification_state,
              is_loading: false,
            },
          }));
        }
      },

      mark_notification_read: (notification_id: string) => {
        set((state) => ({
          notification_state: {
            ...state.notification_state,
            notifications: state.notification_state.notifications.map((notif) =>
              notif.id === notification_id ? { ...notif, is_read: true } : notif
            ),
            unread_count: Math.max(0, state.notification_state.unread_count - 1),
          },
        }));
      },

      clear_all_notifications: () => {
        set((state) => ({
          notification_state: {
            ...state.notification_state,
            notifications: state.notification_state.notifications.map((notif) => ({
              ...notif,
              is_read: true,
            })),
            unread_count: 0,
          },
        }));
      },

      add_realtime_notification: (notification: Notification) => {
        set((state) => ({
          notification_state: {
            ...state.notification_state,
            notifications: [notification, ...state.notification_state.notifications],
            unread_count: state.notification_state.unread_count + 1,
          },
        }));

        // Show toast for high priority notifications
        if (notification.priority === 'HIGH' || notification.priority === 'URGENT') {
          get().show_toast({
            type: 'info',
            message: notification.message,
            duration: 5000,
          });
        }
      },

      // ===========================
      // UI ACTIONS
      // ===========================

      toggle_mobile_nav: () => {
        set((state) => ({
          ui_state: {
            ...state.ui_state,
            mobile_nav_open: !state.ui_state.mobile_nav_open,
          },
        }));

        // Lock/unlock body scroll
        if (typeof document !== 'undefined') {
          const { mobile_nav_open } = get().ui_state;
          document.body.style.overflow = mobile_nav_open ? 'hidden' : '';
        }
      },

      set_global_loading: (is_loading: boolean) => {
        set((state) => ({
          ui_state: {
            ...state.ui_state,
            is_global_loading: is_loading,
          },
        }));
      },

      show_modal: (type: string, props?: Record<string, any>) => {
        set((state) => ({
          ui_state: {
            ...state.ui_state,
            active_modal: {
              type,
              props: props || null,
              is_open: true,
            },
          },
        }));

        // Lock body scroll
        if (typeof document !== 'undefined') {
          document.body.style.overflow = 'hidden';
        }
      },

      close_modal: () => {
        set((state) => ({
          ui_state: {
            ...state.ui_state,
            active_modal: {
              type: null,
              props: null,
              is_open: false,
            },
          },
        }));

        // Unlock body scroll
        if (typeof document !== 'undefined') {
          document.body.style.overflow = '';
        }
      },

      show_toast: (toast_options) => {
        const toast: Toast = {
          id: `toast_${Date.now()}_${Math.random()}`,
          created_at: Date.now(),
          ...toast_options,
        };

        set((state) => ({
          ui_state: {
            ...state.ui_state,
            toast_queue: [...state.ui_state.toast_queue, toast].slice(-5), // Max 5 toasts
          },
        }));

        // Auto-dismiss after duration
        setTimeout(() => {
          get().dismiss_toast(toast.id);
        }, toast_options.duration || 5000);
      },

      dismiss_toast: (toast_id: string) => {
        set((state) => ({
          ui_state: {
            ...state.ui_state,
            toast_queue: state.ui_state.toast_queue.filter((toast) => toast.id !== toast_id),
          },
        }));
      },

      update_window_dimensions: () => {
        if (typeof window === 'undefined') return;

        const window_width = window.innerWidth;
        const is_mobile = window_width < 768;

        set((state) => ({
          ui_state: {
            ...state.ui_state,
            window_width,
            is_mobile,
          },
        }));
      },

      update_scroll_position: (position: number) => {
        set((state) => ({
          ui_state: {
            ...state.ui_state,
            scroll_position: position,
          },
        }));
      },

      // ===========================
      // REALTIME ACTIONS
      // ===========================

      connect_websocket: () => {
        const { auth_token, current_user } = get().authentication_state;
        const { socket_instance, is_connected } = get().realtime_state;

        // Don't reconnect if already connected
        if (is_connected && socket_instance) return;

        // Only connect if authenticated
        if (!auth_token || !current_user) return;

        try {
          set((state) => ({
            realtime_state: {
              ...state.realtime_state,
              connection_status: 'connecting',
            },
          }));

          const socket = io(API_BASE_URL, {
            auth: { token: auth_token },
            transports: ['websocket', 'polling'],
          });

          socket.on('connect', () => {
            console.log('WebSocket connected');
            set((state) => ({
              realtime_state: {
                ...state.realtime_state,
                is_connected: true,
                connection_status: 'connected',
                socket_instance: socket,
                reconnect_attempts: 0,
                last_event_at: new Date().toISOString(),
              },
            }));
          });

          socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            set((state) => ({
              realtime_state: {
                ...state.realtime_state,
                is_connected: false,
                connection_status: 'disconnected',
              },
            }));
          });

          socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            set((state) => ({
              realtime_state: {
                ...state.realtime_state,
                connection_status: 'error',
                reconnect_attempts: state.realtime_state.reconnect_attempts + 1,
              },
            }));
          });

          // Subscribe to common events
          socket.on('notification/new', (data: any) => {
            get().add_realtime_notification(data);
          });

          socket.on('order/status_updated', (data: any) => {
            get().show_toast({
              type: 'info',
              message: `Order status updated to ${data.new_status}`,
              duration: 5000,
            });
            set((state) => ({
              realtime_state: {
                ...state.realtime_state,
                last_event_at: new Date().toISOString(),
              },
            }));
          });

          socket.on('message/received', (data: any) => {
            get().show_toast({
              type: 'info',
              message: `New message from ${data.sender_name}`,
              duration: 5000,
            });
            set((state) => ({
              notification_state: {
                ...state.notification_state,
                unread_count: state.notification_state.unread_count + 1,
              },
              realtime_state: {
                ...state.realtime_state,
                last_event_at: new Date().toISOString(),
              },
            }));
          });

          socket.on('proof/uploaded', (data: any) => {
            get().show_toast({
              type: 'info',
              message: `Proof version ${data.version_number} uploaded`,
              duration: 5000,
            });
            set((state) => ({
              notification_state: {
                ...state.notification_state,
                unread_count: state.notification_state.unread_count + 1,
              },
              realtime_state: {
                ...state.realtime_state,
                last_event_at: new Date().toISOString(),
              },
            }));
          });

        } catch (error: any) {
          console.error('WebSocket setup error:', error);
          set((state) => ({
            realtime_state: {
              ...state.realtime_state,
              connection_status: 'error',
            },
          }));
        }
      },

      disconnect_websocket: () => {
        const { socket_instance } = get().realtime_state;

        if (socket_instance) {
          socket_instance.disconnect();
          set((state) => ({
            realtime_state: {
              is_connected: false,
              connection_status: 'disconnected',
              socket_instance: null,
              reconnect_attempts: 0,
              last_event_at: null,
            },
          }));
        }
      },

      subscribe_to_event: (event_channel: string, handler: (data: any) => void) => {
        const { socket_instance } = get().realtime_state;
        if (socket_instance) {
          socket_instance.on(event_channel, handler);
        }
      },

      emit_event: (event_channel: string, data: any) => {
        const { socket_instance } = get().realtime_state;
        if (socket_instance) {
          socket_instance.emit(event_channel, data);
        }
      },

      // ===========================
      // FEATURE FLAGS ACTIONS
      // ===========================

      fetch_feature_flags: async () => {
        const { auth_token } = get().authentication_state;
        if (!auth_token) return;

        set((state) => ({
          feature_flags: {
            ...state.feature_flags,
            is_loading: true,
          },
        }));

        try {
          const response = await axios.get(
            `${API_BASE_URL}/api/admin/settings`,
            { headers: { Authorization: `Bearer ${auth_token}` } }
          );

          const settings = response.data;

          const feature_b2b_enabled =
            settings.find((s: any) => s.key === 'feature_b2b_enabled')?.value === 'true';
          const feature_inventory_enabled =
            settings.find((s: any) => s.key === 'feature_inventory_enabled')?.value === 'true';
          const feature_analytics_enabled =
            settings.find((s: any) => s.key === 'feature_analytics_enabled')?.value === 'true';

          set({
            feature_flags: {
              feature_b2b_enabled,
              feature_inventory_enabled,
              feature_analytics_enabled,
              is_loading: false,
              last_fetched_at: new Date().toISOString(),
            },
          });
        } catch (error: any) {
          console.error('Fetch feature flags error:', error);
          set((state) => ({
            feature_flags: {
              ...state.feature_flags,
              is_loading: false,
            },
          }));
        }
      },

      toggle_feature_flag: async (flag_key: string, enabled: boolean) => {
        const { auth_token } = get().authentication_state;
        if (!auth_token) return;

        try {
          await axios.patch(
            `${API_BASE_URL}/api/admin/settings/${flag_key}`,
            { value: enabled.toString() },
            { headers: { Authorization: `Bearer ${auth_token}` } }
          );

          set((state) => ({
            feature_flags: {
              ...state.feature_flags,
              [flag_key]: enabled,
            },
          }));
        } catch (error: any) {
          console.error('Toggle feature flag error:', error);
          throw error;
        }
      },

      // ===========================
      // QUOTE WIZARD ACTIONS
      // ===========================

      update_wizard_step: (step: number) => {
        set((state) => ({
          quote_wizard_state: {
            ...state.quote_wizard_state,
            current_step: step,
          },
        }));
      },

      update_wizard_data: (data: Partial<QuoteWizardState>) => {
        set((state) => ({
          quote_wizard_state: {
            ...state.quote_wizard_state,
            ...data,
          },
        }));
      },

      clear_wizard_data: () => {
        set({
          quote_wizard_state: {
            current_step: 1,
            selected_service_id: null,
            project_details: {},
            uploaded_files: [],
            selected_tier_id: null,
            is_complete: false,
            estimated_price: null,
          },
        });
      },

      // ===========================
      // SEARCH/FILTER ACTIONS
      // ===========================

      update_search_query: (query: string) => {
        set((state) => ({
          search_filter_state: {
            ...state.search_filter_state,
            search_query: query,
          },
        }));
      },

      update_category_filter: (category: string | null) => {
        set((state) => ({
          search_filter_state: {
            ...state.search_filter_state,
            selected_category: category,
          },
        }));
      },

      update_status_filter: (status: string | null) => {
        set((state) => ({
          search_filter_state: {
            ...state.search_filter_state,
            status_filter: status,
          },
        }));
      },

      update_date_range: (range: { start: string | null; end: string | null }) => {
        set((state) => ({
          search_filter_state: {
            ...state.search_filter_state,
            date_range: range,
          },
        }));
      },

      update_sort_config: (sort_by: string, sort_order: 'asc' | 'desc') => {
        set((state) => ({
          search_filter_state: {
            ...state.search_filter_state,
            sort_by,
            sort_order,
          },
        }));
      },

      clear_all_filters: () => {
        set({
          search_filter_state: {
            search_query: '',
            selected_category: null,
            status_filter: null,
            date_range: {
              start: null,
              end: null,
            },
            sort_by: 'created_at',
            sort_order: 'desc',
          },
        });
      },
    }),
    {
      name: 'sultanstamp-app-storage',
      // CRITICAL: Only persist essential data that should survive refresh
      partialize: (state) => ({
        authentication_state: {
          current_user: state.authentication_state.current_user,
          user_profile: state.authentication_state.user_profile,
          auth_token: state.authentication_state.auth_token,
          authentication_status: {
            is_authenticated: state.authentication_state.authentication_status.is_authenticated,
            is_loading: false, // Never persist loading state
          },
          error_message: null, // Never persist errors
        },
        feature_flags: state.feature_flags,
        quote_wizard_state: state.quote_wizard_state,
        search_filter_state: state.search_filter_state,
        // DO NOT persist: notifications, UI state, realtime state
      }),
    }
  )
);

// ===========================
// WINDOW EVENT LISTENERS
// ===========================

if (typeof window !== 'undefined') {
  // Update window dimensions on resize
  window.addEventListener('resize', () => {
    useAppStore.getState().update_window_dimensions();
  });

  // Update scroll position on scroll
  window.addEventListener('scroll', () => {
    useAppStore.getState().update_scroll_position(window.scrollY);
  });
}

// ===========================
// TYPE EXPORTS
// ===========================

export type {
  User,
  CustomerProfile,
  StaffProfile,
  AuthenticationState,
  Notification,
  NotificationState,
  Toast,
  Modal,
  UIState,
  RealtimeState,
  FeatureFlags,
  QuoteWizardState,
  SearchFilterState,
  AppStore,
};