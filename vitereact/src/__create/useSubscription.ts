/**
 * useSubscription Hook
 *
 * Easy hook for checking if a customer has an active subscription.
 * Uses the LaunchPulse Stripe proxy to check subscription status.
 *
 * Usage:
 * ```tsx
 * function PremiumContent() {
 *   const { isSubscribed, plan, isLoading } = useSubscription(customerId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (!isSubscribed) return <Paywall />;
 *   return <PremiumFeatures />;
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import stripe from './stripe';

interface SubscriptionStatus {
  isSubscribed: boolean;
  plan: string;
  expiresAt: Date | null;
  subscription: any | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to check subscription status for a customer
 *
 * @param customerId - Stripe customer ID (cus_xxx)
 * @param options - Optional configuration
 * @returns Subscription status object
 */
export function useSubscription(
  customerId: string | null | undefined,
  options: {
    /** Skip fetching (useful when customerId is not yet available) */
    skip?: boolean;
    /** Refetch interval in milliseconds (default: no auto-refetch) */
    refetchInterval?: number;
  } = {}
): SubscriptionStatus {
  const { skip = false, refetchInterval } = options;

  const [status, setStatus] = useState<{
    isSubscribed: boolean;
    plan: string;
    expiresAt: Date | null;
    subscription: any | null;
  }>({
    isSubscribed: false,
    plan: 'free',
    expiresAt: null,
    subscription: null,
  });

  const [isLoading, setIsLoading] = useState(!skip && !!customerId);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!customerId || skip) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await stripe.subscriptions.status({ customerId });

      setStatus({
        isSubscribed: result.isSubscribed,
        plan: result.plan,
        expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
        subscription: result.subscription,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to check subscription'));
      // Don't reset status on error - keep previous state
    } finally {
      setIsLoading(false);
    }
  }, [customerId, skip]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refetch interval
  useEffect(() => {
    if (!refetchInterval || skip || !customerId) return;

    const interval = setInterval(fetchStatus, refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, fetchStatus, skip, customerId]);

  return {
    ...status,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}

/**
 * Hook to check if any of the given features are available based on subscription
 *
 * @param customerId - Stripe customer ID
 * @param requiredPlan - Plan required for access (e.g., 'pro', 'premium')
 * @returns Object with hasAccess boolean
 */
export function useHasAccess(
  customerId: string | null | undefined,
  requiredPlan: string | string[]
): { hasAccess: boolean; isLoading: boolean } {
  const { plan, isSubscribed, isLoading } = useSubscription(customerId);

  const requiredPlans = Array.isArray(requiredPlan) ? requiredPlan : [requiredPlan];

  // Free plan always has access to free features
  if (requiredPlans.includes('free')) {
    return { hasAccess: true, isLoading };
  }

  // Check if user's plan matches any required plan
  const hasAccess = isSubscribed && requiredPlans.includes(plan);

  return { hasAccess, isLoading };
}

/**
 * Check if subscription is about to expire (within specified days)
 */
export function useSubscriptionExpiringSoon(
  customerId: string | null | undefined,
  daysThreshold: number = 7
): { isExpiringSoon: boolean; daysRemaining: number | null; isLoading: boolean } {
  const { expiresAt, isSubscribed, isLoading } = useSubscription(customerId);

  if (!isSubscribed || !expiresAt) {
    return { isExpiringSoon: false, daysRemaining: null, isLoading };
  }

  const now = new Date();
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpiringSoon = daysRemaining <= daysThreshold && daysRemaining > 0;

  return { isExpiringSoon, daysRemaining, isLoading };
}

export default useSubscription;
