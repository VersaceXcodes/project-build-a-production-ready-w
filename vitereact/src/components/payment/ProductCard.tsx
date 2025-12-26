/**
 * ProductCard - Product display with price and purchase button
 *
 * Displays product information and provides checkout functionality.
 */

import React from 'react';
import { CheckoutButton } from './CheckoutButton';

interface ProductCardProps {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  priceId: string;
  imageUrl?: string;
  isSubscription?: boolean;
  interval?: 'month' | 'year';
  features?: string[];
  popular?: boolean;
  className?: string;
}

/**
 * Product display card with integrated checkout
 */
export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  description,
  price,
  currency = 'usd',
  priceId,
  imageUrl,
  isSubscription = false,
  interval = 'month',
  features = [],
  popular = false,
  className = '',
}) => {
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(price / 100);
  };

  return (
    <div className={`
      relative bg-white rounded-xl border
      ${popular ? 'border-[#635BFF] shadow-lg' : 'border-gray-200'}
      overflow-hidden transition-shadow hover:shadow-md
      ${className}
    `}>
      {popular && (
        <div className="absolute top-0 right-0 bg-[#635BFF] text-white text-xs font-medium px-3 py-1 rounded-bl-lg">
          Popular
        </div>
      )}

      {imageUrl && (
        <div className="aspect-video bg-gray-100 overflow-hidden">
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900">{name}</h3>

        {description && (
          <p className="mt-2 text-sm text-gray-600">{description}</p>
        )}

        <div className="mt-4">
          <span className="text-3xl font-bold text-gray-900">
            {formatPrice(price, currency)}
          </span>
          {isSubscription && (
            <span className="text-gray-500 text-sm">/{interval}</span>
          )}
        </div>

        {features.length > 0 && (
          <ul className="mt-4 space-y-2">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <CheckoutButton
            priceId={priceId}
            productName={name}
            mode={isSubscription ? 'subscription' : 'payment'}
            className={`
              w-full py-3 px-4 rounded-lg font-medium transition-colors
              ${popular
                ? 'bg-[#635BFF] hover:bg-[#5850e6] text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
              }
            `}
          >
            {isSubscription ? 'Subscribe' : 'Buy Now'}
          </CheckoutButton>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
