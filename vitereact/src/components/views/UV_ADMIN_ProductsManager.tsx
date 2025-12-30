import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Package, Plus, Search, Filter, Edit2, Trash2, Eye, EyeOff, ChevronDown, ChevronUp, X, DollarSign, Layers } from 'lucide-react';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  base_price: number;
  thumbnail_url: string | null;
  category_id: string | null;
  is_active: boolean;
  purchase_mode: string;
  config_schema: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_slug?: string;
  variants_count?: number;
}

interface ProductVariant {
  id: string;
  product_id: string;
  label: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  compare_at_price: number | null;
  discount_label: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateProductFormData {
  name: string;
  slug: string;
  description: string;
  base_price: number;
  thumbnail_url: string;
  category_id: string;
  config_schema: Record<string, any> | null;
}

interface CreateCategoryFormData {
  name: string;
  slug: string;
  sort_order: number;
}

interface CreateVariantFormData {
  label: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  compare_at_price: number | null;
  discount_label: string;
  sort_order: number;
}

// ===========================
// MAIN COMPONENT
// ===========================

const UV_ADMIN_ProductsManager: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // CRITICAL: Individual selectors, no object destructuring
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const show_toast = useAppStore(state => state.show_toast);

  // Local state
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || null,
    active: searchParams.get('active') === 'true' ? true : searchParams.get('active') === 'false' ? false : null,
    search: ''
  });

  const [create_product_modal_open, set_create_product_modal_open] = useState(false);
  const [create_category_modal_open, set_create_category_modal_open] = useState(false);
  const [edit_product_modal_open, set_edit_product_modal_open] = useState(false);
  const [variants_modal_open, set_variants_modal_open] = useState(false);
  const [create_variant_modal_open, set_create_variant_modal_open] = useState(false);
  
  const [selected_product, set_selected_product] = useState<Product | null>(null);
  const [expanded_product_id, set_expanded_product_id] = useState<string | null>(null);

  const [create_product_form, set_create_product_form] = useState<CreateProductFormData>({
    name: '',
    slug: '',
    description: '',
    base_price: 0,
    thumbnail_url: '',
    category_id: '',
    config_schema: null
  });

  const [edit_product_form, set_edit_product_form] = useState<CreateProductFormData>({
    name: '',
    slug: '',
    description: '',
    base_price: 0,
    thumbnail_url: '',
    category_id: '',
    config_schema: null
  });

  const [create_category_form, set_create_category_form] = useState<CreateCategoryFormData>({
    name: '',
    slug: '',
    sort_order: 0
  });

  const [create_variant_form, set_create_variant_form] = useState<CreateVariantFormData>({
    label: '',
    quantity: 100,
    unit_price: 0,
    total_price: 0,
    compare_at_price: null,
    discount_label: '',
    sort_order: 0
  });

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.active !== null) params.set('active', String(filters.active));
    setSearchParams(params);
  }, [filters.category, filters.active, setSearchParams]);

  // Auto-generate slug from name for create product
  useEffect(() => {
    if (create_product_form.name && !create_product_form.slug) {
      const auto_slug = create_product_form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      set_create_product_form(prev => ({ ...prev, slug: auto_slug }));
    }
  }, [create_product_form.name]);

  // Auto-generate slug from name for create category
  useEffect(() => {
    if (create_category_form.name && !create_category_form.slug) {
      const auto_slug = create_category_form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      set_create_category_form(prev => ({ ...prev, slug: auto_slug }));
    }
  }, [create_category_form.name]);

  // Auto-calculate total price from unit price * quantity
  useEffect(() => {
    if (create_variant_form.unit_price && create_variant_form.quantity) {
      const total = create_variant_form.unit_price * create_variant_form.quantity;
      set_create_variant_form(prev => ({ ...prev, total_price: parseFloat(total.toFixed(2)) }));
    }
  }, [create_variant_form.unit_price, create_variant_form.quantity]);

  // ===========================
  // DATA FETCHING
  // ===========================

  // Fetch product categories
  const { data: product_categories = [], isLoading: is_loading_categories } = useQuery({
    queryKey: ['admin-product-categories'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/admin/product-categories`, {
        headers: { Authorization: `Bearer ${auth_token}` }
      });
      return response.data as ProductCategory[];
    },
    enabled: !!auth_token,
    staleTime: 300000,
    refetchOnWindowFocus: false
  });

  // Fetch products with filtering
  const { data: products = [], isLoading: is_loading_products, error: fetch_error } = useQuery({
    queryKey: ['admin-products', filters.category, filters.active],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.active !== null) params.set('is_active', String(filters.active));
      
      const response = await axios.get(`${API_BASE_URL}/api/admin/products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${auth_token}` }
      });
      
      return response.data as Product[];
    },
    enabled: !!auth_token,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Fetch variants for selected product
  const { data: product_variants = [], isLoading: is_loading_variants } = useQuery({
    queryKey: ['admin-product-variants', selected_product?.id],
    queryFn: async () => {
      if (!selected_product?.id) return [];
      const response = await axios.get(`${API_BASE_URL}/api/admin/products/${selected_product.id}/variants`, {
        headers: { Authorization: `Bearer ${auth_token}` }
      });
      return response.data as ProductVariant[];
    },
    enabled: !!auth_token && !!selected_product?.id && variants_modal_open,
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  // ===========================
  // MUTATIONS
  // ===========================

  // Create product mutation
  const create_product_mutation = useMutation({
    mutationFn: async (data: CreateProductFormData) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/admin/products`,
        data,
        { headers: { Authorization: `Bearer ${auth_token}`, 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      set_create_product_modal_open(false);
      set_create_product_form({
        name: '',
        slug: '',
        description: '',
        base_price: 0,
        thumbnail_url: '',
        category_id: '',
        config_schema: null
      });
      show_toast({
        type: 'success',
        message: 'Product created successfully',
        duration: 5000
      });
    },
    onError: (error: any) => {
      const error_message = error.response?.data?.message || 'Failed to create product';
      show_toast({
        type: 'error',
        message: error_message,
        duration: 5000
      });
    }
  });

  // Update product mutation
  const update_product_mutation = useMutation({
    mutationFn: async ({ product_id, data }: { product_id: string; data: Partial<CreateProductFormData & { is_active: boolean }> }) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/products/${product_id}`,
        data,
        { headers: { Authorization: `Bearer ${auth_token}`, 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      set_edit_product_modal_open(false);
      set_selected_product(null);
      show_toast({
        type: 'success',
        message: 'Product updated successfully',
        duration: 5000
      });
    },
    onError: (error: any) => {
      const error_message = error.response?.data?.message || 'Failed to update product';
      show_toast({
        type: 'error',
        message: error_message,
        duration: 5000
      });
    }
  });

  // Create category mutation
  const create_category_mutation = useMutation({
    mutationFn: async (data: CreateCategoryFormData) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/admin/product-categories`,
        data,
        { headers: { Authorization: `Bearer ${auth_token}`, 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-categories'] });
      set_create_category_modal_open(false);
      set_create_category_form({
        name: '',
        slug: '',
        sort_order: product_categories.length
      });
      show_toast({
        type: 'success',
        message: 'Category created successfully',
        duration: 5000
      });
    },
    onError: (error: any) => {
      const error_message = error.response?.data?.message || 'Failed to create category';
      show_toast({
        type: 'error',
        message: error_message,
        duration: 5000
      });
    }
  });

  // Toggle product active mutation
  const toggle_active_mutation = useMutation({
    mutationFn: async ({ product_id, is_active }: { product_id: string; is_active: boolean }) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/admin/products/${product_id}`,
        { is_active },
        { headers: { Authorization: `Bearer ${auth_token}`, 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onMutate: async ({ product_id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-products'] });
      const previous_products = queryClient.getQueryData(['admin-products', filters.category, filters.active]);
      
      queryClient.setQueryData(['admin-products', filters.category, filters.active], (old: Product[] = []) =>
        old.map(product =>
          product.id === product_id
            ? { ...product, is_active }
            : product
        )
      );
      
      return { previous_products };
    },
    onError: (error: any, variables, context) => {
      if (context?.previous_products) {
        queryClient.setQueryData(['admin-products', filters.category, filters.active], context.previous_products);
      }
      show_toast({
        type: 'error',
        message: 'Failed to update product status',
        duration: 5000
      });
    },
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Product status updated',
        duration: 3000
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    }
  });

  // Delete product mutation (soft delete)
  const delete_product_mutation = useMutation({
    mutationFn: async (product_id: string) => {
      await axios.delete(
        `${API_BASE_URL}/api/admin/products/${product_id}`,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      show_toast({
        type: 'success',
        message: 'Product deactivated successfully',
        duration: 5000
      });
    },
    onError: (error: any) => {
      const error_message = error.response?.data?.message || 'Failed to delete product';
      show_toast({
        type: 'error',
        message: error_message,
        duration: 5000
      });
    }
  });

  // Create variant mutation
  const create_variant_mutation = useMutation({
    mutationFn: async ({ product_id, data }: { product_id: string; data: CreateVariantFormData }) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/admin/products/${product_id}/variants`,
        data,
        { headers: { Authorization: `Bearer ${auth_token}`, 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-variants', selected_product?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      set_create_variant_modal_open(false);
      set_create_variant_form({
        label: '',
        quantity: 100,
        unit_price: 0,
        total_price: 0,
        compare_at_price: null,
        discount_label: '',
        sort_order: product_variants.length
      });
      show_toast({
        type: 'success',
        message: 'Variant created successfully',
        duration: 5000
      });
    },
    onError: (error: any) => {
      const error_message = error.response?.data?.message || 'Failed to create variant';
      show_toast({
        type: 'error',
        message: error_message,
        duration: 5000
      });
    }
  });

  // Delete variant mutation
  const delete_variant_mutation = useMutation({
    mutationFn: async (variant_id: string) => {
      await axios.delete(
        `${API_BASE_URL}/api/admin/product-variants/${variant_id}`,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-variants', selected_product?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      show_toast({
        type: 'success',
        message: 'Variant deleted successfully',
        duration: 5000
      });
    },
    onError: (error: any) => {
      const error_message = error.response?.data?.message || 'Failed to delete variant';
      show_toast({
        type: 'error',
        message: error_message,
        duration: 5000
      });
    }
  });

  // ===========================
  // EVENT HANDLERS
  // ===========================

  const handle_filter_change = (filter_key: 'category' | 'active', value: string | boolean | null) => {
    setFilters(prev => ({ ...prev, [filter_key]: value }));
  };

  const handle_search_change = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const handle_create_product_submit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!create_product_form.name || !create_product_form.slug) {
      show_toast({
        type: 'error',
        message: 'Please fill in all required fields',
        duration: 5000
      });
      return;
    }

    create_product_mutation.mutate(create_product_form);
  };

  const handle_edit_product_submit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selected_product || !edit_product_form.name) {
      show_toast({
        type: 'error',
        message: 'Please fill in all required fields',
        duration: 5000
      });
      return;
    }

    update_product_mutation.mutate({
      product_id: selected_product.id,
      data: edit_product_form
    });
  };

  const handle_create_category_submit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!create_category_form.name || !create_category_form.slug) {
      show_toast({
        type: 'error',
        message: 'Please fill in all required fields',
        duration: 5000
      });
      return;
    }

    create_category_mutation.mutate(create_category_form);
  };

  const handle_create_variant_submit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selected_product || !create_variant_form.label || !create_variant_form.quantity) {
      show_toast({
        type: 'error',
        message: 'Please fill in all required fields',
        duration: 5000
      });
      return;
    }

    create_variant_mutation.mutate({
      product_id: selected_product.id,
      data: create_variant_form
    });
  };

  const handle_toggle_active = (product_id: string, current_active: boolean) => {
    toggle_active_mutation.mutate({ product_id, is_active: !current_active });
  };

  const handle_open_edit_modal = (product: Product) => {
    set_selected_product(product);
    set_edit_product_form({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      base_price: product.base_price,
      thumbnail_url: product.thumbnail_url || '',
      category_id: product.category_id || '',
      config_schema: product.config_schema ? JSON.parse(product.config_schema) : null
    });
    set_edit_product_modal_open(true);
  };

  const handle_open_variants_modal = (product: Product) => {
    set_selected_product(product);
    set_variants_modal_open(true);
  };

  const handle_delete_product = (product_id: string) => {
    if (window.confirm('Are you sure you want to deactivate this product?')) {
      delete_product_mutation.mutate(product_id);
    }
  };

  const handle_delete_variant = (variant_id: string) => {
    if (window.confirm('Are you sure you want to delete this variant?')) {
      delete_variant_mutation.mutate(variant_id);
    }
  };

  // Filter products by search query (client-side)
  const filtered_products = products.filter(product => {
    if (!filters.search) return true;
    const search_lower = filters.search.toLowerCase();
    return (
      product.name.toLowerCase().includes(search_lower) ||
      product.description?.toLowerCase().includes(search_lower) ||
      product.category_name?.toLowerCase().includes(search_lower)
    );
  });

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Products & Categories</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Manage your product catalog for direct purchase (no quotes required)
                </p>
              </div>
              <div className="mt-4 sm:mt-0 flex space-x-3">
                <button
                  onClick={() => set_create_category_modal_open(true)}
                  className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors border border-gray-300"
                >
                  Add Category
                </button>
                <button
                  onClick={() => set_create_product_modal_open(true)}
                  className="px-6 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors shadow-sm flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search Input */}
              <div className="md:col-span-2">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search Products
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="search"
                    type="text"
                    value={filters.search}
                    onChange={(e) => handle_search_change(e.target.value)}
                    placeholder="Search by name, description..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  id="category-filter"
                  value={filters.category || ''}
                  onChange={(e) => handle_filter_change('category', e.target.value || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {product_categories.map(cat => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Filter */}
              <div>
                <label htmlFor="active-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="active-filter"
                  value={filters.active === null ? '' : String(filters.active)}
                  onChange={(e) => handle_filter_change('active', e.target.value === '' ? null : e.target.value === 'true')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                >
                  <option value="">All Products</option>
                  <option value="true">Active Only</option>
                  <option value="false">Inactive Only</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading State */}
          {is_loading_products && (
            <div className="flex justify-center py-12">
              <div className="flex items-center space-x-3">
                <svg className="animate-spin h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-600">Loading products...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {fetch_error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">Failed to load products. Please try again.</p>
            </div>
          )}

          {/* Empty State */}
          {!is_loading_products && filtered_products.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-600 mb-6">
                {filters.search || filters.category || filters.active !== null
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first product'}
              </p>
              {(!filters.search && !filters.category && filters.active === null) && (
                <button
                  onClick={() => set_create_product_modal_open(true)}
                  className="px-6 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
                >
                  Create First Product
                </button>
              )}
            </div>
          )}

          {/* Products Table */}
          {!is_loading_products && filtered_products.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Base Price
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Variants
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtered_products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {product.thumbnail_url ? (
                              <img
                                src={product.thumbnail_url}
                                alt={product.name}
                                className="h-12 w-12 rounded-lg object-cover mr-4"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center mr-4">
                                <Package className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            <div className="flex flex-col">
                              <div className="text-sm font-semibold text-gray-900">
                                {product.name}
                              </div>
                              {product.description && (
                                <div className="text-sm text-gray-500 mt-1 line-clamp-1 max-w-xs">
                                  {product.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          {product.category_name ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {product.category_name}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">No category</span>
                          )}
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="flex items-center text-sm font-medium text-gray-900">
                            <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                            {product.base_price.toFixed(2)}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handle_open_variants_modal(product)}
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                          >
                            <Layers className="h-3 w-3 mr-1" />
                            {product.variants_count || 0} variants
                          </button>
                        </td>
                        
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handle_toggle_active(product.id, product.is_active)}
                            disabled={toggle_active_mutation.isPending}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                              product.is_active
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {product.is_active ? (
                              <>
                                <Eye className="h-3 w-3 mr-1" />
                                Active
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3 w-3 mr-1" />
                                Inactive
                              </>
                            )}
                          </button>
                        </td>
                        
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handle_open_edit_modal(product)}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit product"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handle_delete_product(product.id)}
                              disabled={delete_product_mutation.isPending}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Deactivate product"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Product Modal */}
      {create_product_modal_open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Product</h2>
              <button
                onClick={() => set_create_product_modal_open(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handle_create_product_submit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={create_product_form.name}
                  onChange={(e) => set_create_product_form(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  placeholder="e.g., Business Cards"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug *
                </label>
                <input
                  type="text"
                  value={create_product_form.slug}
                  onChange={(e) => set_create_product_form(prev => ({ ...prev, slug: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  placeholder="business-cards"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={create_product_form.description}
                  onChange={(e) => set_create_product_form(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  placeholder="Product description..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={create_product_form.base_price}
                    onChange={(e) => set_create_product_form(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={create_product_form.category_id}
                    onChange={(e) => set_create_product_form(prev => ({ ...prev, category_id: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  >
                    <option value="">Select category</option>
                    {product_categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thumbnail URL
                </label>
                <input
                  type="url"
                  value={create_product_form.thumbnail_url}
                  onChange={(e) => set_create_product_form(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => set_create_product_modal_open(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={create_product_mutation.isPending}
                  className="px-6 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50"
                >
                  {create_product_mutation.isPending ? 'Creating...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {edit_product_modal_open && selected_product && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Edit Product</h2>
              <button
                onClick={() => {
                  set_edit_product_modal_open(false);
                  set_selected_product(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handle_edit_product_submit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={edit_product_form.name}
                  onChange={(e) => set_edit_product_form(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={edit_product_form.description}
                  onChange={(e) => set_edit_product_form(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={edit_product_form.base_price}
                    onChange={(e) => set_edit_product_form(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={edit_product_form.category_id}
                    onChange={(e) => set_edit_product_form(prev => ({ ...prev, category_id: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  >
                    <option value="">Select category</option>
                    {product_categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thumbnail URL
                </label>
                <input
                  type="url"
                  value={edit_product_form.thumbnail_url}
                  onChange={(e) => set_edit_product_form(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    set_edit_product_modal_open(false);
                    set_selected_product(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={update_product_mutation.isPending}
                  className="px-6 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50"
                >
                  {update_product_mutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {create_category_modal_open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create Product Category</h2>
              <button
                onClick={() => set_create_category_modal_open(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handle_create_category_submit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={create_category_form.name}
                  onChange={(e) => set_create_category_form(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  placeholder="e.g., Business Essentials"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug *
                </label>
                <input
                  type="text"
                  value={create_category_form.slug}
                  onChange={(e) => set_create_category_form(prev => ({ ...prev, slug: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  placeholder="business-essentials"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={create_category_form.sort_order}
                  onChange={(e) => set_create_category_form(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => set_create_category_modal_open(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={create_category_mutation.isPending}
                  className="px-6 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50"
                >
                  {create_category_mutation.isPending ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Variants Modal */}
      {variants_modal_open && selected_product && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Product Variants</h2>
                <p className="text-sm text-gray-500">{selected_product.name}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => set_create_variant_modal_open(true)}
                  className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Variant
                </button>
                <button
                  onClick={() => {
                    set_variants_modal_open(false);
                    set_selected_product(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {is_loading_variants ? (
                <div className="flex justify-center py-8">
                  <div className="flex items-center space-x-3">
                    <svg className="animate-spin h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-gray-600">Loading variants...</span>
                  </div>
                </div>
              ) : product_variants.length === 0 ? (
                <div className="text-center py-8">
                  <Layers className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No variants yet. Add quantity-based pricing tiers.</p>
                  <button
                    onClick={() => set_create_variant_modal_open(true)}
                    className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
                  >
                    Add First Variant
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {product_variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="font-medium text-gray-900">{variant.label}</span>
                          {variant.discount_label && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              {variant.discount_label}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          Qty: {variant.quantity} | Unit: ${variant.unit_price.toFixed(2)} | Total: ${variant.total_price.toFixed(2)}
                          {variant.compare_at_price && (
                            <span className="ml-2 line-through text-gray-400">
                              ${variant.compare_at_price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handle_delete_variant(variant.id)}
                        disabled={delete_variant_mutation.isPending}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete variant"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Variant Modal */}
      {create_variant_modal_open && selected_product && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Add Variant</h2>
              <button
                onClick={() => set_create_variant_modal_open(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handle_create_variant_submit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label *
                </label>
                <input
                  type="text"
                  value={create_variant_form.label}
                  onChange={(e) => set_create_variant_form(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  placeholder="e.g., 100 cards"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={create_variant_form.quantity}
                    onChange={(e) => set_create_variant_form(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={create_variant_form.unit_price}
                    onChange={(e) => set_create_variant_form(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={create_variant_form.total_price}
                    onChange={(e) => set_create_variant_form(prev => ({ ...prev, total_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Compare At Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={create_variant_form.compare_at_price || ''}
                    onChange={(e) => set_create_variant_form(prev => ({ ...prev, compare_at_price: e.target.value ? parseFloat(e.target.value) : null }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    placeholder="Optional"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Label
                  </label>
                  <input
                    type="text"
                    value={create_variant_form.discount_label}
                    onChange={(e) => set_create_variant_form(prev => ({ ...prev, discount_label: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    placeholder="e.g., Save 20%"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={create_variant_form.sort_order}
                    onChange={(e) => set_create_variant_form(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => set_create_variant_modal_open(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={create_variant_mutation.isPending}
                  className="px-6 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50"
                >
                  {create_variant_mutation.isPending ? 'Creating...' : 'Add Variant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_ADMIN_ProductsManager;
