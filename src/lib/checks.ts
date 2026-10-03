import type { Invoice, InvoiceCheck } from "./contracts";

function decimalUnits(value: number): bigint | null {
  if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000) return null;
  const [coefficient, exponentText = "0"] = value.toString().toLowerCase().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const scale = 6 + Number(exponentText) - fraction.length;
  if (scale < 0) return null;
  return BigInt(whole + fraction) * (10n ** BigInt(scale));
}

function sumMatches(values: (number | null)[], target: number | null): boolean | null {
  if (target === null || values.length === 0 || values.some((value) => value === null)) return null;
  const units = values.map((value) => decimalUnits(value!));
  const expected = decimalUnits(target);
  if (expected === null || units.some((value) => value === null)) return null;
  return units.reduce<bigint>((sum, value) => sum + value!, 0n) === expected;
}

function arithmeticCheck(id: string, title: string, matches: boolean | null, pass: string, warning: string): InvoiceCheck {
  return {
    id,
    status: matches === null ? "unavailable" : matches ? "pass" : "warning",
    title,
    detail: matches === null ? "Not enough comparable values were extracted to run this check." : matches ? pass : warning,
  };
}

export function checkInvoice(invoice: Invoice): InvoiceCheck[] {
  const missing = [
    ["supplier", invoice.supplier.name],
    ["invoice number", invoice.invoice_number],
    ["issue date", invoice.issue_date],
    ["total", invoice.total],
  ].filter(([, value]) => value === null || value === "").map(([name]) => name);

  return [
    {
      id: "document-type",
      status: invoice.document_type === "invoice" ? "pass" : "warning",
      title: "Document type",
      detail: invoice.document_type === "invoice" ? "Identified as an invoice. This is not an authenticity check." : `Identified as ${invoice.document_type === "receipt" ? "a receipt" : "another document type"}. Review whether invoice extraction is appropriate.`,
    },
    {
      id: "required-fields",
      status: missing.length ? "warning" : "pass",
      title: "Core fields",
      detail: missing.length ? `Missing or unreadable: ${missing.join(", ")}.` : "Supplier, invoice number, issue date, and total are present. Verify them against the original.",
    },
    {
      id: "currency",
      status: invoice.currency ? "pass" : "warning",
      title: "Currency",
      detail: invoice.currency ? `${invoice.currency} was extracted. Confirm it against the source.` : "Currency is missing or ambiguous. A dollar sign alone does not identify CAD or USD.",
    },
    arithmeticCheck("line-items", "Line items vs. subtotal", sumMatches(invoice.line_items.map((item) => item.amount), invoice.subtotal), "Line amounts add up to the extracted subtotal.", "Line amounts do not add up to the extracted subtotal. Check discounts, shipping, rounding, or extraction errors."),
    arithmeticCheck("total", "Subtotal + taxes vs. total", invoice.taxes.length ? sumMatches([invoice.subtotal, ...invoice.taxes.map((tax) => tax.amount)], invoice.total) : null, "Subtotal and tax amounts add up to the extracted total.", "Subtotal and tax amounts do not add up to the extracted total. Check the original before using this data."),
  ];
}
