import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS (matching Zod schemas)
// ===========================

interface PurchaseOrder {
  id: string;
  supplier_name: string;
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  ordered_at: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string;
  qty: number;
  unit_cost: number;
  created_at: string;
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  qty_on_hand: number;
  reorder_point: number;
  reorder_qty: number;
  supplier_name: string | null;
  cost_per_unit: number;
  is_active: boolean;
}

interface POWithDetails extends PurchaseOrder {
  items_count: number;
  total_cost: number;
}

interface POListResponse {
  purchase_order: PurchaseOrder;
  items: PurchaseOrderItem[];
}

interface CreatePOPayload {
  supplier_name: string;
  notes: string | null;
}

interface UpdatePOPayload {
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  received_at?: string | null;
  ordered_at?: string | null;
}

interface POFormItem {
  inventory_item_id: string;
  qty: number;
  unit_cost: number;
}

// ===========================
// MAIN COMPONENT
// ===========================

const UV_P2_PurchaseOrders: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Global state access (individual selectors)
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const isInventoryEnabled = useAppStore(state => state.feature_flags.feature_inventory_enabled);
  const showToast = useAppStore(state => state.show_toast);

  // Local state
  const [statusFilter, setStatusFilter] = useState<string | null>(searchParams.get('status'));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [poFormData, setPOFormData] = useState<{
    supplier_name: string;
    items: POFormItem[];
    notes: string;
  }>({
    supplier_name: '',
    items: [],
    notes: ''
  });
  const [formErrors, setFormErrors] = useState<{ supplier_name?: string; items?: string }>({});

  // Check feature flag
  useEffect(() => {
    if (!isInventoryEnabled) {
      showToast({
        type: 'error',
        message: 'Inventory features are not enabled. Enable in Settings.',
        duration: 5000
      });
      navigate('/admin');
    }
  }, [isInventoryEnabled, navigate, showToast]);

  // Sync status filter with URL
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus !== statusFilter) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams]);

  // API Base URL
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // ===========================
  // API FUNCTIONS
  // ===========================

  const fetchPurchaseOrders = async (): Promise<POWithDetails[]> => {
    const params: any = {};
    if (statusFilter) {
      params.status = statusFilter;
    }

    const response = await axios.get<POListResponse[]>(
      `${API_BASE_URL}/api/admin/purchase-orders`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params
      }
    );

    // Transform response to include aggregated data
    return response.data.map((po) => ({
      id: po.purchase_order.id,
      supplier_name: po.purchase_order.supplier_name,
      status: po.purchase_order.status,
      ordered_at: po.purchase_order.ordered_at,
      received_at: po.purchase_order.received_at,
      notes: po.purchase_order.notes,
      created_at: po.purchase_order.created_at,
      updated_at: po.purchase_order.updated_at,
      items_count: po.items.length,
      total_cost: po.items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unit_cost)), 0)
    }));
  };

  const fetchInventoryItems = async (): Promise<InventoryItem[]> => {
    const response = await axios.get<InventoryItem[]>(
      `${API_BASE_URL}/api/admin/inventory-items`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { is_active: true, low_stock: true }
      }
    );
    return response.data;
  };

  const fetchPODetails = async (poId: string): Promise<{ po: PurchaseOrder; items: (PurchaseOrderItem & { item_name: string; sku: string })[] }> => {
    // Fetch PO and its items
    const response = await axios.get<POListResponse[]>(
      `${API_BASE_URL}/api/admin/purchase-orders`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const poData = response.data.find(p => p.purchase_order.id === poId);
    if (!poData) throw new Error('Purchase order not found');

    // Fetch inventory items to get names
    const inventoryResponse = await axios.get<InventoryItem[]>(
      `${API_BASE_URL}/api/admin/inventory-items`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const itemsWithDetails = poData.items.map(item => {
      const inventoryItem = inventoryResponse.data.find(inv => inv.id === item.inventory_item_id);
      return {
        ...item,
        item_name: inventoryItem?.name || 'Unknown Item',
        sku: inventoryItem?.sku || 'N/A'
      };
    });

    return {
      po: poData.purchase_order,
      items: itemsWithDetails
    };
  };

  // ===========================
  // QUERIES
  // ===========================

  const {
    data: purchaseOrders = [],
    isLoading: isLoadingPOs,
    error: posError,
    refetch: refetchPOs
  } = useQuery({
    queryKey: ['purchase-orders', statusFilter],
    queryFn: fetchPurchaseOrders,
    enabled: !!authToken && isInventoryEnabled,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false
  });

  const {
    data: inventoryItems = [],
    isLoading: isLoadingInventory
  } = useQuery({
    queryKey: ['inventory-items-for-po'],
    queryFn: fetchInventoryItems,
    enabled: showCreateModal && !!authToken,
    staleTime: 300000 // 5 minutes
  });

  const {
    data: selectedPODetails,
    isLoading: isLoadingPODetails
  } = useQuery({
    queryKey: ['purchase-order-detail', selectedPOId],
    queryFn: () => fetchPODetails(selectedPOId!),
    enabled: !!selectedPOId && showDetailModal && !!authToken
  });

  // ===========================
  // MUTATIONS
  // ===========================

  const createPOMutation = useMutation({
    mutationFn: async (data: CreatePOPayload) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/admin/purchase-orders`,
        data,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      showToast({
        type: 'success',
        message: 'Purchase order created successfully',
        duration: 5000
      });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to create purchase order',
        duration: 5000
      });
    }
  });

  const updatePOStatusMutation = useMutation({
    mutationFn: async ({ poId, payload }: { poId: string; payload: UpdatePOPayload }) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/purchase-orders/${poId}`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      showToast({
        type: 'success',
        message: 'Purchase order status updated successfully',
        duration: 5000
      });
      setShowDetailModal(false);
      setSelectedPOId(null);
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update purchase order',
        duration: 5000
      });
    }
  });

  // ===========================
  // HANDLER FUNCTIONS
  // ===========================

  const handleFilterChange = (newStatus: string | null) => {
    setStatusFilter(newStatus);
    
    // Update URL params
    if (newStatus) {
      setSearchParams({ status: newStatus });
    } else {
      setSearchParams({});
    }
  };

  const resetForm = () => {
    setPOFormData({
      supplier_name: '',
      items: [],
      notes: ''
    });
    setFormErrors({});
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

  const handleAddItemToForm = (inventoryItemId: string) => {
    const item = inventoryItems.find(i => i.id === inventoryItemId);
    if (!item) return;

    // Check if item already added
    if (poFormData.items.some(i => i.inventory_item_id === inventoryItemId)) {
      showToast({
        type: 'warning',
        message: 'Item already added to purchase order',
        duration: 3000
      });
      return;
    }

    setPOFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          inventory_item_id: inventoryItemId,
          qty: item.reorder_qty || 1,
          unit_cost: item.cost_per_unit || 0
        }
      ]
    }));
  };

  const handleUpdateItem = (index: number, field: 'qty' | 'unit_cost', value: number) => {
    setPOFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleRemoveItem = (index: number) => {
    setPOFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const validateForm = (): boolean => {
    const errors: { supplier_name?: string; items?: string } = {};

    if (!poFormData.supplier_name.trim()) {
      errors.supplier_name = 'Supplier name is required';
    }

    if (poFormData.items.length === 0) {
      errors.items = 'At least one item is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreatePO = () => {
    if (!validateForm()) return;

    createPOMutation.mutate({
      supplier_name: poFormData.supplier_name.trim(),
      notes: poFormData.notes.trim() || null
    });
  };

  const handleViewDetails = (poId: string) => {
    setSelectedPOId(poId);
    setShowDetailModal(true);
  };

  const handleMarkOrdered = (poId: string) => {
    updatePOStatusMutation.mutate({
      poId,
      payload: {
        status: 'ORDERED',
        ordered_at: new Date().toISOString()
      }
    });
  };

  const handleReceivePO = (poId: string) => {
    updatePOStatusMutation.mutate({
      poId,
      payload: {
        status: 'RECEIVED',
        received_at: new Date().toISOString()
      }
    });
  };

  const handleCancelPO = (poId: string) => {
    updatePOStatusMutation.mutate({
      poId,
      payload: {
        status: 'CANCELLED'
      }
    });
  };

  // ===========================
  // COMPUTED VALUES
  // ===========================

  const summaryStats = {
    total_pos: purchaseOrders.length,
    draft_count: purchaseOrders.filter(po => po.status === 'DRAFT').length,
    ordered_count: purchaseOrders.filter(po => po.status === 'ORDERED').length,
    total_pending_value: purchaseOrders
      .filter(po => po.status === 'DRAFT' || po.status === 'ORDERED')
      .reduce((sum, po) => sum + Number(po.total_cost || 0), 0)
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'ORDERED':
        return 'bg-yellow-100 text-yellow-800';
      case 'RECEIVED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR'
    }).format(Number(amount || 0));
  };

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Purchase Orders</h1>
                <p className="mt-2 text-sm text-gray-600">Manage inventory replenishment and supplier orders</p>
              </div>
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors shadow-lg"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Purchase Order
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total POs</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{summaryStats.total_pos}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Draft</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{summaryStats.draft_count}</p>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ordered</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">{summaryStats.ordered_count}</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Value</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(summaryStats.total_pending_value)}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleFilterChange(null)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  !statusFilter
                    ? 'bg-yellow-400 text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleFilterChange('DRAFT')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  statusFilter === 'DRAFT'
                    ? 'bg-yellow-400 text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Draft
              </button>
              <button
                onClick={() => handleFilterChange('ORDERED')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  statusFilter === 'ORDERED'
                    ? 'bg-yellow-400 text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Ordered
              </button>
              <button
                onClick={() => handleFilterChange('RECEIVED')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  statusFilter === 'RECEIVED'
                    ? 'bg-yellow-400 text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Received
              </button>
              <button
                onClick={() => handleFilterChange('CANCELLED')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  statusFilter === 'CANCELLED'
                    ? 'bg-yellow-400 text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancelled
              </button>
            </div>
          </div>

          {/* Purchase Orders List */}
          {isLoadingPOs ? (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-12">
              <div className="flex flex-col items-center justify-center">
                <svg className="animate-spin h-12 w-12 text-yellow-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-4 text-gray-600">Loading purchase orders...</p>
              </div>
            </div>
          ) : posError ? (
            <div className="bg-white rounded-xl shadow-lg border border-red-200 p-8">
              <div className="text-center">
                <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Purchase Orders</h3>
                <p className="text-gray-600 mb-4">{(posError as any).message || 'Failed to load data'}</p>
                <button
                  onClick={() => refetchPOs()}
                  className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-12">
              <div className="text-center">
                <svg className="w-20 h-20 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Purchase Orders Found</h3>
                <p className="text-gray-600 mb-6">
                  {statusFilter 
                    ? `No purchase orders with status "${statusFilter}"`
                    : 'Get started by creating your first purchase order'
                  }
                </p>
                {!statusFilter && (
                  <button
                    onClick={handleOpenCreateModal}
                    className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors"
                  >
                    Create Purchase Order
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        PO Number
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Supplier
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Total Cost
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            PO-{po.id.slice(0, 8).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{po.supplier_name}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{po.items_count} items</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(po.status)}`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(po.total_cost)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{formatDate(po.created_at)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewDetails(po.id)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                              title="View Details"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            {po.status === 'DRAFT' && (
                              <button
                                onClick={() => handleMarkOrdered(po.id)}
                                className="text-yellow-600 hover:text-yellow-900 transition-colors"
                                title="Mark as Ordered"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            )}
                            {po.status === 'ORDERED' && (
                              <button
                                onClick={() => handleReceivePO(po.id)}
                                className="text-green-600 hover:text-green-900 transition-colors"
                                title="Mark as Received"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            )}
                            {(po.status === 'DRAFT' || po.status === 'ORDERED') && (
                              <button
                                onClick={() => handleCancelPO(po.id)}
                                className="text-red-600 hover:text-red-900 transition-colors"
                                title="Cancel PO"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-4">
                {purchaseOrders.map((po) => (
                  <div key={po.id} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">PO-{po.id.slice(0, 8).toUpperCase()}</p>
                        <h3 className="text-lg font-semibold text-gray-900">{po.supplier_name}</h3>
                      </div>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(po.status)}`}>
                        {po.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-600">Items</p>
                        <p className="text-sm font-semibold text-gray-900">{po.items_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Total Cost</p>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(po.total_cost)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Created</p>
                        <p className="text-sm text-gray-900">{formatDate(po.created_at)}</p>
                      </div>
                      {po.ordered_at && (
                        <div>
                          <p className="text-xs text-gray-600">Ordered</p>
                          <p className="text-sm text-gray-900">{formatDate(po.ordered_at)}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetails(po.id)}
                        className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors"
                      >
                        View Details
                      </button>
                      {po.status === 'DRAFT' && (
                        <button
                          onClick={() => handleMarkOrdered(po.id)}
                          className="flex-1 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
                        >
                          Mark Ordered
                        </button>
                      )}
                      {po.status === 'ORDERED' && (
                        <button
                          onClick={() => handleReceivePO(po.id)}
                          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                        >
                          Receive
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create PO Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={handleCloseCreateModal}
            ></div>

            {/* Modal Panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Create Purchase Order</h3>
                  <button
                    onClick={handleCloseCreateModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Supplier Name */}
                  <div>
                    <label htmlFor="supplier_name" className="block text-sm font-semibold text-gray-900 mb-2">
                      Supplier Name <span className="text-yellow-500">*</span>
                    </label>
                    <input
                      id="supplier_name"
                      type="text"
                      value={poFormData.supplier_name}
                      onChange={(e) => {
                        setPOFormData(prev => ({ ...prev, supplier_name: e.target.value }));
                        setFormErrors(prev => ({ ...prev, supplier_name: undefined }));
                      }}
                      placeholder="Enter supplier name"
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                        formErrors.supplier_name
                          ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                          : 'border-gray-200 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100'
                      }`}
                    />
                    {formErrors.supplier_name && (
                      <p className="mt-2 text-sm text-red-600">{formErrors.supplier_name}</p>
                    )}
                  </div>

                  {/* Items Section */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Items <span className="text-yellow-500">*</span>
                    </label>
                    
                    {isLoadingInventory ? (
                      <div className="text-center py-4">
                        <svg className="animate-spin h-8 w-8 text-yellow-400 mx-auto" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-sm text-gray-600 mt-2">Loading inventory items...</p>
                      </div>
                    ) : (
                      <>
                        {/* Add Item Dropdown */}
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddItemToForm(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 mb-4"
                        >
                          <option value="">Select item to add...</option>
                          {inventoryItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.sku}) - {item.qty_on_hand} {item.unit} on hand
                            </option>
                          ))}
                        </select>

                        {/* Added Items List */}
                        {poFormData.items.length === 0 ? (
                          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <p className="text-sm text-gray-600">No items added yet</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {poFormData.items.map((item, index) => {
                              const inventoryItem = inventoryItems.find(i => i.id === item.inventory_item_id);
                              return (
                                <div key={index} className="border border-gray-200 rounded-lg p-4">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <p className="font-semibold text-gray-900">{inventoryItem?.name}</p>
                                      <p className="text-xs text-gray-500">SKU: {inventoryItem?.sku}</p>
                                    </div>
                                    <button
                                      onClick={() => handleRemoveItem(index)}
                                      className="text-red-600 hover:text-red-900"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Quantity ({inventoryItem?.unit})
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.qty}
                                        onChange={(e) => handleUpdateItem(index, 'qty', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Unit Cost (€)
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.unit_cost}
                                        onChange={(e) => handleUpdateItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
                                      />
                                    </div>
                                  </div>
                                  <div className="mt-2 text-right">
                                    <span className="text-sm font-semibold text-gray-900">
                                      Subtotal: {formatCurrency(Number(item.qty) * Number(item.unit_cost))}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {formErrors.items && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.items}</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label htmlFor="notes" className="block text-sm font-semibold text-gray-900 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      id="notes"
                      rows={3}
                      value={poFormData.notes}
                      onChange={(e) => setPOFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Add any additional notes or instructions..."
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                    />
                  </div>

                  {/* Total Summary */}
                  {poFormData.items.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-gray-900">Total PO Value:</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {formatCurrency(
                            poFormData.items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unit_cost)), 0)
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse gap-3">
                <button
                  onClick={handleCreatePO}
                  disabled={createPOMutation.isPending}
                  className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createPOMutation.isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Purchase Order'
                  )}
                </button>
                <button
                  onClick={handleCloseCreateModal}
                  className="mt-3 w-full sm:mt-0 sm:w-auto inline-flex justify-center px-6 py-3 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-lg border-2 border-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedPOId && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="detail-modal-title" role="dialog" aria-modal="true">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={() => {
                setShowDetailModal(false);
                setSelectedPOId(null);
              }}
            ></div>

            {/* Modal Panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              {isLoadingPODetails ? (
                <div className="p-12">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="animate-spin h-12 w-12 text-yellow-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-gray-600">Loading details...</p>
                  </div>
                </div>
              ) : selectedPODetails ? (
                <>
                  <div className="bg-white px-6 pt-6 pb-4">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">
                          PO-{selectedPODetails.po.id.slice(0, 8).toUpperCase()}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{selectedPODetails.po.supplier_name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-4 py-2 text-sm font-semibold rounded-full ${getStatusColor(selectedPODetails.po.status)}`}>
                          {selectedPODetails.po.status}
                        </span>
                        <button
                          onClick={() => {
                            setShowDetailModal(false);
                            setSelectedPOId(null);
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* PO Metadata */}
                    <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-600">Created</p>
                        <p className="text-sm font-semibold text-gray-900">{formatDate(selectedPODetails.po.created_at)}</p>
                      </div>
                      {selectedPODetails.po.ordered_at && (
                        <div>
                          <p className="text-xs text-gray-600">Ordered</p>
                          <p className="text-sm font-semibold text-gray-900">{formatDate(selectedPODetails.po.ordered_at)}</p>
                        </div>
                      )}
                      {selectedPODetails.po.received_at && (
                        <div>
                          <p className="text-xs text-gray-600">Received</p>
                          <p className="text-sm font-semibold text-gray-900">{formatDate(selectedPODetails.po.received_at)}</p>
                        </div>
                      )}
                    </div>

                    {/* Items Table */}
                    <div className="mb-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">Items</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                Item
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                SKU
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                Qty
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                Unit Cost
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {selectedPODetails.items.map((item) => (
                              <tr key={item.id}>
                                <td className="px-4 py-3 text-sm text-gray-900">{item.item_name}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{item.sku}</td>
                                <td className="px-4 py-3 text-sm text-right text-gray-900">{Number(item.qty).toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(item.unit_cost)}</td>
                                <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                                  {formatCurrency(Number(item.qty) * Number(item.unit_cost))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr>
                              <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                                Total:
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                                {formatCurrency(
                                  selectedPODetails.items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unit_cost)), 0)
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Notes */}
                    {selectedPODetails.po.notes && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Notes</h4>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedPODetails.po.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer Actions */}
                  <div className="bg-gray-50 px-6 py-4 flex flex-wrap gap-3">
                    {selectedPODetails.po.status === 'DRAFT' && (
                      <button
                        onClick={() => handleMarkOrdered(selectedPOId)}
                        disabled={updatePOStatusMutation.isPending}
                        className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        Mark as Ordered
                      </button>
                    )}
                    {selectedPODetails.po.status === 'ORDERED' && (
                      <button
                        onClick={() => handleReceivePO(selectedPOId)}
                        disabled={updatePOStatusMutation.isPending}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        Mark as Received
                      </button>
                    )}
                    {(selectedPODetails.po.status === 'DRAFT' || selectedPODetails.po.status === 'ORDERED') && (
                      <button
                        onClick={() => handleCancelPO(selectedPOId)}
                        disabled={updatePOStatusMutation.isPending}
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        Cancel PO
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        setSelectedPOId(null);
                      }}
                      className="ml-auto px-6 py-3 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-lg border-2 border-gray-300 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-gray-600">Purchase order not found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_P2_PurchaseOrders;