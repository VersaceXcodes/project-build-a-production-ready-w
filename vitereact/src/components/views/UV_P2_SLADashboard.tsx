import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Order {
  id: string;
  quote_id: string;
  customer_id: string;
  tier_id: string;
  status: string;
  due_at: string | null;
  total_subtotal: number;
  tax_amount: number;
  total_amount: number;
  deposit_pct: number;
  deposit_amount: number;
  revision_count: number;
  assigned_staff_id: string | null;
  location_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AtRiskJob {
  order: Order;
  customer_name?: string;
  service_name?: string;
  tier_name?: string;
  hours_remaining: number;
}

interface BreachedJob {
  order: Order;
  customer_name?: string;
  service_name?: string;
  tier_name?: string;
  days_overdue: number;
}

interface SLAPerformance {
  meeting_sla_percentage: number;
  breached_sla_percentage: number;
  avg_completion_time: Record<string, number>;
}

interface SLAData {
  sla_performance: SLAPerformance;
  at_risk_jobs: AtRiskJob[];
  breached_jobs: BreachedJob[];
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchSLAData = async (authToken: string): Promise<SLAData> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const response = await axios.get<SLAData>(
    `${API_BASE_URL}/api/admin/analytics/sla`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    }
  );
  return response.data;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_P2_SLADashboard: React.FC = () => {
  // ===========================
  // ZUSTAND STATE (Individual selectors)
  // ===========================
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);

  // ===========================
  // LOCAL STATE
  // ===========================
  const [selectedTab, setSelectedTab] = useState<'overview' | 'at-risk' | 'breached'>('overview');
  const [atRiskSort, setAtRiskSort] = useState<'time_remaining' | 'tier'>('time_remaining');
  const [breachedSort, setBreachedSort] = useState<'days_overdue' | 'tier'>('days_overdue');

  // ===========================
  // REACT QUERY
  // ===========================
  const {
    data: slaData,
    isLoading,
    error,
    refetch
  } = useQuery<SLAData, Error>({
    queryKey: ['sla-dashboard'],
    queryFn: () => fetchSLAData(authToken!),
    enabled: !!authToken,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
    retry: 1,
    select: (data) => ({
      sla_performance: {
        meeting_sla_percentage: Number(data.sla_performance.meeting_sla_percentage || 0),
        breached_sla_percentage: Number(data.sla_performance.breached_sla_percentage || 0),
        avg_completion_time: data.sla_performance.avg_completion_time || {}
      },
      at_risk_jobs: (data.at_risk_jobs || []).map(job => ({
        ...job,
        hours_remaining: Number(job.hours_remaining || 0),
        order: {
          ...job.order,
          total_subtotal: Number(job.order.total_subtotal || 0),
          tax_amount: Number(job.order.tax_amount || 0),
          total_amount: Number(job.order.total_amount || 0),
          deposit_pct: Number(job.order.deposit_pct || 0),
          deposit_amount: Number(job.order.deposit_amount || 0),
          revision_count: Number(job.order.revision_count || 0)
        }
      })),
      breached_jobs: (data.breached_jobs || []).map(job => ({
        ...job,
        days_overdue: Number(job.days_overdue || 0),
        order: {
          ...job.order,
          total_subtotal: Number(job.order.total_subtotal || 0),
          tax_amount: Number(job.order.tax_amount || 0),
          total_amount: Number(job.order.total_amount || 0),
          deposit_pct: Number(job.order.deposit_pct || 0),
          deposit_amount: Number(job.order.deposit_amount || 0),
          revision_count: Number(job.order.revision_count || 0)
        }
      }))
    })
  });

  // ===========================
  // DERIVED STATE
  // ===========================
  const sortedAtRiskJobs = React.useMemo(() => {
    if (!slaData?.at_risk_jobs) return [];
    
    const jobs = [...slaData.at_risk_jobs];
    if (atRiskSort === 'time_remaining') {
      return jobs.sort((a, b) => a.hours_remaining - b.hours_remaining);
    } else {
      return jobs.sort((a, b) => {
        const tierA = a.tier_name || '';
        const tierB = b.tier_name || '';
        return tierA.localeCompare(tierB);
      });
    }
  }, [slaData?.at_risk_jobs, atRiskSort]);

  const sortedBreachedJobs = React.useMemo(() => {
    if (!slaData?.breached_jobs) return [];
    
    const jobs = [...slaData.breached_jobs];
    if (breachedSort === 'days_overdue') {
      return jobs.sort((a, b) => b.days_overdue - a.days_overdue);
    } else {
      return jobs.sort((a, b) => {
        const tierA = a.tier_name || '';
        const tierB = b.tier_name || '';
        return tierA.localeCompare(tierB);
      });
    }
  }, [slaData?.breached_jobs, breachedSort]);

  // ===========================
  // HELPER FUNCTIONS
  // ===========================
  const getTierBadgeColor = (tierName: string | undefined): string => {
    if (!tierName) return 'bg-gray-100 text-gray-800';
    
    const lowerTier = tierName.toLowerCase();
    if (lowerTier.includes('enterprise')) return 'bg-purple-100 text-purple-800';
    if (lowerTier.includes('gold') || lowerTier.includes('premium')) return 'bg-yellow-100 text-yellow-800';
    if (lowerTier.includes('standard')) return 'bg-blue-100 text-blue-800';
    if (lowerTier.includes('basic')) return 'bg-gray-100 text-gray-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'IN_PRODUCTION':
        return 'bg-blue-100 text-blue-800';
      case 'AWAITING_APPROVAL':
        return 'bg-orange-100 text-orange-800';
      case 'READY_FOR_PICKUP':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimeRemaining = (hours: number): string => {
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes} min`;
    }
    return `${hours.toFixed(1)} hrs`;
  };

  const formatDaysOverdue = (days: number): string => {
    if (days === 0) return 'Due today';
    if (days === 1) return '1 day overdue';
    return `${days} days overdue`;
  };

  // ===========================
  // RENDER
  // ===========================
  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b-2 border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <nav className="text-sm mb-2">
                  <ol className="flex items-center space-x-2">
                    <li>
                      <Link to="/admin" className="text-blue-600 hover:text-blue-800">
                        Admin
                      </Link>
                    </li>
                    <li className="text-gray-400">/</li>
                    <li>
                      <Link to="/admin/analytics" className="text-blue-600 hover:text-blue-800">
                        Analytics
                      </Link>
                    </li>
                    <li className="text-gray-400">/</li>
                    <li className="text-gray-900 font-medium">SLA Dashboard</li>
                  </ol>
                </nav>
                <h1 className="text-3xl font-bold text-gray-900">SLA Performance & Risk Management</h1>
              </div>
              
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Error State */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Error Loading SLA Data</h3>
                  <p className="mt-1 text-sm text-red-700">{error.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-600">Loading SLA performance data...</p>
              </div>
            </div>
          )}

          {/* Content */}
          {!isLoading && !error && slaData && (
            <>
              {/* Performance Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Total Orders */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Total Orders</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {(sortedAtRiskJobs.length || 0) + (sortedBreachedJobs.length || 0)}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Meeting SLA */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Meeting SLA</p>
                      <p className="text-3xl font-bold text-green-600">
                        {slaData.sla_performance.meeting_sla_percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-lg">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Breached SLA */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Breached SLA</p>
                      <p className="text-3xl font-bold text-red-600">
                        {slaData.sla_performance.breached_sla_percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-3 bg-red-100 rounded-lg">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-6">
                <div className="border-b border-gray-200">
                  <nav className="flex space-x-8 px-6" aria-label="Tabs">
                    <button
                      onClick={() => setSelectedTab('overview')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        selectedTab === 'overview'
                          ? 'border-yellow-500 text-yellow-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setSelectedTab('at-risk')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center ${
                        selectedTab === 'at-risk'
                          ? 'border-yellow-500 text-yellow-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      At-Risk Jobs
                      {sortedAtRiskJobs.length > 0 && (
                        <span className="ml-2 bg-orange-100 text-orange-800 py-0.5 px-2 rounded-full text-xs font-semibold">
                          {sortedAtRiskJobs.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setSelectedTab('breached')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center ${
                        selectedTab === 'breached'
                          ? 'border-yellow-500 text-yellow-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Breached SLA
                      {sortedBreachedJobs.length > 0 && (
                        <span className="ml-2 bg-red-100 text-red-800 py-0.5 px-2 rounded-full text-xs font-semibold">
                          {sortedBreachedJobs.length}
                        </span>
                      )}
                    </button>
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {/* Overview Tab */}
                  {selectedTab === 'overview' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Average Completion Time by Tier</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {Object.entries(slaData.sla_performance.avg_completion_time).map(([tier, hours]) => (
                            <div key={tier} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <p className="text-sm font-medium text-gray-600 mb-2">{tier}</p>
                              <p className="text-2xl font-bold text-gray-900">
                                {Number(hours || 0).toFixed(1)} hrs
                              </p>
                            </div>
                          ))}
                          
                          {Object.keys(slaData.sla_performance.avg_completion_time).length === 0 && (
                            <div className="col-span-full text-center py-8 text-gray-500">
                              No completion time data available
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick Summary */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-blue-900 mb-4">Summary</h3>
                        <div className="space-y-2 text-sm text-blue-800">
                          <p>• <strong>{sortedAtRiskJobs.length}</strong> jobs at risk (due in &lt;4 hours)</p>
                          <p>• <strong>{sortedBreachedJobs.length}</strong> jobs with breached SLA</p>
                          <p>• <strong>{slaData.sla_performance.meeting_sla_percentage.toFixed(1)}%</strong> of orders meeting SLA commitments</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* At-Risk Jobs Tab */}
                  {selectedTab === 'at-risk' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">
                          Jobs At Risk (Due in &lt;4 Hours)
                        </h2>
                        
                        <div className="flex items-center space-x-2">
                          <label htmlFor="at-risk-sort" className="text-sm text-gray-600">Sort by:</label>
                          <select
                            id="at-risk-sort"
                            value={atRiskSort}
                            onChange={(e) => setAtRiskSort(e.target.value as 'time_remaining' | 'tier')}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="time_remaining">Time Remaining</option>
                            <option value="tier">Tier</option>
                          </select>
                        </div>
                      </div>

                      {sortedAtRiskJobs.length === 0 ? (
                        <div className="text-center py-12 bg-green-50 rounded-lg border border-green-200">
                          <svg className="w-12 h-12 text-green-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h3 className="text-lg font-semibold text-green-900 mb-2">No Jobs At Risk</h3>
                          <p className="text-green-700">All jobs are on track to meet their SLA commitments.</p>
                        </div>
                      ) : (
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Order ID
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Customer
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Service
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tier
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Time Remaining
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {sortedAtRiskJobs.map((job) => (
                                  <tr key={job.order.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <p className="text-sm font-medium text-gray-900">
                                        #{job.order.id.substring(0, 8).toUpperCase()}
                                      </p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <p className="text-sm text-gray-900">{job.customer_name || 'N/A'}</p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <p className="text-sm text-gray-900">{job.service_name || 'N/A'}</p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTierBadgeColor(job.tier_name)}`}>
                                        {job.tier_name || 'N/A'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <svg className="w-4 h-4 text-orange-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm font-semibold text-orange-600">
                                          {formatTimeRemaining(job.hours_remaining)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(job.order.status)}`}>
                                        {job.order.status.replace(/_/g, ' ')}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <Link
                                        to={`/admin/orders/${job.order.id}`}
                                        className="text-blue-600 hover:text-blue-900 font-medium"
                                      >
                                        View Job
                                      </Link>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Breached Jobs Tab */}
                  {selectedTab === 'breached' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">
                          SLA Breaches (Overdue)
                        </h2>
                        
                        <div className="flex items-center space-x-2">
                          <label htmlFor="breached-sort" className="text-sm text-gray-600">Sort by:</label>
                          <select
                            id="breached-sort"
                            value={breachedSort}
                            onChange={(e) => setBreachedSort(e.target.value as 'days_overdue' | 'tier')}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="days_overdue">Days Overdue</option>
                            <option value="tier">Tier</option>
                          </select>
                        </div>
                      </div>

                      {sortedBreachedJobs.length === 0 ? (
                        <div className="text-center py-12 bg-green-50 rounded-lg border border-green-200">
                          <svg className="w-12 h-12 text-green-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h3 className="text-lg font-semibold text-green-900 mb-2">No Breached SLAs</h3>
                          <p className="text-green-700">All orders are being completed within their SLA commitments.</p>
                        </div>
                      ) : (
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Order ID
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Customer
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Service
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tier
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Days Overdue
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Due Date
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {sortedBreachedJobs.map((job) => (
                                  <tr key={job.order.id} className="hover:bg-red-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <p className="text-sm font-medium text-gray-900">
                                        #{job.order.id.substring(0, 8).toUpperCase()}
                                      </p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <p className="text-sm text-gray-900">{job.customer_name || 'N/A'}</p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <p className="text-sm text-gray-900">{job.service_name || 'N/A'}</p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTierBadgeColor(job.tier_name)}`}>
                                        {job.tier_name || 'N/A'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <svg className="w-4 h-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm font-semibold text-red-600">
                                          {formatDaysOverdue(job.days_overdue)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <p className="text-sm text-gray-900">
                                        {job.order.due_at 
                                          ? new Date(job.order.due_at).toLocaleDateString('en-US', { 
                                              month: 'short', 
                                              day: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })
                                          : 'N/A'
                                        }
                                      </p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(job.order.status)}`}>
                                        {job.order.status.replace(/_/g, ' ')}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <Link
                                        to={`/admin/orders/${job.order.id}`}
                                        className="text-blue-600 hover:text-blue-900 font-medium"
                                      >
                                        View Job
                                      </Link>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Empty State - No Data */}
          {!isLoading && !error && !slaData && (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No SLA Data Available</h3>
              <p className="text-gray-600">There is no SLA performance data to display at this time.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_P2_SLADashboard;