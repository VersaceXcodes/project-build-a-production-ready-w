import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { 
  X, 
  Home, 
  Info, 
  Image, 
  Layers, 
  DollarSign, 
  FileText, 
  Mail,
  LayoutDashboard,
  FileSearch,
  Package,
  Calendar,
  Briefcase,
  Users,
  Settings,
  Building2,
  Warehouse,
  BarChart3,
  LogOut,
  User
} from 'lucide-react';

const GV_MobileNav: React.FC = () => {
  const location = useLocation();
  
  // CRITICAL: Individual selectors to prevent infinite loops
  const mobileNavOpen = useAppStore(state => state.ui_state.mobile_nav_open);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const featureFlags = useAppStore(state => state.feature_flags);
  
  // Actions
  const toggleMobileNav = useAppStore(state => state.toggle_mobile_nav);
  const logoutUser = useAppStore(state => state.logout_user);

  // Close drawer when route changes
  useEffect(() => {
    if (mobileNavOpen) {
      toggleMobileNav();
    }
  }, [location.pathname]);

  // Handle logout
  const handleLogout = () => {
    logoutUser();
    toggleMobileNav();
  };

  // Handle link click - close drawer
  const handleLinkClick = () => {
    if (mobileNavOpen) {
      toggleMobileNav();
    }
  };

  // Handle overlay click
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && mobileNavOpen) {
      toggleMobileNav();
    }
  };

  // Check if route is active
  const isActiveRoute = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Public navigation links
  const publicLinks = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/about', label: 'About Us', icon: Info },
    { path: '/gallery', label: 'Gallery', icon: Image },
    { path: '/services', label: 'Services', icon: Layers },
    { path: '/pricing', label: 'Pricing', icon: DollarSign },
    { path: '/contact', label: 'Contact', icon: Mail },
  ];

  // Customer portal links
  const customerLinks = [
    { path: '/app', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/app/quotes', label: 'Quotes', icon: FileSearch },
    { path: '/app/orders', label: 'Orders', icon: Package },
    { path: '/app/bookings', label: 'Bookings', icon: Calendar },
  ];

  // Staff portal links
  const staffLinks = [
    { path: '/staff', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/staff/jobs', label: 'Jobs', icon: Briefcase },
    { path: '/staff/calendar', label: 'Calendar', icon: Calendar },
  ];

  // Admin portal links
  const adminLinks = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/services', label: 'Services', icon: Layers },
    { path: '/admin/orders', label: 'Orders', icon: Package },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  // Phase 2 admin links (feature flagged)
  const phase2AdminLinks = [
    ...(featureFlags.feature_b2b_enabled ? [{ path: '/admin/b2b', label: 'B2B Accounts', icon: Building2 }] : []),
    ...(featureFlags.feature_inventory_enabled ? [{ path: '/admin/inventory', label: 'Inventory', icon: Warehouse }] : []),
    ...(featureFlags.feature_analytics_enabled ? [{ path: '/admin/analytics', label: 'Analytics', icon: BarChart3 }] : []),
  ];

  // Determine navigation links based on auth and role
  const navigationLinks = !isAuthenticated
    ? publicLinks
    : currentUser?.role === 'CUSTOMER'
    ? customerLinks
    : currentUser?.role === 'STAFF'
    ? staffLinks
    : currentUser?.role === 'ADMIN'
    ? [...adminLinks, ...phase2AdminLinks]
    : publicLinks;

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!currentUser?.name) return 'U';
    const names = currentUser.name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return currentUser.name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-[1000] transition-opacity duration-300"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        className={`fixed top-0 left-0 h-full bg-white shadow-2xl z-[1001] transition-transform duration-300 ease-in-out ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '80%', maxWidth: '320px' }}
      >
        {/* Header Section - Sticky */}
        <div className="sticky top-0 bg-white border-b-2 border-black px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
              <span className="text-black font-bold text-sm">SS</span>
            </div>
            <span className="text-lg font-bold text-black">SultanStamp</span>
          </div>
          <button
            onClick={toggleMobileNav}
            aria-label="Close navigation"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6 text-black" />
          </button>
        </div>

        {/* Content Section - Scrollable */}
        <div className="flex flex-col h-[calc(100%-73px)] overflow-y-auto">
          {/* User Info Section (if authenticated) */}
          {isAuthenticated && currentUser && (
            <div className="px-6 py-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-base">
                    {getUserInitials()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-black truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-sm text-gray-600 truncate">
                    {currentUser.email}
                  </p>
                  {currentUser.role !== 'CUSTOMER' && (
                    <span className="inline-block mt-1 px-2 py-1 bg-black text-white text-xs font-semibold rounded-md">
                      {currentUser.role}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links Section */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {!isAuthenticated && (
              <div className="mb-4">
                <p className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Explore
                </p>
              </div>
            )}

            {isAuthenticated && (
              <div className="mb-4">
                <p className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {currentUser?.role === 'CUSTOMER' ? 'My Account' : currentUser?.role === 'STAFF' ? 'Staff Portal' : 'Admin Portal'}
                </p>
              </div>
            )}

            {navigationLinks.map((link) => {
              const Icon = link.icon;
              const isActive = isActiveRoute(link.path);
              
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={handleLinkClick}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-yellow-400 text-black font-semibold border-l-4 border-black'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-black' : 'text-gray-600'}`} />
                  <span className="text-base">{link.label}</span>
                </Link>
              );
            })}

            {/* Account Settings Link (if authenticated customer) */}
            {isAuthenticated && currentUser?.role === 'CUSTOMER' && (
              <Link
                to="/app/settings"
                onClick={handleLinkClick}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActiveRoute('/app/settings')
                    ? 'bg-yellow-400 text-black font-semibold border-l-4 border-black'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings className={`w-5 h-5 ${isActiveRoute('/app/settings') ? 'text-black' : 'text-gray-600'}`} />
                <span className="text-base">Settings</span>
              </Link>
            )}
          </nav>

          {/* CTA Section (bottom, sticky) */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 space-y-3">
            {/* Primary CTA */}
            {!isAuthenticated && (
              <Link
                to="/app/quotes/new"
                onClick={handleLinkClick}
                className="block w-full bg-yellow-400 text-black text-center font-semibold py-3 rounded-lg hover:bg-yellow-500 transition-colors"
              >
                Get a Quote
              </Link>
            )}

            {isAuthenticated && currentUser?.role === 'CUSTOMER' && (
              <Link
                to="/app/quotes/new"
                onClick={handleLinkClick}
                className="block w-full bg-yellow-400 text-black text-center font-semibold py-3 rounded-lg hover:bg-yellow-500 transition-colors"
              >
                New Quote
              </Link>
            )}

            {/* Auth Action */}
            {!isAuthenticated ? (
              <Link
                to="/login"
                onClick={handleLinkClick}
                className="block w-full bg-white text-black border-2 border-black text-center font-semibold py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Log In
              </Link>
            ) : (
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 bg-red-600 text-white font-semibold py-3 rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Log Out</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default GV_MobileNav;