
import "server-only";

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceTotals = {
  subtotal: number;
  tax: number;
  total: number;
};

/**
 * Formats an amount as US dollars.
 */
export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error("Invoice amount must be a valid number.");
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Calculates invoice totals from line items.
 *
 * taxRate is a decimal: 0.10 means 10%.
 * The default tax rate is 0 because tax rules have not been configured.
 */
export function calculateInvoiceTotals(
  items: InvoiceLineItem[],
  taxRate = 0
): InvoiceTotals {
  if (!Number.isFinite(taxRate) || taxRate < 0) {
    throw new Error("Tax rate must be a valid non-negative number.");
  }

  for (const item of items) {
    if (
      !item.description.trim() ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice < 0
    ) {
      throw new Error("One or more invoice line items are invalid.");
    }
  }

  const subtotalInCents = items.reduce(
    (sum, item) =>
      sum + Math.round(item.quantity * item.unitPrice * 100),
    0
  );

  const taxInCents = Math.round(subtotalInCents * taxRate);
  const totalInCents = subtotalInCents + taxInCents;

  return {
    subtotal: subtotalInCents / 100,
    tax: taxInCents / 100,
    total: totalInCents / 100,
  };
}
