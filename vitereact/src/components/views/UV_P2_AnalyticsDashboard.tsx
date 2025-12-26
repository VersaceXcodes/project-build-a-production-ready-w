import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Clock,
  AlertTriangle,
  Users,
  Download,
  Calendar,
  Filter,
} from 'lucide-react';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface ConversionFunnel {
  visited_site: number;
  started_quote: number;
  submitted_quote: number;
  quote_finalized: number;
  deposit_paid: number;
  order_completed: number;
}

interface RevenueMetrics {
  total_revenue: number;
  average_order_value: number;
  revenue_by_service: Array<{ service_name: string; revenue: number }>;
  revenue_by_tier: Array<{ tier_name: string; revenue: number }>;
}

interface TurnaroundPerformance {
  avg_turnaround_by_tier: Record<string, number>;
  on_time_percentage: number;
  delayed_percentage: number;
}

interface EmergencyBookings {
  total_count: number;
  total_revenue: number;
  percentage_of_total: number;
}

interface OutstandingPayments {
  total_deposits_pending: number;
  total_balance_due: number;
  aging_report: {
    '0-7': number;
    '8-14': number;
    '15-30': number;
    '30+': number;
  };
}

interface TopCustomer {
  customer_name: string;
  total_revenue: number;
  order_count: number;
  last_order_date: string;
}

interface AnalyticsDashboardData {
  conversion_funnel: ConversionFunnel;
  revenue_metrics: RevenueMetrics;
  turnaround_performance: TurnaroundPerformance;
  emergency_bookings: EmergencyBookings;
  outstanding_payments: OutstandingPayments;
  top_customers?: TopCustomer[];
}

type PeriodOption = 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_year';

// ===========================
// API FUNCTIONS
// ===========================

const fetchAnalyticsDashboard = async (
  period: PeriodOption,
  authToken: string
): Promise<AnalyticsDashboardData> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  const response = await axios.get(
    `${API_BASE_URL}/api/admin/analytics/dashboard`,
    {
      params: { period },
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );
  
  return response.data;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_P2_AnalyticsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // CRITICAL: Individual Zustand selectors (no object destructuring)
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isAnalyticsEnabled = useAppStore(state => state.feature_flags.feature_analytics_enabled);
  const showToast = useAppStore(state => state.show_toast);

  // Local state
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>(
    (searchParams.get('period') as PeriodOption) || 'last_30_days'
  );
  const [exportLoading, setExportLoading] = useState(false);

  // Authorization checks
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      navigate('/login?returnTo=/admin/analytics');
      return;
    }

    if (currentUser.role !== 'ADMIN') {
      navigate('/admin');
      showToast({
        type: 'error',
        message: 'Access denied. Admin privileges required.',
        duration: 5000,
      });
      return;
    }

    if (!isAnalyticsEnabled) {
      navigate('/admin');
      showToast({
        type: 'warning',
        message: 'Analytics feature is not enabled. Enable it in Settings.',
        duration: 5000,
      });
      return;
    }
  }, [isAuthenticated, currentUser, isAnalyticsEnabled, navigate, showToast]);

  // Fetch analytics data
  const {
    data: analyticsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['analytics', selectedPeriod],
    queryFn: () => fetchAnalyticsDashboard(selectedPeriod, authToken!),
    enabled: !!authToken && !!currentUser && currentUser.role === 'ADMIN' && isAnalyticsEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Update URL when period changes
  const handlePeriodChange = (period: PeriodOption) => {
    setSelectedPeriod(period);
    setSearchParams({ period });
  };

  // Export functionality
  const handleExportCSV = () => {
    if (!analyticsData) return;

    setExportLoading(true);

    try {
      // Generate CSV content
      let csvContent = 'SultanStamp Analytics Report\n';
      csvContent += `Period: ${selectedPeriod.replace('_', ' ')}\n`;
      csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;

      // Conversion Funnel
      csvContent += 'CONVERSION FUNNEL\n';
      csvContent += 'Stage,Count,Conversion Rate\n';
      const funnel = analyticsData.conversion_funnel;
      csvContent += `Visited Site,${funnel.visited_site},100%\n`;
      csvContent += `Started Quote,${funnel.started_quote},${((funnel.started_quote / funnel.visited_site) * 100).toFixed(1)}%\n`;
      csvContent += `Submitted Quote,${funnel.submitted_quote},${((funnel.submitted_quote / funnel.started_quote) * 100).toFixed(1)}%\n`;
      csvContent += `Quote Finalized,${funnel.quote_finalized},${((funnel.quote_finalized / funnel.submitted_quote) * 100).toFixed(1)}%\n`;
      csvContent += `Deposit Paid,${funnel.deposit_paid},${((funnel.deposit_paid / funnel.quote_finalized) * 100).toFixed(1)}%\n`;
      csvContent += `Order Completed,${funnel.order_completed},${((funnel.order_completed / funnel.deposit_paid) * 100).toFixed(1)}%\n\n`;

      // Revenue Metrics
      csvContent += 'REVENUE METRICS\n';
      csvContent += `Total Revenue,€${analyticsData.revenue_metrics.total_revenue.toFixed(2)}\n`;
      csvContent += `Average Order Value,€${analyticsData.revenue_metrics.average_order_value.toFixed(2)}\n\n`;

      csvContent += 'Revenue by Service\n';
      csvContent += 'Service,Revenue\n';
      analyticsData.revenue_metrics.revenue_by_service.forEach(item => {
        csvContent += `${item.service_name},€${item.revenue.toFixed(2)}\n`;
      });
      csvContent += '\n';

      csvContent += 'Revenue by Tier\n';
      csvContent += 'Tier,Revenue\n';
      analyticsData.revenue_metrics.revenue_by_tier.forEach(item => {
        csvContent += `${item.tier_name},€${item.revenue.toFixed(2)}\n`;
      });
      csvContent += '\n';

      // Outstanding Payments
      csvContent += 'OUTSTANDING PAYMENTS\n';
      csvContent += `Total Deposits Pending,€${analyticsData.outstanding_payments.total_deposits_pending.toFixed(2)}\n`;
      csvContent += `Total Balance Due,€${analyticsData.outstanding_payments.total_balance_due.toFixed(2)}\n`;
      csvContent += 'Aging Report\n';
      csvContent += `0-7 days,€${analyticsData.outstanding_payments.aging_report['0-7'].toFixed(2)}\n`;
      csvContent += `8-14 days,€${analyticsData.outstanding_payments.aging_report['8-14'].toFixed(2)}\n`;
      csvContent += `15-30 days,€${analyticsData.outstanding_payments.aging_report['15-30'].toFixed(2)}\n`;
      csvContent += `30+ days,€${analyticsData.outstanding_payments.aging_report['30+'].toFixed(2)}\n`;

      // Create downloadable file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `sultanstamp_analytics_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast({
        type: 'success',
        message: 'Analytics report exported successfully',
        duration: 3000,
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to export report. Please try again.',
        duration: 5000,
      });
    } finally {
      setExportLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  // Calculate conversion percentages
  const conversionPercentages = useMemo(() => {
    if (!analyticsData) return null;
    const funnel = analyticsData.conversion_funnel;
    return {
      started: (funnel.started_quote / funnel.visited_site) * 100,
      submitted: (funnel.submitted_quote / funnel.started_quote) * 100,
      finalized: (funnel.quote_finalized / funnel.submitted_quote) * 100,
      paid: (funnel.deposit_paid / funnel.quote_finalized) * 100,
      completed: (funnel.order_completed / funnel.deposit_paid) * 100,
    };
  }, [analyticsData]);

  // Chart colors
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  // Loading state
  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading analytics data...</p>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8">
              <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Analytics</h2>
              <p className="text-gray-600 mb-4">
                {error instanceof Error ? error.message : 'An error occurred while loading analytics data.'}
              </p>
              <button
                onClick={() => refetch()}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // No data state
  if (!analyticsData) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md">
            <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Analytics Data Available</h2>
            <p className="text-gray-600">
              No data found for the selected period. Try a different date range.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Business Analytics</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Comprehensive performance metrics and insights
                </p>
              </div>
              
              <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
                {/* Period Selector */}
                <div className="relative">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => handlePeriodChange(e.target.value as PeriodOption)}
                    className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="last_7_days">Last 7 Days</option>
                    <option value="last_30_days">Last 30 Days</option>
                    <option value="last_90_days">Last 90 Days</option>
                    <option value="this_year">This Year</option>
                  </select>
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>

                {/* Export Button */}
                <button
                  onClick={handleExportCSV}
                  disabled={exportLoading}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exportLoading ? 'Exporting...' : 'Export CSV'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Revenue Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Revenue */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(analyticsData.revenue_metrics.total_revenue)}
                  </p>
                </div>
                <div className="bg-blue-100 rounded-lg p-3">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Average Order Value */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(analyticsData.revenue_metrics.average_order_value)}
                  </p>
                </div>
                <div className="bg-green-100 rounded-lg p-3">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            {/* Emergency Bookings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Emergency Bookings</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analyticsData.emergency_bookings.total_count}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatCurrency(analyticsData.emergency_bookings.total_revenue)} revenue
                  </p>
                </div>
                <div className="bg-orange-100 rounded-lg p-3">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>

            {/* On-Time Delivery */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">On-Time Delivery</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatPercentage(analyticsData.turnaround_performance.on_time_percentage)}
                  </p>
                </div>
                <div className="bg-purple-100 rounded-lg p-3">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Conversion Funnel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Conversion Funnel</h2>
            <div className="space-y-4">
              {/* Visited Site */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Visited Site</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {analyticsData.conversion_funnel.visited_site.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-blue-600 h-3 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>

              {/* Started Quote */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Started Quote</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {conversionPercentages && formatPercentage(conversionPercentages.started)}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {analyticsData.conversion_funnel.started_quote.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: conversionPercentages 
                        ? `${conversionPercentages.started}%` 
                        : '0%'
                    }}
                  ></div>
                </div>
              </div>

              {/* Submitted Quote */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Submitted Quote</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {conversionPercentages && formatPercentage(conversionPercentages.submitted)}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {analyticsData.conversion_funnel.submitted_quote.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: conversionPercentages 
                        ? `${conversionPercentages.submitted}%` 
                        : '0%'
                    }}
                  ></div>
                </div>
              </div>

              {/* Quote Finalized */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Quote Finalized</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {conversionPercentages && formatPercentage(conversionPercentages.finalized)}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {analyticsData.conversion_funnel.quote_finalized.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: conversionPercentages 
                        ? `${conversionPercentages.finalized}%` 
                        : '0%'
                    }}
                  ></div>
                </div>
              </div>

              {/* Deposit Paid */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Deposit Paid</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {conversionPercentages && formatPercentage(conversionPercentages.paid)}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {analyticsData.conversion_funnel.deposit_paid.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: conversionPercentages 
                        ? `${conversionPercentages.paid}%` 
                        : '0%'
                    }}
                  ></div>
                </div>
              </div>

              {/* Order Completed */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Order Completed</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {conversionPercentages && formatPercentage(conversionPercentages.completed)}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {analyticsData.conversion_funnel.order_completed.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: conversionPercentages 
                        ? `${conversionPercentages.completed}%` 
                        : '0%'
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Revenue by Service (Pie Chart) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Service</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData.revenue_metrics.revenue_by_service}
                    dataKey="revenue"
                    nameKey="service_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.service_name}: ${formatCurrency(entry.revenue)}`}
                  >
                    {analyticsData.revenue_metrics.revenue_by_service.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue by Tier (Bar Chart) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Tier</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.revenue_metrics.revenue_by_tier}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="tier_name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Bar dataKey="revenue" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Outstanding Payments Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Outstanding Payments</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm font-medium text-orange-800">Total Deposits Pending</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {formatCurrency(analyticsData.outstanding_payments.total_deposits_pending)}
                </p>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800">Total Balance Due</p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {formatCurrency(analyticsData.outstanding_payments.total_balance_due)}
                </p>
              </div>
            </div>

            {/* Aging Report */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Aging Report</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-green-800">0-7 days</p>
                  <p className="text-lg font-bold text-green-900 mt-1">
                    {formatCurrency(analyticsData.outstanding_payments.aging_report['0-7'])}
                  </p>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-yellow-800">8-14 days</p>
                  <p className="text-lg font-bold text-yellow-900 mt-1">
                    {formatCurrency(analyticsData.outstanding_payments.aging_report['8-14'])}
                  </p>
                </div>
                
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-orange-800">15-30 days</p>
                  <p className="text-lg font-bold text-orange-900 mt-1">
                    {formatCurrency(analyticsData.outstanding_payments.aging_report['15-30'])}
                  </p>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-red-800">30+ days (Overdue)</p>
                  <p className="text-lg font-bold text-red-900 mt-1">
                    {formatCurrency(analyticsData.outstanding_payments.aging_report['30+'])}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Turnaround Performance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Turnaround Performance</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800">On-Time Delivery</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {formatPercentage(analyticsData.turnaround_performance.on_time_percentage)}
                </p>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800">Delayed Orders</p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {formatPercentage(analyticsData.turnaround_performance.delayed_percentage)}
                </p>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm font-medium text-purple-800">Avg Turnaround</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {Object.values(analyticsData.turnaround_performance.avg_turnaround_by_tier).reduce((a, b) => a + b, 0) / Object.values(analyticsData.turnaround_performance.avg_turnaround_by_tier).length || 0} days
                </p>
              </div>
            </div>

            {/* Average Turnaround by Tier */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Average Turnaround by Tier</h3>
              <div className="space-y-3">
                {Object.entries(analyticsData.turnaround_performance.avg_turnaround_by_tier).map(([tier, days]) => (
                  <div key={tier}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">{tier}</span>
                      <span className="text-sm font-semibold text-gray-900">{days} days</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((days / 14) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Customers (if B2B data available) */}
          {analyticsData.top_customers && analyticsData.top_customers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Top Customers</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Revenue
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order Count
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Order
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analyticsData.top_customers.map((customer, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {customer.customer_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                          {formatCurrency(customer.total_revenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {customer.order_count} orders
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(customer.last_order_date).toLocaleDateString('en-IE', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link
                to="/admin/analytics/sla"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Clock className="h-5 w-5" />
                View SLA Dashboard
              </Link>
              
              <Link
                to="/admin/orders?filter=payment-pending"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 hover:bg-orange-100 transition-colors"
              >
                <DollarSign className="h-5 w-5" />
                Review Payments
              </Link>
              
              <Link
                to="/admin/quotes?status=SUBMITTED"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors"
              >
                <Filter className="h-5 w-5" />
                Pending Quotes
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_P2_AnalyticsDashboard;