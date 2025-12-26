import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const GV_MobileTabBar: React.FC = () => {
  const location = useLocation();
  const unreadCount = useAppStore(state => state.notification_state.unread_count);

  // Determine active tab from current route
  const getActiveTab = (pathname: string): string => {
    if (pathname === '/app') return 'home';
    if (pathname.startsWith('/app/orders')) return 'orders';
    if (pathname.startsWith('/app/quotes')) return 'quotes';
    if (pathname.startsWith('/app/bookings')) return 'bookings';
    if (pathname.startsWith('/app/settings')) return 'more';
    return 'home';
  };

  const activeTab = getActiveTab(location.pathname);

  // Tab configuration
  const tabs = [
    {
      id: 'home',
      label: 'Home',
      path: '/app',
      icon: (isActive: boolean) => (
        <svg 
          className={`w-6 h-6 ${isActive ? 'text-yellow-400' : 'text-gray-600'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
          />
        </svg>
      ),
      badgeCount: 0,
    },
    {
      id: 'orders',
      label: 'Orders',
      path: '/app/orders',
      icon: (isActive: boolean) => (
        <svg 
          className={`w-6 h-6 ${isActive ? 'text-yellow-400' : 'text-gray-600'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" 
          />
        </svg>
      ),
      badgeCount: 0,
    },
    {
      id: 'quotes',
      label: 'Quotes',
      path: '/app/quotes',
      icon: (isActive: boolean) => (
        <svg 
          className={`w-6 h-6 ${isActive ? 'text-yellow-400' : 'text-gray-600'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
          />
        </svg>
      ),
      badgeCount: 0,
    },
    {
      id: 'bookings',
      label: 'Messages',
      path: '/app/bookings',
      icon: (isActive: boolean) => (
        <svg 
          className={`w-6 h-6 ${isActive ? 'text-yellow-400' : 'text-gray-600'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
          />
        </svg>
      ),
      badgeCount: unreadCount,
    },
    {
      id: 'more',
      label: 'More',
      path: '/app/settings',
      icon: (isActive: boolean) => (
        <svg 
          className={`w-6 h-6 ${isActive ? 'text-yellow-400' : 'text-gray-600'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 6h16M4 12h16M4 18h16" 
          />
        </svg>
      ),
      badgeCount: 0,
    },
  ];

  return (
    <>
      {/* Mobile Bottom Tab Bar - Only visible on mobile devices */}
      <nav 
        className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 md:hidden z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        role="navigation"
        aria-label="Mobile bottom navigation"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const hasBadge = tab.badgeCount > 0;
            
            return (
              <Link
                key={tab.id}
                to={tab.path}
                className={`
                  flex flex-col items-center justify-center
                  flex-1 h-full
                  transition-all duration-200
                  ${isActive ? 'transform scale-110' : 'transform scale-100'}
                  focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-inset
                  rounded-md
                  relative
                `}
                aria-label={`${tab.label}${hasBadge ? `, ${tab.badgeCount} unread` : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Icon Container */}
                <div className="relative">
                  {tab.icon(isActive)}
                  
                  {/* Notification Badge */}
                  {hasBadge && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {tab.badgeCount >= 10 ? '9+' : tab.badgeCount}
                    </span>
                  )}
                </div>
                
                {/* Label */}
                <span 
                  className={`
                    text-xs font-medium mt-1
                    ${isActive ? 'text-yellow-400' : 'text-gray-600'}
                  `}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default GV_MobileTabBar;