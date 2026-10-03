export type Invoice = {
  document_type: "invoice" | "receipt" | "other";
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  supplier: { name: string | null };
  customer: { name: string | null };
  currency: string | null;
  line_items: {
    description: string | null;
    quantity: number | null;
    unit_price: number | null;
    amount: number | null;
  }[];
  subtotal: number | null;
  taxes: { label: string | null; rate: number | null; amount: number | null }[];
  total: number | null;
  notes: string[];
};

export type InvoiceCheck = {
  id: string;
  status: "pass" | "warning" | "unavailable";
  title: string;
  detail: string;
};

export type ExtractionResult = {
  invoice: Invoice;
  checks: InvoiceCheck[];
  meta: {
    mode: "sample" | "live";
    model: string | null;
    duration_ms: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
    estimated_cost_usd: number | null;
  };
};

export type DemoConfig = {
  live_enabled: boolean;
  max_file_bytes: number;
  max_pages: number;
  model: string;
  turnstile_site_key: string | null;
};
