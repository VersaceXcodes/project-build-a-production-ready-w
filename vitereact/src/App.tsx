import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/main';

// Layout components
import GV_HeaderPublic from '@/components/views/GV_HeaderPublic';
import GV_HeaderAuth from '@/components/views/GV_HeaderAuth';
import GV_Footer from '@/components/views/GV_Footer';

// Auth views
import UV_AUTH_Login from '@/components/views/UV_AUTH_Login';
import UV_AUTH_Register from '@/components/views/UV_AUTH_Register';
import UV_AUTH_ForgotPassword from '@/components/views/UV_AUTH_ForgotPassword';
import UV_AUTH_ResetPassword from '@/components/views/UV_AUTH_ResetPassword';

// Public views
import UV_PUB_Landing from '@/components/views/UV_PUB_Landing';
import UV_PUB_ServicesCatalog from '@/components/views/UV_PUB_ServicesCatalog';
import UV_PUB_ServiceDetail from '@/components/views/UV_PUB_ServiceDetail';
import UV_PUB_Pricing from '@/components/views/UV_PUB_Pricing';
import UV_PUB_Contact from '@/components/views/UV_PUB_Contact';
import UV_PUB_Gallery from '@/components/views/UV_PUB_Gallery';
import UV_PUB_About from '@/components/views/UV_PUB_About';
import UV_PUB_CaseStudy from '@/components/views/UV_PUB_CaseStudy';
import UV_PUB_Policies from '@/components/views/UV_PUB_Policies';
import UV_PUB_QuoteStart from '@/components/views/UV_PUB_QuoteStart';
import UV_PUB_GuestQuoteWizard from '@/components/views/UV_PUB_GuestQuoteWizard';
import UV_PUB_GuestQuoteConfirmation from '@/components/views/UV_PUB_GuestQuoteConfirmation';
import UV_PUB_GuestQuoteView from '@/components/views/UV_PUB_GuestQuoteView';

// Product views
import UV_PUB_ProductsCatalog from '@/components/views/UV_PUB_ProductsCatalog';
import UV_PUB_ProductDetail from '@/components/views/UV_PUB_ProductDetail';
import UV_PUB_Cart from '@/components/views/UV_PUB_Cart';
import UV_PUB_Checkout from '@/components/views/UV_PUB_Checkout';
import UV_PUB_OrderConfirmation from '@/components/views/UV_PUB_OrderConfirmation';

// Customer views
import UV_CUST_Dashboard from '@/components/views/UV_CUST_Dashboard';
import UV_CUST_QuotesList from '@/components/views/UV_CUST_QuotesList';
import UV_CUST_QuoteWizard from '@/components/views/UV_CUST_QuoteWizard';
import UV_CUST_QuoteDetail from '@/components/views/UV_CUST_QuoteDetail';
import UV_CUST_OrdersList from '@/components/views/UV_CUST_OrdersList';
import UV_CUST_OrderDetail from '@/components/views/UV_CUST_OrderDetail';
import UV_CUST_BookingsList from '@/components/views/UV_CUST_BookingsList';
import UV_CUST_BookingCalendar from '@/components/views/UV_CUST_BookingCalendar';
import UV_CUST_DepositPayment from '@/components/views/UV_CUST_DepositPayment';
import UV_CUST_AccountSettings from '@/components/views/UV_CUST_AccountSettings';

// Admin views
import UV_ADMIN_Dashboard from '@/components/views/UV_ADMIN_Dashboard';
import UV_ADMIN_UsersManager from '@/components/views/UV_ADMIN_UsersManager';
import UV_ADMIN_ServicesManager from '@/components/views/UV_ADMIN_ServicesManager';
import UV_ADMIN_ServiceEditor from '@/components/views/UV_ADMIN_ServiceEditor';
import UV_ADMIN_OrdersManager from '@/components/views/UV_ADMIN_OrdersManager';
import UV_ADMIN_OrderManagement from '@/components/views/UV_ADMIN_OrderManagement';
import UV_ADMIN_QuotesManager from '@/components/views/UV_ADMIN_QuotesManager';
import UV_ADMIN_QuoteFinalization from '@/components/views/UV_ADMIN_QuoteFinalization';
import UV_ADMIN_GalleryManager from '@/components/views/UV_ADMIN_GalleryManager';
import UV_ADMIN_TiersManager from '@/components/views/UV_ADMIN_TiersManager';
import UV_ADMIN_TierEditor from '@/components/views/UV_ADMIN_TierEditor';
import UV_ADMIN_ContentManager from '@/components/views/UV_ADMIN_ContentManager';
import UV_ADMIN_PricingRules from '@/components/views/UV_ADMIN_PricingRules';
import UV_ADMIN_CalendarSettings from '@/components/views/UV_ADMIN_CalendarSettings';
import UV_ADMIN_Settings from '@/components/views/UV_ADMIN_Settings';

// Admin Phase 2 views
import UV_P2_InventoryDashboard from '@/components/views/UV_P2_InventoryDashboard';
import UV_P2_PurchaseOrders from '@/components/views/UV_P2_PurchaseOrders';
import UV_P2_AnalyticsDashboard from '@/components/views/UV_P2_AnalyticsDashboard';
import UV_P2_ConsumptionRules from '@/components/views/UV_P2_ConsumptionRules';
import UV_P2_SLADashboard from '@/components/views/UV_P2_SLADashboard';
import UV_P2_B2BAccountsList from '@/components/views/UV_P2_B2BAccountsList';
import UV_P2_B2BAccountDetail from '@/components/views/UV_P2_B2BAccountDetail';

// Staff views
import UV_STAFF_Dashboard from '@/components/views/UV_STAFF_Dashboard';
import UV_STAFF_JobQueue from '@/components/views/UV_STAFF_JobQueue';
import UV_STAFF_JobDetail from '@/components/views/UV_STAFF_JobDetail';
import UV_STAFF_Calendar from '@/components/views/UV_STAFF_Calendar';

// Legacy dashboard (role-based redirect)
import UV_Dashboard from '@/components/views/UV_Dashboard';

// Protected Route wrapper component
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { authentication_state: { authentication_status, current_user } } = useAppStore();
  const location = useLocation();

  if (!authentication_status.is_authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && current_user && !allowedRoles.includes(current_user.role)) {
    // Redirect to appropriate dashboard based on role
    const roleDashboards: Record<string, string> = {
      ADMIN: '/admin/dashboard',
      STAFF: '/staff/dashboard',
      CUSTOMER: '/app/dashboard'
    };
    return <Navigate to={roleDashboards[current_user.role] || '/'} replace />;
  }

  return <>{children}</>;
};

// Public only route (redirect if authenticated)
interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

const PublicOnlyRoute: React.FC<PublicOnlyRouteProps> = ({ children }) => {
  const { authentication_state: { authentication_status, current_user } } = useAppStore();

  if (authentication_status.is_authenticated && current_user) {
    const roleDashboards: Record<string, string> = {
      ADMIN: '/admin/dashboard',
      STAFF: '/staff/dashboard',
      CUSTOMER: '/app/dashboard'
    };
    return <Navigate to={roleDashboards[current_user.role] || '/app/dashboard'} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const {
    authentication_state: { authentication_status },
    check_auth_status
  } = useAppStore();

  useEffect(() => {
    check_auth_status();
  }, [check_auth_status]);

  if (authentication_status.is_loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        {authentication_status.is_authenticated ? <GV_HeaderAuth /> : <GV_HeaderPublic />}

        <main className="flex-grow">
          <Routes>
            {/* ===== PUBLIC ROUTES ===== */}
            <Route path="/" element={<UV_PUB_Landing />} />
            <Route path="/services" element={<UV_PUB_ServicesCatalog />} />
            <Route path="/services/:slug" element={<UV_PUB_ServiceDetail />} />
            <Route path="/pricing" element={<UV_PUB_Pricing />} />
            <Route path="/contact" element={<UV_PUB_Contact />} />
            <Route path="/gallery" element={<UV_PUB_Gallery />} />
            <Route path="/about" element={<UV_PUB_About />} />
            <Route path="/case-study/:slug" element={<UV_PUB_CaseStudy />} />
            <Route path="/policies" element={<UV_PUB_Policies />} />
            
            {/* ===== PRODUCTS ROUTES (PUBLIC - E-commerce) ===== */}
            <Route path="/products" element={<UV_PUB_ProductsCatalog />} />
            <Route path="/products/:slug" element={<UV_PUB_ProductDetail />} />
            <Route path="/cart" element={<UV_PUB_Cart />} />
            <Route path="/checkout" element={<UV_PUB_Checkout />} />
            <Route path="/order-confirmation/:id" element={<UV_PUB_OrderConfirmation />} />

            {/* ===== QUOTE FLOW ROUTES (PUBLIC - No Auth Required) ===== */}
            <Route path="/quote/start" element={<UV_PUB_QuoteStart />} />
            <Route path="/quote/guest" element={<UV_PUB_GuestQuoteWizard />} />
            <Route path="/quote/guest/new" element={<UV_PUB_GuestQuoteWizard />} />
            <Route path="/quote/guest/confirmation/:quoteId" element={<UV_PUB_GuestQuoteConfirmation />} />
            <Route path="/quote/guest/view/:token" element={<UV_PUB_GuestQuoteView />} />
            <Route path="/quote/guest/:token" element={<UV_PUB_GuestQuoteView />} />

            {/* ===== AUTH ROUTES (redirect if authenticated) ===== */}
            <Route path="/login" element={
              <PublicOnlyRoute><UV_AUTH_Login /></PublicOnlyRoute>
            } />
            <Route path="/register" element={
              <PublicOnlyRoute><UV_AUTH_Register /></PublicOnlyRoute>
            } />
            <Route path="/forgot-password" element={
              <PublicOnlyRoute><UV_AUTH_ForgotPassword /></PublicOnlyRoute>
            } />
            <Route path="/reset-password" element={
              <PublicOnlyRoute><UV_AUTH_ResetPassword /></PublicOnlyRoute>
            } />

            {/* ===== CUSTOMER ROUTES ===== */}
            <Route path="/app/dashboard" element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}><UV_CUST_Dashboard /></ProtectedRoute>
            } />
            <Route path="/app/quotes" element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}><UV_CUST_QuotesList /></ProtectedRoute>
            } />
            <Route path="/app/quotes/new" element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}><UV_CUST_QuoteWizard /></ProtectedRoute>
            } />
            <Route path="/app/quotes/:id" element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}><UV_CUST_QuoteDetail /></ProtectedRoute>
            } />
            <Route path="/app/orders" element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}><UV_CUST_OrdersList /></ProtectedRoute>
            } />
            <Route path="/app/orders/:id" element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}><UV_CUST_OrderDetail /></ProtectedRoute>
            } />
            <Route path="/app/bookings" element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}><UV_CUST_BookingsList /></ProtectedRoute>
            } />
            <Route path="/app/bookings/calendar" element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}><UV_CUST_BookingCalendar /></ProtectedRoute>
            } />
            <Route path="/app/payment/:orderId" element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}><UV_CUST_DepositPayment /></ProtectedRoute>
            } />
            <Route path="/app/settings" element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}><UV_CUST_AccountSettings /></ProtectedRoute>
            } />

            {/* ===== ADMIN ROUTES ===== */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_Dashboard /></ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_UsersManager /></ProtectedRoute>
            } />
            <Route path="/admin/services" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_ServicesManager /></ProtectedRoute>
            } />
            <Route path="/admin/services/new" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_ServiceEditor /></ProtectedRoute>
            } />
            <Route path="/admin/services/:id" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_ServiceEditor /></ProtectedRoute>
            } />
            <Route path="/admin/orders" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_OrdersManager /></ProtectedRoute>
            } />
            <Route path="/admin/orders/:id" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_OrderManagement /></ProtectedRoute>
            } />
            <Route path="/admin/quotes" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_QuotesManager /></ProtectedRoute>
            } />
            <Route path="/admin/quotes/:quote_id" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_QuoteFinalization /></ProtectedRoute>
            } />
            <Route path="/admin/quotes/:quote_id/finalize" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_QuoteFinalization /></ProtectedRoute>
            } />
            <Route path="/admin/gallery" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_GalleryManager /></ProtectedRoute>
            } />
            <Route path="/admin/tiers" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_TiersManager /></ProtectedRoute>
            } />
            <Route path="/admin/tiers/new" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_TierEditor /></ProtectedRoute>
            } />
            <Route path="/admin/tiers/:tier_id" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_TierEditor /></ProtectedRoute>
            } />
            <Route path="/admin/content" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_ContentManager /></ProtectedRoute>
            } />
            <Route path="/admin/pricing" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_PricingRules /></ProtectedRoute>
            } />
            <Route path="/admin/calendar" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_CalendarSettings /></ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_ADMIN_Settings /></ProtectedRoute>
            } />

            {/* ===== ADMIN PHASE 2 ROUTES ===== */}
            <Route path="/admin/inventory" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_P2_InventoryDashboard /></ProtectedRoute>
            } />
            <Route path="/admin/procurement" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_P2_PurchaseOrders /></ProtectedRoute>
            } />
            <Route path="/admin/analytics" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_P2_AnalyticsDashboard /></ProtectedRoute>
            } />
            <Route path="/admin/consumption" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_P2_ConsumptionRules /></ProtectedRoute>
            } />
            <Route path="/admin/sla" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_P2_SLADashboard /></ProtectedRoute>
            } />
            <Route path="/admin/b2b" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_P2_B2BAccountsList /></ProtectedRoute>
            } />
            <Route path="/admin/b2b/:id" element={
              <ProtectedRoute allowedRoles={['ADMIN']}><UV_P2_B2BAccountDetail /></ProtectedRoute>
            } />

            {/* ===== STAFF ROUTES ===== */}
            <Route path="/staff/dashboard" element={
              <ProtectedRoute allowedRoles={['STAFF']}><UV_STAFF_Dashboard /></ProtectedRoute>
            } />
            <Route path="/staff/jobs" element={
              <ProtectedRoute allowedRoles={['STAFF']}><UV_STAFF_JobQueue /></ProtectedRoute>
            } />
            <Route path="/staff/jobs/:id" element={
              <ProtectedRoute allowedRoles={['STAFF']}><UV_STAFF_JobDetail /></ProtectedRoute>
            } />
            <Route path="/staff/calendar" element={
              <ProtectedRoute allowedRoles={['STAFF']}><UV_STAFF_Calendar /></ProtectedRoute>
            } />

            {/* ===== LEGACY DASHBOARD ROUTE (role-based redirect) ===== */}
            <Route path="/dashboard" element={
              <ProtectedRoute><UV_Dashboard /></ProtectedRoute>
            } />

            {/* ===== CATCH-ALL ROUTE ===== */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <GV_Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;
