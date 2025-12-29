import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import sultanstampLogo from '@/assets/sultanstamp_logo.jpeg';
import { 
  Bell, 
  User, 
  Menu, 
  X,
  Home,
  FileText,
  ShoppingCart,
  Calendar,
  Briefcase,
  ClipboardList,
  Settings,
  Users,
  TrendingUp,
  Package,
  BarChart3,
  LogOut,
  Globe
} from 'lucide-react';

const GV_HeaderAuth: React.FC = () => {
  // ===========================
  // GLOBAL STATE ACCESS
  // ===========================
  // CRITICAL: Individual selectors to prevent infinite loops
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const unread_count = useAppStore(state => state.notification_state.unread_count);
  const feature_b2b_enabled = useAppStore(state => state.feature_flags.feature_b2b_enabled);
  const feature_inventory_enabled = useAppStore(state => state.feature_flags.feature_inventory_enabled);
  const feature_analytics_enabled = useAppStore(state => state.feature_flags.feature_analytics_enabled);
  const logout_user = useAppStore(state => state.logout_user);

  // ===========================
  // LOCAL STATE
  // ===========================
  const [notifications_dropdown_open, set_notifications_dropdown_open] = useState(false);
  const [user_menu_open, set_user_menu_open] = useState(false);
  const [mobile_nav_open, set_mobile_nav_open] = useState(false);

  // ===========================
  // REFS FOR CLICK-OUTSIDE
  // ===========================
  const notifications_ref = useRef<HTMLDivElement>(null);
  const user_menu_ref = useRef<HTMLDivElement>(null);

  // ===========================
  // ROUTER HOOKS
  // ===========================
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active section from URL
  const active_section = location.pathname.split('/')[2] || '';

  // ===========================
  // ROLE-BASED CONFIGURATION
  // ===========================
  const user_role = current_user?.role || 'CUSTOMER';

  // Dashboard path based on role
  const dashboard_path = user_role === 'CUSTOMER' ? '/app/dashboard'
    : user_role === 'STAFF' ? '/staff/dashboard'
    : user_role === 'ADMIN' ? '/admin/dashboard'
    : '/';

  // Navigation links based on role
  const get_nav_links = () => {
    if (user_role === 'CUSTOMER') {
      return [
        { label: 'Dashboard', path: '/app/dashboard', icon: Home, section: '' },
        { label: 'Quotes', path: '/app/quotes', icon: FileText, section: 'quotes' },
        { label: 'Orders', path: '/app/orders', icon: ShoppingCart, section: 'orders' },
        { label: 'Bookings', path: '/app/bookings', icon: Calendar, section: 'bookings' },
      ];
    } else if (user_role === 'STAFF') {
      return [
        { label: 'Dashboard', path: '/staff/dashboard', icon: Home, section: '' },
        { label: 'Jobs', path: '/staff/jobs', icon: ClipboardList, section: 'jobs' },
        { label: 'Calendar', path: '/staff/calendar', icon: Calendar, section: 'calendar' },
      ];
    } else if (user_role === 'ADMIN') {
      const base_links = [
        { label: 'Dashboard', path: '/admin/dashboard', icon: Home, section: '' },
        { label: 'Services', path: '/admin/services', icon: Briefcase, section: 'services' },
        { label: 'Orders', path: '/admin/orders', icon: ShoppingCart, section: 'orders' },
        { label: 'Users', path: '/admin/users', icon: Users, section: 'users' },
        { label: 'Settings', path: '/admin/settings', icon: Settings, section: 'settings' },
      ];

      // Add Phase 2 links if feature flags enabled
      if (feature_b2b_enabled) {
        base_links.splice(3, 0, { label: 'B2B', path: '/admin/b2b', icon: Briefcase, section: 'b2b' });
      }
      if (feature_inventory_enabled) {
        base_links.splice(feature_b2b_enabled ? 4 : 3, 0, { label: 'Inventory', path: '/admin/inventory', icon: Package, section: 'inventory' });
      }
      if (feature_analytics_enabled) {
        base_links.push({ label: 'Analytics', path: '/admin/analytics', icon: BarChart3, section: 'analytics' });
      }

      return base_links;
    }

    return [];
  };

  const nav_links = get_nav_links();

  // Primary CTA based on role
  const get_primary_cta = () => {
    if (user_role === 'CUSTOMER') {
      return { label: 'New Quote', path: '/app/quotes/new' };
    } else if (user_role === 'STAFF') {
      return { label: 'View Jobs', path: '/staff/jobs' };
    } else if (user_role === 'ADMIN') {
      return { label: 'Manage Services', path: '/admin/services' };
    }
    return null;
  };

  const primary_cta = get_primary_cta();

  // Settings path based on role
  const settings_path = user_role === 'CUSTOMER' ? '/app/settings'
    : user_role === 'ADMIN' ? '/admin/settings'
    : null;

  // ===========================
  // HANDLERS
  // ===========================
  const toggle_notifications_dropdown = () => {
    set_notifications_dropdown_open(prev => !prev);
    set_user_menu_open(false); // Close user menu if open
  };

  const toggle_user_menu = () => {
    set_user_menu_open(prev => !prev);
    set_notifications_dropdown_open(false); // Close notifications if open
  };

  const toggle_mobile_nav = () => {
    set_mobile_nav_open(prev => !prev);
    // Lock/unlock body scroll
    if (!mobile_nav_open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  };

  const handle_logout = () => {
    logout_user();
    navigate('/');
  };

  const navigate_to_dashboard = () => {
    navigate(dashboard_path);
  };

  // ===========================
  // CLICK-OUTSIDE LISTENER
  // ===========================
  useEffect(() => {
    const handle_click_outside = (event: MouseEvent) => {
      if (notifications_ref.current && !notifications_ref.current.contains(event.target as Node)) {
        set_notifications_dropdown_open(false);
      }
      if (user_menu_ref.current && !user_menu_ref.current.contains(event.target as Node)) {
        set_user_menu_open(false);
      }
    };

    if (notifications_dropdown_open || user_menu_open) {
      document.addEventListener('mousedown', handle_click_outside);
    }

    return () => {
      document.removeEventListener('mousedown', handle_click_outside);
    };
  }, [notifications_dropdown_open, user_menu_open]);

  // Close mobile nav when route changes
  useEffect(() => {
    set_mobile_nav_open(false);
    document.body.style.overflow = '';
  }, [location.pathname]);

  // Close mobile nav on Escape key
  useEffect(() => {
    const handle_escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        set_mobile_nav_open(false);
        set_notifications_dropdown_open(false);
        set_user_menu_open(false);
        document.body.style.overflow = '';
      }
    };

    document.addEventListener('keydown', handle_escape);
    return () => document.removeEventListener('keydown', handle_escape);
  }, []);

  // ===========================
  // RENDER
  // ===========================
  return (
    <>
      {/* Main Header */}
      <header className="bg-white border-b-2 border-black sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            
            {/* Left: Mobile Menu + Logo */}
            <div className="flex items-center space-x-3">
              {/* Mobile Hamburger */}
              <button
                onClick={toggle_mobile_nav}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Toggle navigation menu"
                aria-expanded={mobile_nav_open}
                aria-controls="mobile-navigation-drawer"
              >
                {mobile_nav_open ? (
                  <X className="h-6 w-6 text-black" />
                ) : (
                  <Menu className="h-6 w-6 text-black" />
                )}
              </button>

              {/* Logo */}
              <button
                onClick={navigate_to_dashboard}
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
              >
                <img
                  src={sultanstampLogo}
                  alt="SultanStamp"
                  className="h-10 md:h-12 w-auto"
                />
              </button>
            </div>

            {/* Center: Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {nav_links.map((link) => {
                const Icon = link.icon;
                const is_active = link.section === '' 
                  ? location.pathname === link.path
                  : active_section === link.section;

                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      is_active
                        ? 'bg-yellow-400 text-black'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right: Notifications + User Menu + Primary CTA */}
            <div className="flex items-center space-x-2 md:space-x-4">
              
              {/* Primary CTA Button (Hidden on Mobile if space constrained) */}
              {primary_cta && (
                <Link
                  to={primary_cta.path}
                  className="hidden sm:block bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  {primary_cta.label}
                </Link>
              )}

              {/* Notification Bell */}
              <div className="relative" ref={notifications_ref}>
                <button
                  onClick={toggle_notifications_dropdown}
                  className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label={`Notifications, ${unread_count} unread`}
                  aria-expanded={notifications_dropdown_open}
                >
                  <Bell className="h-5 w-5 md:h-6 md:w-6 text-gray-700" />
                  {unread_count > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full min-w-[20px]">
                      {unread_count >= 10 ? '9+' : unread_count}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {notifications_dropdown_open && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-900">Notifications</p>
                    </div>
                    
                    {unread_count > 0 ? (
                      <div className="py-2">
                        <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                          <p className="text-sm text-gray-700">
                            You have {unread_count} unread notification{unread_count !== 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            View your dashboard for details
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center">
                        <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No new notifications</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="relative" ref={user_menu_ref}>
                <button
                  onClick={toggle_user_menu}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="User menu"
                  aria-expanded={user_menu_open}
                >
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-sm font-medium text-gray-900">
                      {current_user?.name || 'User'}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">
                      {user_role.toLowerCase()}
                    </span>
                  </div>
                  <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-yellow-400 flex items-center justify-center text-black font-semibold">
                    {current_user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>

                {/* User Dropdown Menu */}
                {user_menu_open && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    {/* User Info Header */}
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {current_user?.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {current_user?.email}
                      </p>
                    </div>

                    {/* Menu Links */}
                    <div className="py-1">
                      {settings_path && (
                        <Link
                          to={settings_path}
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => set_user_menu_open(false)}
                        >
                          <Settings className="h-4 w-4" />
                          <span>{user_role === 'CUSTOMER' ? 'My Account' : 'Settings'}</span>
                        </Link>
                      )}

                      <Link
                        to="/"
                        className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => set_user_menu_open(false)}
                      >
                        <Globe className="h-4 w-4" />
                        <span>View Public Site</span>
                      </Link>

                      <div className="border-t border-gray-200 my-1"></div>

                      <button
                        onClick={handle_logout}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <>
        {/* Overlay */}
        <div 
          className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 md:hidden ${
            mobile_nav_open ? 'bg-opacity-60 pointer-events-auto' : 'bg-opacity-0 pointer-events-none'
          }`}
          onClick={toggle_mobile_nav}
          aria-hidden="true"
        />

        {/* Drawer */}
        <div 
          id="mobile-navigation-drawer"
          className={`fixed inset-y-0 left-0 w-4/5 max-w-sm bg-white z-50 transform transition-transform duration-300 ease-out md:hidden shadow-2xl overflow-y-auto ${
            mobile_nav_open ? 'translate-x-0' : '-translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <img src={sultanstampLogo} alt="SultanStamp" className="h-8 w-auto" />
            <button
              onClick={toggle_mobile_nav}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close menu"
            >
              <X className="h-6 w-6 text-black" />
            </button>
          </div>

            {/* Drawer Navigation */}
            <nav className="flex flex-col p-4 space-y-2 pb-24">
              {nav_links.map((link) => {
                const Icon = link.icon;
                const is_active = link.section === '' 
                  ? location.pathname === link.path
                  : active_section === link.section;

                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[44px] ${
                      is_active
                        ? 'bg-yellow-400 text-black'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={toggle_mobile_nav}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              {/* Primary CTA in Mobile Menu */}
              {primary_cta && (
                <Link
                  to={primary_cta.path}
                  className="flex items-center justify-center bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-3 rounded-lg text-base font-semibold transition-colors mt-4 min-h-[44px]"
                  onClick={toggle_mobile_nav}
                >
                  {primary_cta.label}
                </Link>
              )}

              {/* Divider */}
              <div className="border-t border-gray-200 my-4"></div>

              {/* Settings Link */}
              {settings_path && (
                <Link
                  to={settings_path}
                  className="flex items-center space-x-3 px-4 py-3 rounded-lg text-base text-gray-700 hover:bg-gray-100 transition-colors min-h-[44px]"
                  onClick={toggle_mobile_nav}
                >
                  <Settings className="h-5 w-5" />
                  <span>{user_role === 'CUSTOMER' ? 'My Account' : 'Settings'}</span>
                </Link>
              )}

              {/* Public Site Link */}
              <Link
                to="/"
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-base text-gray-700 hover:bg-gray-100 transition-colors min-h-[44px]"
                onClick={toggle_mobile_nav}
              >
                <Globe className="h-5 w-5" />
                <span>View Public Site</span>
              </Link>

              {/* Logout */}
              <button
                onClick={() => {
                  toggle_mobile_nav();
                  handle_logout();
                }}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-base text-red-600 hover:bg-red-50 transition-colors text-left mt-2 min-h-[44px] w-full"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </button>
            </nav>

            {/* User Info Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-yellow-400 flex items-center justify-center text-black font-semibold flex-shrink-0">
                  {current_user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {current_user?.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {current_user?.email}
                  </p>
                </div>
              </div>
            </div>
          </div>
      </>
    </>
  );
};

export default GV_HeaderAuth;