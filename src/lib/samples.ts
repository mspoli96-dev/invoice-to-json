import type { ExtractionResult, Invoice } from "./contracts";
import { checkInvoice } from "./checks";

const baseInvoice: Invoice = {
  document_type: "invoice",
  invoice_number: "DEMO-2026-1042",
  issue_date: "2026-10-01",
  due_date: "2026-10-31",
  supplier: { name: "Maple Office Supply (fictional)" },
  customer: { name: "Northline Studio (fictional)" },
  currency: "CAD",
  line_items: [
    { description: "Recycled paper boxes", quantity: 4, unit_price: 32.5, amount: 130 },
    { description: "Desk organizer sets", quantity: 2, unit_price: 45, amount: 90 },
    { description: "Delivery", quantity: 1, unit_price: 15, amount: 15 },
  ],
  subtotal: 235,
  taxes: [{ label: "HST", rate: 13, amount: 30.55 }],
  total: 265.55,
  notes: ["Synthetic demonstration invoice. No real customer data."],
};

export const SAMPLES: { id: string; name: string; description: string; invoice: Invoice; preview_url: string }[] = [
  {
    id: "cad-hst",
    name: "Canadian invoice",
    description: "A clean CAD invoice with HST and matching totals.",
    invoice: baseInvoice,
    preview_url: "/samples/cad-hst.png",
  },
  {
    id: "missing-currency",
    name: "Missing currency",
    description: "A dollar sign without a currency code stays unresolved.",
    invoice: {
      ...baseInvoice,
      invoice_number: "DEMO-2026-1043",
      currency: null,
      notes: ["Synthetic demonstration invoice. No real customer data.", "The source uses a dollar sign without an explicit currency code. Currency has not been inferred."],
    },
    preview_url: "/samples/missing-currency.png",
  },
  {
    id: "total-mismatch",
    name: "Total mismatch",
    description: "A deliberately incorrect total that needs human review.",
    invoice: {
      ...baseInvoice,
      invoice_number: "DEMO-2026-1044",
      total: 275.55,
      notes: ["Synthetic demonstration invoice. No real customer data.", "The total is transcribed as printed; it has not been corrected."],
    },
    preview_url: "/samples/total-mismatch.png",
  },
];

export function getSampleResult(id: string): ExtractionResult {
  const sample = SAMPLES.find((item) => item.id === id);
  if (!sample) throw new Error("Sample not found.");
  const invoice = structuredClone(sample.invoice);
  return {
    invoice,
    checks: checkInvoice(invoice),
    meta: { mode: "sample", model: null, duration_ms: null, input_tokens: null, output_tokens: null, estimated_cost_usd: null },
  };
}
