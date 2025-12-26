/**
 * Payment Components - Stripe integration for accepting payments
 *
 * Usage:
 * 1. Wrap your app with PaymentProvider
 * 2. Use CheckoutButton for simple purchases (redirects to Stripe Checkout)
 * 3. Use PaymentForm for embedded card forms (requires PaymentIntent)
 * 4. Use ProductCard to display products with integrated checkout
 * 5. Use PaymentSuccess to confirm successful payments
 *
 * Environment Variables Required:
 * - VITE_STRIPE_PUBLISHABLE_KEY: Your Stripe publishable key
 *
 * Backend Endpoints Required:
 * - POST /api/payments/create-checkout: Create checkout session
 * - POST /api/payments/create-intent: Create payment intent
 * - GET /api/payments/session/:id: Get checkout session details
 */

export { PaymentProvider } from './PaymentProvider';
export { CheckoutButton } from './CheckoutButton';
export { PaymentForm } from './PaymentForm';
export { ProductCard } from './ProductCard';
export { PaymentSuccess } from './PaymentSuccess';
