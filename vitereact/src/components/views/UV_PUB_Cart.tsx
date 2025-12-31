import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { formatMoney } from '@/lib/utils';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface DesignUploadInfo {
  front?: {
    id: string;
    original_filename: string;
    preview_url?: string;
  };
  back?: {
    id: string;
    original_filename: string;
    preview_url?: string;
  };
  page_mapping?: {
    front?: { fileId: string; pageIndex: number };
    back?: { fileId: string; pageIndex: number };
  };
}

interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  product_variant_id: string | null;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
  product_name: string;
  product_slug: string;
  thumbnail_url: string | null;
  variant_label: string | null;
  variant_quantity: number | null;
  config: Record<string, string> | null;
  design_uploads?: DesignUploadInfo;
}

interface CartResponse {
  cart: {
    id: string;
    user_id: string | null;
    guest_id: string | null;
  };
  items: CartItem[];
  subtotal: number;
  guest_id: string | null;
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchCart = async (guestId: string | null, authToken: string | null): Promise<CartResponse> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const headers: Record<string, string> = {};
  if (guestId) headers['x-guest-id'] = guestId;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  const response = await axios.get<CartResponse>(`${API_BASE_URL}/api/cart`, { headers });
  return response.data;
};

const updateCartItem = async (
  itemId: string,
  data: { product_variant_id?: string; quantity?: number },
  guestId: string | null,
  authToken: string | null
): Promise<any> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (guestId) headers['x-guest-id'] = guestId;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  const response = await axios.patch(`${API_BASE_URL}/api/cart/items/${itemId}`, data, { headers });
  return response.data;
};

const removeCartItem = async (
  itemId: string,
  guestId: string | null,
  authToken: string | null
): Promise<void> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const headers: Record<string, string> = {};
  if (guestId) headers['x-guest-id'] = guestId;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  await axios.delete(`${API_BASE_URL}/api/cart/items/${itemId}`, { headers });
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_Cart: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const show_toast = useAppStore(state => state.show_toast);
  const updateCartCount = useAppStore(state => state.update_cart_count);
  
  const [guestId, setGuestId] = useState<string | null>(() => localStorage.getItem('guest_cart_id'));
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  // ===========================
  // DATA FETCHING
  // ===========================

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cart', guestId, authToken],
    queryFn: () => fetchCart(guestId, authToken),
    staleTime: 30000,
  });

  const cart = data?.cart;
  const items = data?.items || [];
  // Safely convert subtotal to number to prevent NaN issues
  const rawSubtotal = data?.subtotal;
  const subtotal = typeof rawSubtotal === 'number' ? rawSubtotal : Number(rawSubtotal) || 0;

  // Save guest ID if returned and sync cart count
  useEffect(() => {
    if (data?.guest_id && !authToken) {
      localStorage.setItem('guest_cart_id', data.guest_id);
      setGuestId(data.guest_id);
    }
    // Sync the global cart count with the fetched items
    if (data?.items) {
      updateCartCount(data.items.length);
    }
  }, [data?.guest_id, data?.items, authToken, updateCartCount]);

  // ===========================
  // ACTIONS
  // ===========================

  const handleRemoveItem = async (itemId: string) => {
    setRemovingItemId(itemId);
    try {
      await removeCartItem(itemId, guestId, authToken);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      show_toast({
        type: 'success',
        message: 'Item removed from cart',
        duration: 3000,
      });
    } catch (err: any) {
      show_toast({
        type: 'error',
        message: 'Failed to remove item',
        duration: 5000,
      });
    } finally {
      setRemovingItemId(null);
    }
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      show_toast({
        type: 'warning',
        message: 'Your cart is empty',
        duration: 3000,
      });
      return;
    }
    navigate('/checkout');
  };

  // Calculate tax (23% VAT)
  const taxRate = 0.23;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // ===========================
  // RENDER
  // ===========================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded w-32 mb-8"></div>
            <div className="bg-white rounded-xl p-6 mb-4">
              <div className="h-24 bg-gray-200 rounded mb-4"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-8">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Cart</h1>
          <Link to="/products" className="text-yellow-600 hover:text-yellow-700 font-medium">
            Continue Shopping
          </Link>
        </div>

        {items.length === 0 ? (
          /* Empty Cart */
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
            <p className="text-gray-600 mb-6">Looks like you haven't added any products yet.</p>
            <Link
              to="/products"
              className="inline-flex items-center px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-xl p-4 sm:p-6 shadow-sm">
                  <div className="flex gap-4">
                    {/* Image */}
                    <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg truncate">
                            {item.product_name}
                          </h3>
                          {item.variant_label && (
                            <p className="text-sm text-gray-500 mt-1">{item.variant_label}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={removingItemId === item.id}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          aria-label="Remove item"
                        >
                          {removingItemId === item.id ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Config Options */}
                      {item.config && Object.keys(item.config).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(item.config).map(([key, value]) => (
                            <span key={key} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                              {value}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Design Upload Info */}
                      {item.design_uploads && (item.design_uploads.front || item.design_uploads.back) && (
                        <div className="mt-3 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-100">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs font-semibold text-yellow-800">Design Files Attached</span>
                          </div>
                          <div className="space-y-1.5">
                            {item.design_uploads.front && (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-yellow-200 text-yellow-800 rounded uppercase">
                                  Front
                                </span>
                                <span className="text-xs text-gray-600 truncate flex-1">
                                  {item.design_uploads.front.original_filename}
                                </span>
                                {item.design_uploads.page_mapping?.front && (
                                  <span className="text-[10px] text-gray-500">
                                    Page {(item.design_uploads.page_mapping.front.pageIndex || 0) + 1}
                                  </span>
                                )}
                              </div>
                            )}
                            {item.design_uploads.back && (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-purple-200 text-purple-800 rounded uppercase">
                                  Back
                                </span>
                                <span className="text-xs text-gray-600 truncate flex-1">
                                  {item.design_uploads.back.original_filename}
                                </span>
                                {item.design_uploads.page_mapping?.back && (
                                  <span className="text-[10px] text-gray-500">
                                    Page {(item.design_uploads.page_mapping.back.pageIndex || 0) + 1}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between">
                        <Link
                          to={`/products/${item.product_slug}?edit=${item.id}`}
                          className="text-sm text-yellow-600 hover:text-yellow-700 font-medium"
                        >
                          Edit details
                        </Link>
                        <span className="font-bold text-gray-900">{formatMoney(item.total_price)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary - Desktop */}
            <div className="hidden lg:block">
              <div className="bg-white rounded-xl p-6 shadow-sm sticky top-28">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
                    <span>{formatMoney(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>VAT (23%)</span>
                    <span>{formatMoney(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery</span>
                    <span className="text-green-600">FREE</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>{formatMoney(total)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 px-6 rounded-lg transition-colors duration-200"
                >
                  Checkout
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  Secure checkout with Stripe
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Sticky Bottom - Order Summary */}
      {items.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm text-gray-600">{items.length} item{items.length !== 1 ? 's' : ''}</span>
              <div className="text-xl font-bold text-gray-900">{formatMoney(total)}</div>
            </div>
            <button
              onClick={handleCheckout}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-8 rounded-lg transition-colors duration-200"
            >
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UV_PUB_Cart;
