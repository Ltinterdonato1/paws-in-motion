
import "server-only";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export type PaymentResult = {
  success: boolean;
  status: PaymentStatus;
  message: string;
};

/**
 * Payment processing is not configured yet.
 *
 * Stripe must be installed and configured before this project
 * can safely create or verify real payments.
 */
export async function processPayment(): Promise<PaymentResult> {
  return {
    success: false,
    status: "pending",
    message:
      "Payments are not configured yet. No payment has been processed.",
  };
}

/**
 * Prevents other code from treating an unverified payment
 * as successful.
 */
export function isPaymentSuccessful(
  status: PaymentStatus
): boolean {
  return status === "paid";
}
