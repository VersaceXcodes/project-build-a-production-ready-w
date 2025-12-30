import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Safely formats a value as money, handling strings, numbers, null, and undefined.
 * This prevents runtime errors when calling .toFixed() on non-number values.
 * 
 * @param value - The value to format (can be number, string, null, undefined)
 * @param currency - The currency symbol to prepend (default: "€")
 * @returns Formatted money string or "-" if value is invalid
 * 
 * @example
 * formatMoney(25) // "€25.00"
 * formatMoney("25") // "€25.00"
 * formatMoney(null) // "-"
 * formatMoney(undefined) // "-"
 */
export function formatMoney(value: unknown, currency = "€"): string {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;

  if (!Number.isFinite(num)) {
    // Fallback so UI never crashes
    return "-";
  }

  return `${currency}${num.toFixed(2)}`;
}
