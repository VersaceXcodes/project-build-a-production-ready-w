/**
 * LaunchPulse Platform Integration
 *
 * This folder contains auto-generated integrations with the LaunchPulse platform.
 * These files are automatically included when you enable payments for your project.
 *
 * Environment Variables (auto-injected by LaunchPulse):
 * - VITE_LAUNCHPULSE_API_KEY: API token for authentication
 * - VITE_LAUNCHPULSE_PROJECT_ID: Project identifier
 * - VITE_LAUNCHPULSE_API_URL: Platform API URL
 */

// Stripe integration - Stripe-compatible API that proxies through LaunchPulse
export { default as stripe, StripeClient, StripeError } from './stripe';
export type {
  CheckoutSessionCreateParams,
  ProductCreateParams,
  PriceCreateParams,
  CustomerCreateParams,
  SubscriptionStatusParams,
  ListParams,
} from './stripe';

// Subscription hooks - Easy subscription status checking
export {
  useSubscription,
  useHasAccess,
  useSubscriptionExpiringSoon,
} from './useSubscription';
