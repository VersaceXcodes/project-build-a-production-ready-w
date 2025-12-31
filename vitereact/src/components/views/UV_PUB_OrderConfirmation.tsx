import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface OrderItem {
  id: string;
  product_name: string;
  product_slug: string;
  thumbnail_url: string | null;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
  config: Record<string, string> | null;
}

interface Order {
  id: string;
  status: string;
  total_subtotal: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount_due: number;
  issued_at: string;
  paid_at: string | null;
}

interface OrderResponse {
  order: Order;
  items: OrderItem[];
  invoice: Invoice | null;
  payments: any[];
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchOrder = async (orderId: string, authToken: string | null): Promise<OrderResponse> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  const response = await axios.get<OrderResponse>(`${API_BASE_URL}/api/orders/product/${orderId}`, { headers });
  return response.data;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_PUB_OrderConfirmation: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // ===========================
  // DATA FETCHING
  // ===========================

  const { data, isLoading, error } = useQuery({
    queryKey: ['order-confirmation', id],
    queryFn: () => fetchOrder(id!, authToken),
    enabled: !!id,
    staleTime: 60000,
  });

  const order = data?.order;
  const items = data?.items || [];
  const invoice = data?.invoice;

  // ===========================
  // RENDER
  // ===========================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Order not found</h2>
          <Link to="/products" className="text-yellow-600 hover:underline">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const orderDate = new Date(order.created_at).toLocaleDateString('en-IE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8 lg:py-16">
      <div className="max-w-3xl mx-auto px-4">
        {/* Success Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
          <p className="text-lg text-gray-600">
            Thank you for your order. We'll send you updates via email.
          </p>
        </div>

        {/* Order Details Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
          {/* Order Header */}
          <div className="bg-gray-50 px-6 py-4 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm text-gray-500">Order Number</p>
                <p className="font-mono font-semibold text-gray-900">{order.id.slice(0, 8).toUpperCase()}</p>
              </div>
              {invoice && (
                <div className="text-left sm:text-right">
                  <p className="text-sm text-gray-500">Invoice</p>
                  <p className="font-mono font-semibold text-gray-900">{invoice.invoice_number}</p>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-2">Placed on {orderDate}</p>
          </div>

          {/* Items */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Items Ordered</h2>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.product_name}</p>
                    <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    {item.config && Object.keys(item.config).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(item.config).map(([key, value]) => (
                          <span key={key} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">€{Number(item.total_price).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t mt-6 pt-6 space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>€{Number(order.total_subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>VAT (23%)</span>
                <span>€{Number(order.tax_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery</span>
                <span className="text-green-600">FREE</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-xl font-bold text-gray-900">
                <span>Total Paid</span>
                <span>€{Number(order.total_amount).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="bg-green-50 px-6 py-4 border-t">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-green-700 font-medium">Payment Successful</span>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">What happens next?</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-yellow-700 font-bold text-sm">1</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Order Processing</p>
                <p className="text-sm text-gray-600">We'll start preparing your order right away.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-yellow-700 font-bold text-sm">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Production</p>
                <p className="text-sm text-gray-600">Your products will be printed with care.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-yellow-700 font-bold text-sm">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Shipping</p>
                <p className="text-sm text-gray-600">We'll ship your order and send tracking info.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/products"
            className="inline-flex items-center justify-center px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors"
          >
            Continue Shopping
          </Link>
          {authToken && (
            <Link
              to="/app/orders"
              className="inline-flex items-center justify-center px-6 py-3 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-bold rounded-lg transition-colors"
            >
              View All Orders
            </Link>
          )}
        </div>

        {/* Help */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-600">
            Questions about your order?{' '}
            <Link to="/contact" className="text-yellow-600 hover:underline">
              Contact us
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default UV_PUB_OrderConfirmation;
