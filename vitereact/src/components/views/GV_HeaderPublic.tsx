import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import sultanstampLogo from '@/assets/sultanstamp_logo.jpeg';

const GV_HeaderPublic: React.FC = () => {
  // ===========================
  // GLOBAL STATE ACCESS
  // ===========================
  // CRITICAL: Individual selectors, NO object destructuring
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isMobile = useAppStore(state => state.ui_state.is_mobile);
  const logoutUser = useAppStore(state => state.logout_user);
  const toggleMobileNav = useAppStore(state => state.toggle_mobile_nav);

  // ===========================
  // LOCAL STATE
  // ===========================
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ===========================
  // ROUTING HOOKS
  // ===========================
  const location = useLocation();
  const navigate = useNavigate();

  // ===========================
  // NAVIGATION LINKS
  // ===========================
  const navLinks = [
    { label: 'About Us', path: '/about' },
    { label: 'Gallery', path: '/gallery' },
    { label: 'Services', path: '/services' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Contact', path: '/contact' },
  ];

  // ===========================
  // ACTIVE PAGE DETECTION
  // ===========================
  const isActivePath = (path: string): boolean => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // ===========================
  // ACTIONS
  // ===========================
  const handleGetQuoteClick = () => {
    // Always route to quote start page - let user choose guest/login/register
    navigate('/quote/start');
  };

  const handleLoginRoleClick = (role: 'CUSTOMER' | 'STAFF' | 'ADMIN') => {
    navigate(`/login?role=${role}`);
    setLoginDropdownOpen(false);
  };

  const handleLogout = () => {
    logoutUser();
    setUserMenuOpen(false);
    navigate('/');
  };

  const getRoleDashboardPath = (role: string): string => {
    switch (role) {
      case 'CUSTOMER':
        return '/app';
      case 'STAFF':
        return '/staff';
      case 'ADMIN':
        return '/admin';
      default:
        return '/';
    }
  };

  const handleMobileMenuToggle = () => {
    setMobileNavOpen(prev => !prev);
    // Lock/unlock body scroll
    if (!mobileNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  };

  // ===========================
  // CLICK OUTSIDE HANDLER
  // ===========================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Close login dropdown if clicking outside
      if (loginDropdownOpen && !target.closest('.login-dropdown-container')) {
        setLoginDropdownOpen(false);
      }
      
      // Close user menu if clicking outside
      if (userMenuOpen && !target.closest('.user-menu-container')) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [loginDropdownOpen, userMenuOpen]);

  // ===========================
  // CLOSE MOBILE NAV ON ESCAPE
  // ===========================
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileNavOpen) {
        setMobileNavOpen(false);
        document.body.style.overflow = '';
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileNavOpen]);

  // ===========================
  // CLEANUP ON UNMOUNT
  // ===========================
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // ===========================
  // RENDER
  // ===========================
  return (
    <>
      <header className="bg-white border-b-2 border-black fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 md:h-20">
            
            {/* ===========================
                MOBILE: HAMBURGER MENU
                =========================== */}
            <button
              onClick={handleMobileMenuToggle}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-navigation-drawer"
            >
              {mobileNavOpen ? (
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* ===========================
                LOGO
                =========================== */}
            <Link
              to="/"
              className="flex items-center"
            >
              <img
                src={sultanstampLogo}
                alt="SultanStamp"
                className="h-10 md:h-12 w-auto"
              />
            </Link>

            {/* ===========================
                DESKTOP: NAVIGATION LINKS
                =========================== */}
            {!isMobile && (
              <nav className="hidden md:flex items-center space-x-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-4 py-2 text-base font-medium text-black hover:text-gray-700 transition-colors relative ${
                      isActivePath(link.path) ? 'border-b-3 border-yellow-500' : ''
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            {/* ===========================
                RIGHT SECTION: CTA + LOGIN
                =========================== */}
            <div className="flex items-center space-x-3">
              {/* Get a Quote Button */}
              <button
                onClick={handleGetQuoteClick}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-4 py-2 md:px-6 md:py-3 rounded-lg transition-all duration-200 text-sm md:text-base"
              >
                Get a Quote
              </button>

              {/* Login/User Menu */}
              {!isAuthenticated ? (
                // Login Dropdown (Not Authenticated)
                <div className="relative login-dropdown-container">
                  <button
                    onClick={() => setLoginDropdownOpen(!loginDropdownOpen)}
                    className="hidden md:flex items-center space-x-2 px-4 py-2 text-black hover:text-gray-700 font-medium transition-colors"
                  >
                    <span>Log In</span>
                    <svg 
                      className={`w-4 h-4 transition-transform duration-200 ${loginDropdownOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Login Dropdown Menu */}
                  {loginDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      <div className="py-1">
                        <button
                          onClick={() => handleLoginRoleClick('CUSTOMER')}
                          className="w-full text-left px-4 py-3 text-sm text-black hover:bg-gray-100 transition-colors font-medium"
                        >
                          Customer Login
                        </button>
                        <button
                          onClick={() => handleLoginRoleClick('STAFF')}
                          className="w-full text-left px-4 py-3 text-sm text-black hover:bg-gray-100 transition-colors font-medium"
                        >
                          Staff Login
                        </button>
                        <button
                          onClick={() => handleLoginRoleClick('ADMIN')}
                          className="w-full text-left px-4 py-3 text-sm text-black hover:bg-gray-100 transition-colors font-medium"
                        >
                          Admin Login
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // User Menu (Authenticated)
                <div className="relative user-menu-container">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="hidden md:flex items-center space-x-2 px-4 py-2 text-black hover:text-gray-700 font-medium transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-black font-bold text-sm">
                        {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <span className="text-sm">{currentUser?.name || 'User'}</span>
                    </div>
                    <svg 
                      className={`w-4 h-4 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* User Dropdown Menu */}
                  {userMenuOpen && currentUser && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-semibold text-black">{currentUser.name}</p>
                        <p className="text-xs text-gray-600">{currentUser.email}</p>
                        <p className="text-xs text-gray-500 mt-1 capitalize">{currentUser.role.toLowerCase()}</p>
                      </div>
                      <div className="py-1">
                        <Link
                          to={getRoleDashboardPath(currentUser.role)}
                          onClick={() => setUserMenuOpen(false)}
                          className="block px-4 py-3 text-sm text-black hover:bg-gray-100 transition-colors font-medium"
                        >
                          Dashboard
                        </Link>
                        {currentUser.role === 'CUSTOMER' && (
                          <Link
                            to="/app/settings"
                            onClick={() => setUserMenuOpen(false)}
                            className="block px-4 py-3 text-sm text-black hover:bg-gray-100 transition-colors font-medium"
                          >
                            Account Settings
                          </Link>
                        )}
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Spacer to prevent content from going under fixed header */}
      <div className="h-20" />

      {/* Mobile Navigation Drawer */}
      <>
        {/* Overlay */}
        <div 
          className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 md:hidden ${
            mobileNavOpen ? 'bg-opacity-60 pointer-events-auto' : 'bg-opacity-0 pointer-events-none'
          }`}
          onClick={handleMobileMenuToggle}
          aria-hidden="true"
        />

        {/* Drawer */}
        <div 
          id="mobile-navigation-drawer"
          className={`fixed inset-y-0 left-0 w-4/5 max-w-sm bg-white z-50 transform transition-transform duration-300 ease-out md:hidden shadow-2xl overflow-y-auto ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b-2 border-black sticky top-0 bg-white z-10">
            <img src={sultanstampLogo} alt="SultanStamp" className="h-8 w-auto" />
            <button
              onClick={handleMobileMenuToggle}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close menu"
            >
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Drawer Navigation */}
          <nav className="flex flex-col p-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[44px] ${
                  isActivePath(link.path)
                    ? 'bg-yellow-400 text-black'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={handleMobileMenuToggle}
              >
                {link.label}
              </Link>
            ))}

            {/* Divider */}
            <div className="border-t border-gray-200 my-4"></div>

            {/* Get Quote CTA */}
            <button
              onClick={() => {
                handleMobileMenuToggle();
                handleGetQuoteClick();
              }}
              className="flex items-center justify-center bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-3 rounded-lg text-base font-semibold transition-colors min-h-[44px]"
            >
              Get a Quote
            </button>

            {/* Login Section */}
            {!isAuthenticated ? (
              <div className="space-y-2 mt-4">
                <p className="text-sm font-semibold text-gray-500 px-4">Login</p>
                <button
                  onClick={() => {
                    handleMobileMenuToggle();
                    handleLoginRoleClick('CUSTOMER');
                  }}
                  className="w-full text-left px-4 py-3 text-base text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium min-h-[44px]"
                >
                  Customer Login
                </button>
                <button
                  onClick={() => {
                    handleMobileMenuToggle();
                    handleLoginRoleClick('STAFF');
                  }}
                  className="w-full text-left px-4 py-3 text-base text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium min-h-[44px]"
                >
                  Staff Login
                </button>
                <button
                  onClick={() => {
                    handleMobileMenuToggle();
                    handleLoginRoleClick('ADMIN');
                  }}
                  className="w-full text-left px-4 py-3 text-base text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium min-h-[44px]"
                >
                  Admin Login
                </button>
              </div>
            ) : (
              <div className="space-y-2 mt-4">
                <Link
                  to={getRoleDashboardPath(currentUser?.role || 'CUSTOMER')}
                  onClick={handleMobileMenuToggle}
                  className="flex items-center px-4 py-3 rounded-lg text-base text-gray-700 hover:bg-gray-100 transition-colors font-medium min-h-[44px]"
                >
                  Dashboard
                </Link>
                {currentUser?.role === 'CUSTOMER' && (
                  <Link
                    to="/app/settings"
                    onClick={handleMobileMenuToggle}
                    className="flex items-center px-4 py-3 rounded-lg text-base text-gray-700 hover:bg-gray-100 transition-colors font-medium min-h-[44px]"
                  >
                    Account Settings
                  </Link>
                )}
                <button
                  onClick={() => {
                    handleMobileMenuToggle();
                    handleLogout();
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg text-base text-red-600 hover:bg-red-50 transition-colors font-medium min-h-[44px]"
                >
                  Logout
                </button>
              </div>
            )}
          </nav>

          {/* User Info Footer (if authenticated) */}
          {isAuthenticated && currentUser && (
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                  {currentUser.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-black truncate">{currentUser.name}</p>
                  <p className="text-xs text-gray-600 truncate">{currentUser.email}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    </>
  );
};

export default GV_HeaderPublic;