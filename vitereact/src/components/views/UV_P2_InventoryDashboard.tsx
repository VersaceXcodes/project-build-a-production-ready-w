import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPES & INTERFACES
// ===========================

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
  created_at: string;
  updated_at: string;
}

interface InventoryItemWithStatus {
  item: InventoryItem;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

interface InventorySummary {
  total_items: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_value: number;
}

interface CreateInventoryItemPayload {
  sku: string;
  name: string;
  unit: string;
  qty_on_hand: number;
  reorder_point: number;
  reorder_qty: number;
  supplier_name: string | null;
  cost_per_unit: number;
}

interface UpdateInventoryItemPayload {
  qty_on_hand?: number;
  reorder_point?: number;
  reorder_qty?: number;
  cost_per_unit?: number;
  is_active?: boolean;
}

interface InventoryTransaction {
  id: string;
  inventory_item_id: string;
  transaction_type: 'ADDITION' | 'CONSUMPTION' | 'ADJUSTMENT';
  qty: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

interface AddItemFormData {
  sku: string;
  name: string;
  unit: string;
  qty_on_hand: string;
  reorder_point: string;
  reorder_qty: string;
  supplier_name: string;
  cost_per_unit: string;
}

interface EditItemFormData {
  qty_on_hand: string;
  reorder_point: string;
  reorder_qty: string;
  cost_per_unit: string;
  is_active: boolean;
}

// ===========================
// MAIN COMPONENT
// ===========================

const UV_P2_InventoryDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // ===========================
  // GLOBAL STATE ACCESS
  // ===========================

  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const featureInventoryEnabled = useAppStore(state => state.feature_flags.feature_inventory_enabled);
  const showToast = useAppStore(state => state.show_toast);

  // ===========================
  // LOCAL STATE
  // ===========================

  // Filter states (synced with URL)
  const [statusFilter, setStatusFilter] = useState<string | null>(
    searchParams.get('status') || null
  );
  const [categoryFilter, setCategoryFilter] = useState<string | null>(
    searchParams.get('category') || null
  );

  // Modal states
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [editItemModalOpen, setEditItemModalOpen] = useState(false);
  const [transactionHistoryOpen, setTransactionHistoryOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Form states
  const [addItemForm, setAddItemForm] = useState<AddItemFormData>({
    sku: '',
    name: '',
    unit: '',
    qty_on_hand: '0',
    reorder_point: '0',
    reorder_qty: '0',
    supplier_name: '',
    cost_per_unit: '0',
  });

  const [editItemForm, setEditItemForm] = useState<EditItemFormData>({
    qty_on_hand: '0',
    reorder_point: '0',
    reorder_qty: '0',
    cost_per_unit: '0',
    is_active: true,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ===========================
  // FEATURE FLAG CHECK
  // ===========================

  useEffect(() => {
    if (!featureInventoryEnabled) {
      showToast({
        type: 'error',
        message: 'Inventory features are not enabled. Enable in Settings > Features.',
        duration: 5000,
      });
      navigate('/admin');
    }
  }, [featureInventoryEnabled, navigate, showToast]);

  // ===========================
  // URL STATE SYNC
  // ===========================

  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    setSearchParams(params, { replace: true });
  }, [statusFilter, categoryFilter, setSearchParams]);

  // ===========================
  // API FUNCTIONS
  // ===========================

  const fetchInventoryItems = async (): Promise<InventoryItemWithStatus[]> => {
    if (!authToken) throw new Error('No auth token');

    const params: Record<string, any> = {};
    if (statusFilter === 'low_stock') {
      params.low_stock = true;
    }

    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/inventory-items`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params,
      }
    );

    return response.data;
  };

  const fetchInventoryTransactions = async (itemId: string): Promise<InventoryTransaction[]> => {
    if (!authToken) throw new Error('No auth token');

    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/inventory-transactions`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { inventory_item_id: itemId },
      }
    );

    return response.data;
  };

  const createInventoryItemAPI = async (data: CreateInventoryItemPayload): Promise<InventoryItem> => {
    if (!authToken) throw new Error('No auth token');

    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/inventory-items`,
      data,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    return response.data;
  };

  const updateInventoryItemAPI = async (params: {
    itemId: string;
    data: UpdateInventoryItemPayload;
  }): Promise<InventoryItem> => {
    if (!authToken) throw new Error('No auth token');

    const response = await axios.patch(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/inventory-items/${params.itemId}`,
      params.data,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    return response.data;
  };

  // ===========================
  // REACT QUERY HOOKS
  // ===========================

  const {
    data: inventoryData = [],
    isLoading: isLoadingInventory,
    error: inventoryError,
  } = useQuery({
    queryKey: ['inventory-items', { status: statusFilter, category: categoryFilter }],
    queryFn: fetchInventoryItems,
    enabled: !!authToken && isAuthenticated && featureInventoryEnabled,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const {
    data: transactionHistory = [],
    isLoading: isLoadingTransactions,
  } = useQuery({
    queryKey: ['inventory-transactions', selectedItemId],
    queryFn: () => fetchInventoryTransactions(selectedItemId!),
    enabled: !!selectedItemId && transactionHistoryOpen,
    staleTime: 60000,
  });

  const createItemMutation = useMutation({
    mutationFn: createInventoryItemAPI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setAddItemModalOpen(false);
      resetAddItemForm();
      showToast({
        type: 'success',
        message: 'Inventory item created successfully',
        duration: 5000,
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to create inventory item',
        duration: 5000,
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: updateInventoryItemAPI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setEditItemModalOpen(false);
      setSelectedItemId(null);
      showToast({
        type: 'success',
        message: 'Inventory item updated successfully',
        duration: 5000,
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update inventory item',
        duration: 5000,
      });
    },
  });

  // ===========================
  // COMPUTED VALUES
  // ===========================

  const filteredInventory = inventoryData.filter((item) => {
    if (statusFilter === 'in_stock') {
      return item.stock_status === 'in_stock';
    } else if (statusFilter === 'low_stock') {
      return item.stock_status === 'low_stock';
    } else if (statusFilter === 'out_of_stock') {
      return item.stock_status === 'out_of_stock';
    }
    return true; // 'all' or no filter
  });

  const inventorySummary: InventorySummary = {
    total_items: inventoryData.length,
    low_stock_count: inventoryData.filter((i) => i.stock_status === 'low_stock').length,
    out_of_stock_count: inventoryData.filter((i) => i.stock_status === 'out_of_stock').length,
    total_value: inventoryData.reduce(
      (sum, i) => sum + (Number(i.item.qty_on_hand) * Number(i.item.cost_per_unit)),
      0
    ),
  };

  // ===========================
  // FORM HANDLERS
  // ===========================

  const resetAddItemForm = () => {
    setAddItemForm({
      sku: '',
      name: '',
      unit: '',
      qty_on_hand: '0',
      reorder_point: '0',
      reorder_qty: '0',
      supplier_name: '',
      cost_per_unit: '0',
    });
    setFormErrors({});
  };

  const validateAddItemForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!addItemForm.sku.trim()) errors.sku = 'SKU is required';
    if (!addItemForm.name.trim()) errors.name = 'Name is required';
    if (!addItemForm.unit.trim()) errors.unit = 'Unit is required';
    if (parseFloat(addItemForm.qty_on_hand) < 0) errors.qty_on_hand = 'Quantity must be non-negative';
    if (parseFloat(addItemForm.reorder_point) < 0) errors.reorder_point = 'Reorder point must be non-negative';
    if (parseFloat(addItemForm.reorder_qty) < 0) errors.reorder_qty = 'Reorder quantity must be non-negative';
    if (parseFloat(addItemForm.cost_per_unit) < 0) errors.cost_per_unit = 'Cost must be non-negative';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAddItemForm()) return;

    const payload: CreateInventoryItemPayload = {
      sku: addItemForm.sku.trim(),
      name: addItemForm.name.trim(),
      unit: addItemForm.unit.trim(),
      qty_on_hand: parseFloat(addItemForm.qty_on_hand),
      reorder_point: parseFloat(addItemForm.reorder_point),
      reorder_qty: parseFloat(addItemForm.reorder_qty),
      supplier_name: addItemForm.supplier_name.trim() || null,
      cost_per_unit: parseFloat(addItemForm.cost_per_unit),
    };

    createItemMutation.mutate(payload);
  };

  const handleEditItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItemId) return;

    const payload: UpdateInventoryItemPayload = {
      qty_on_hand: parseFloat(editItemForm.qty_on_hand),
      reorder_point: parseFloat(editItemForm.reorder_point),
      reorder_qty: parseFloat(editItemForm.reorder_qty),
      cost_per_unit: parseFloat(editItemForm.cost_per_unit),
      is_active: editItemForm.is_active,
    };

    updateItemMutation.mutate({ itemId: selectedItemId, data: payload });
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItemId(item.id);
    setEditItemForm({
      qty_on_hand: item.qty_on_hand.toString(),
      reorder_point: item.reorder_point.toString(),
      reorder_qty: item.reorder_qty.toString(),
      cost_per_unit: item.cost_per_unit.toString(),
      is_active: item.is_active,
    });
    setEditItemModalOpen(true);
  };

  const openTransactionHistory = (itemId: string) => {
    setSelectedItemId(itemId);
    setTransactionHistoryOpen(true);
  };

  // ===========================
  // UTILITY FUNCTIONS
  // ===========================

  const getStockStatusColor = (status: string): string => {
    switch (status) {
      case 'in_stock':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'low_stock':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'out_of_stock':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStockStatusLabel = (status: string): string => {
    switch (status) {
      case 'in_stock':
        return 'In Stock';
      case 'low_stock':
        return 'Low Stock';
      case 'out_of_stock':
        return 'Out of Stock';
      default:
        return 'Unknown';
    }
  };

  // ===========================
  // RENDER
  // ===========================

  if (!featureInventoryEnabled) {
    return null; // Redirect happens in useEffect
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Track materials, monitor stock levels, and manage reorder points
                </p>
              </div>
              <button
                onClick={() => setAddItemModalOpen(true)}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-black bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
              >
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Inventory Item
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Items Card */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Items</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {inventorySummary.total_items}
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Low Stock Card */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-3xl font-bold text-orange-600 mt-2">
                    {inventorySummary.low_stock_count}
                  </p>
                </div>
                <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Out of Stock Card */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">
                    {inventorySummary.out_of_stock_count}
                  </p>
                </div>
                <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Total Value Card */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    €{Number(inventorySummary.total_value || 0).toFixed(2)}
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mt-8 bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex space-x-2">
                <button
                  onClick={() => setStatusFilter(null)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === null
                      ? 'bg-yellow-400 text-black'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Items
                </button>
                <button
                  onClick={() => setStatusFilter('in_stock')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === 'in_stock'
                      ? 'bg-yellow-400 text-black'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  In Stock
                </button>
                <button
                  onClick={() => setStatusFilter('low_stock')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === 'low_stock'
                      ? 'bg-yellow-400 text-black'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Low Stock
                  {inventorySummary.low_stock_count > 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-600 text-white">
                      {inventorySummary.low_stock_count}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setStatusFilter('out_of_stock')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === 'out_of_stock'
                      ? 'bg-yellow-400 text-black'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Out of Stock
                  {inventorySummary.out_of_stock_count > 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">
                      {inventorySummary.out_of_stock_count}
                    </span>
                  )}
                </button>
              </div>

              <Link
                to="/admin/inventory/consumption"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Consumption Rules
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Loading State */}
            {isLoadingInventory && (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse flex space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="h-10 w-10 bg-gray-300 rounded"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {inventoryError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <svg className="mx-auto h-12 w-12 text-red-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700 font-medium">Failed to load inventory items</p>
                <p className="text-red-600 text-sm mt-2">{(inventoryError as any)?.message}</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoadingInventory && !inventoryError && filteredInventory.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-gray-600 font-medium mb-2">No inventory items found</p>
                <p className="text-gray-500 text-sm mb-6">
                  {statusFilter ? 'Try adjusting your filters or add your first inventory item' : 'Add your first inventory item to get started'}
                </p>
                <button
                  onClick={() => setAddItemModalOpen(true)}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-black bg-yellow-400 hover:bg-yellow-500 transition-colors"
                >
                  Add Inventory Item
                </button>
              </div>
            )}

            {/* Inventory Items Table */}
            {!isLoadingInventory && !inventoryError && filteredInventory.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qty on Hand
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reorder Point
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInventory.map((inventoryItem) => (
                      <tr key={inventoryItem.item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {inventoryItem.item.sku}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {inventoryItem.item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {inventoryItem.item.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`font-semibold ${
                            inventoryItem.stock_status === 'out_of_stock'
                              ? 'text-red-600'
                              : inventoryItem.stock_status === 'low_stock'
                              ? 'text-orange-600'
                              : 'text-green-600'
                          }`}>
                            {Number(inventoryItem.item.qty_on_hand || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {Number(inventoryItem.item.reorder_point || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStockStatusColor(inventoryItem.stock_status)}`}>
                            {getStockStatusLabel(inventoryItem.stock_status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {inventoryItem.item.supplier_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => openEditModal(inventoryItem.item)}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openTransactionHistory(inventoryItem.item.id)}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                            >
                              History
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Link
              to="/admin/inventory/consumption"
              className="block bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Consumption Rules</h3>
                  <p className="text-sm text-gray-600">
                    Configure material consumption formulas for services
                  </p>
                </div>
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link
              to="/admin/inventory/purchase-orders"
              className="block bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Purchase Orders</h3>
                  <p className="text-sm text-gray-600">
                    Manage purchase orders and restock inventory
                  </p>
                </div>
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>
        </div>

        {/* Add Item Modal */}
        {addItemModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div
                className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
                onClick={() => {
                  setAddItemModalOpen(false);
                  resetAddItemForm();
                }}
              ></div>

              {/* Modal panel */}
              <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <form onSubmit={handleAddItemSubmit}>
                  <div className="bg-white px-6 pt-6 pb-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-gray-900">Add Inventory Item</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setAddItemModalOpen(false);
                          resetAddItemForm();
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {/* SKU */}
                      <div>
                        <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-2">
                          SKU <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="sku"
                          required
                          value={addItemForm.sku}
                          onChange={(e) => {
                            setAddItemForm({ ...addItemForm, sku: e.target.value });
                            setFormErrors({ ...formErrors, sku: '' });
                          }}
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          placeholder="e.g., PV-ROLL-001"
                        />
                        {formErrors.sku && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.sku}</p>
                        )}
                      </div>

                      {/* Name */}
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                          Item Name <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="name"
                          required
                          value={addItemForm.name}
                          onChange={(e) => {
                            setAddItemForm({ ...addItemForm, name: e.target.value });
                            setFormErrors({ ...formErrors, name: '' });
                          }}
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          placeholder="e.g., Premium Vinyl Roll"
                        />
                        {formErrors.name && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                        )}
                      </div>

                      {/* Unit */}
                      <div>
                        <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-2">
                          Unit <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="unit"
                          required
                          value={addItemForm.unit}
                          onChange={(e) => {
                            setAddItemForm({ ...addItemForm, unit: e.target.value });
                            setFormErrors({ ...formErrors, unit: '' });
                          }}
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          placeholder="e.g., roll, sheet, liter"
                        />
                        {formErrors.unit && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.unit}</p>
                        )}
                      </div>

                      {/* Qty on Hand */}
                      <div>
                        <label htmlFor="qty_on_hand" className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity on Hand <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="number"
                          id="qty_on_hand"
                          required
                          min="0"
                          step="0.01"
                          value={addItemForm.qty_on_hand}
                          onChange={(e) => {
                            setAddItemForm({ ...addItemForm, qty_on_hand: e.target.value });
                            setFormErrors({ ...formErrors, qty_on_hand: '' });
                          }}
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          placeholder="0.00"
                        />
                        {formErrors.qty_on_hand && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.qty_on_hand}</p>
                        )}
                      </div>

                      {/* Reorder Point */}
                      <div>
                        <label htmlFor="reorder_point" className="block text-sm font-medium text-gray-700 mb-2">
                          Reorder Point <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="number"
                          id="reorder_point"
                          required
                          min="0"
                          step="0.01"
                          value={addItemForm.reorder_point}
                          onChange={(e) => {
                            setAddItemForm({ ...addItemForm, reorder_point: e.target.value });
                            setFormErrors({ ...formErrors, reorder_point: '' });
                          }}
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          placeholder="0.00"
                        />
                        {formErrors.reorder_point && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.reorder_point}</p>
                        )}
                      </div>

                      {/* Reorder Qty */}
                      <div>
                        <label htmlFor="reorder_qty" className="block text-sm font-medium text-gray-700 mb-2">
                          Reorder Quantity <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="number"
                          id="reorder_qty"
                          required
                          min="0"
                          step="0.01"
                          value={addItemForm.reorder_qty}
                          onChange={(e) => {
                            setAddItemForm({ ...addItemForm, reorder_qty: e.target.value });
                            setFormErrors({ ...formErrors, reorder_qty: '' });
                          }}
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          placeholder="0.00"
                        />
                        {formErrors.reorder_qty && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.reorder_qty}</p>
                        )}
                      </div>

                      {/* Supplier */}
                      <div>
                        <label htmlFor="supplier_name" className="block text-sm font-medium text-gray-700 mb-2">
                          Supplier Name
                        </label>
                        <input
                          type="text"
                          id="supplier_name"
                          value={addItemForm.supplier_name}
                          onChange={(e) => setAddItemForm({ ...addItemForm, supplier_name: e.target.value })}
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          placeholder="e.g., Acme Supplies"
                        />
                      </div>

                      {/* Cost per Unit */}
                      <div>
                        <label htmlFor="cost_per_unit" className="block text-sm font-medium text-gray-700 mb-2">
                          Cost per Unit (€) <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="number"
                          id="cost_per_unit"
                          required
                          min="0"
                          step="0.01"
                          value={addItemForm.cost_per_unit}
                          onChange={(e) => {
                            setAddItemForm({ ...addItemForm, cost_per_unit: e.target.value });
                            setFormErrors({ ...formErrors, cost_per_unit: '' });
                          }}
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          placeholder="0.00"
                        />
                        {formErrors.cost_per_unit && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.cost_per_unit}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAddItemModalOpen(false);
                        resetAddItemForm();
                      }}
                      className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createItemMutation.isPending}
                      className="px-6 py-3 border border-transparent rounded-lg text-sm font-medium text-black bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {createItemMutation.isPending ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating...
                        </span>
                      ) : (
                        'Create Item'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Item Modal */}
        {editItemModalOpen && selectedItemId && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div
                className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
                onClick={() => {
                  setEditItemModalOpen(false);
                  setSelectedItemId(null);
                }}
              ></div>

              {/* Modal panel */}
              <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <form onSubmit={handleEditItemSubmit}>
                  <div className="bg-white px-6 pt-6 pb-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-gray-900">Edit Inventory Item</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setEditItemModalOpen(false);
                          setSelectedItemId(null);
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {/* Qty on Hand */}
                      <div>
                        <label htmlFor="edit_qty_on_hand" className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity on Hand
                        </label>
                        <input
                          type="number"
                          id="edit_qty_on_hand"
                          required
                          min="0"
                          step="0.01"
                          value={editItemForm.qty_on_hand}
                          onChange={(e) => setEditItemForm({ ...editItemForm, qty_on_hand: e.target.value })}
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      {/* Reorder Point */}
                      <div>
                        <label htmlFor="edit_reorder_point" className="block text-sm font-medium text-gray-700 mb-2">
                          Reorder Point
                        </label>
                        <input
                          type="number"
                          id="edit_reorder_point"
                          required
                          min="0"
                          step="0.01"
                          value={editItemForm.reorder_point}
                          onChange={(e) => setEditItemForm({ ...editItemForm, reorder_point: e.target.value })}
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      {/* Reorder Qty */}
                      <div>
                        <label htmlFor="edit_reorder_qty" className="block text-sm font-medium text-gray-700 mb-2">
                          Reorder Quantity
                        </label>
                        <input
                          type="number"
                          id="edit_reorder_qty"
                          required
                          min="0"
                          step="0.01"
                          value={editItemForm.reorder_qty}
                          onChange={(e) => setEditItemForm({ ...editItemForm, reorder_qty: e.target.value })}
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      {/* Cost per Unit */}
                      <div>
                        <label htmlFor="edit_cost_per_unit" className="block text-sm font-medium text-gray-700 mb-2">
                          Cost per Unit (€)
                        </label>
                        <input
                          type="number"
                          id="edit_cost_per_unit"
                          required
                          min="0"
                          step="0.01"
                          value={editItemForm.cost_per_unit}
                          onChange={(e) => setEditItemForm({ ...editItemForm, cost_per_unit: e.target.value })}
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      {/* Active Status */}
                      <div className="sm:col-span-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={editItemForm.is_active}
                            onChange={(e) => setEditItemForm({ ...editItemForm, is_active: e.target.checked })}
                            className="h-5 w-5 text-yellow-400 focus:ring-yellow-500 border-gray-300 rounded"
                          />
                          <span className="ml-3 text-sm font-medium text-gray-700">
                            Item is active
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditItemModalOpen(false);
                        setSelectedItemId(null);
                      }}
                      className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updateItemMutation.isPending}
                      className="px-6 py-3 border border-transparent rounded-lg text-sm font-medium text-black bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {updateItemMutation.isPending ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Updating...
                        </span>
                      ) : (
                        'Update Item'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Transaction History Modal */}
        {transactionHistoryOpen && selectedItemId && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div
                className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
                onClick={() => {
                  setTransactionHistoryOpen(false);
                  setSelectedItemId(null);
                }}
              ></div>

              {/* Modal panel */}
              <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                <div className="bg-white px-6 pt-6 pb-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">Transaction History</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setTransactionHistoryOpen(false);
                        setSelectedItemId(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Transaction History Content */}
                  {isLoadingTransactions && (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
                      <p className="mt-4 text-gray-600">Loading transaction history...</p>
                    </div>
                  )}

                  {!isLoadingTransactions && transactionHistory.length === 0 && (
                    <div className="text-center py-12">
                      <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-600 font-medium">No transaction history</p>
                      <p className="text-gray-500 text-sm mt-2">This item has no recorded transactions yet</p>
                    </div>
                  )}

                  {!isLoadingTransactions && transactionHistory.length > 0 && (
                    <div className="overflow-x-auto max-h-96">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Quantity
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Reference
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Notes
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {transactionHistory.map((transaction) => (
                            <tr key={transaction.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(transaction.created_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  transaction.transaction_type === 'ADDITION'
                                    ? 'bg-green-100 text-green-800'
                                    : transaction.transaction_type === 'CONSUMPTION'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {transaction.transaction_type}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`font-semibold ${
                                  transaction.transaction_type === 'ADDITION'
                                    ? 'text-green-600'
                                    : transaction.transaction_type === 'CONSUMPTION'
                                    ? 'text-red-600'
                                    : 'text-blue-600'
                                }`}>
                                  {transaction.transaction_type === 'ADDITION' ? '+' : transaction.transaction_type === 'CONSUMPTION' ? '-' : ''}
                                  {Number(transaction.qty || 0).toFixed(2)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {transaction.reference_type && transaction.reference_id
                                  ? `${transaction.reference_type}: ${transaction.reference_id}`
                                  : '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {transaction.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 px-6 py-4 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionHistoryOpen(false);
                      setSelectedItemId(null);
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_P2_InventoryDashboard;