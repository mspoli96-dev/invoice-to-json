import { describe, expect, it } from "vitest";
import { checkInvoice } from "../src/lib/checks";
import { invoiceSchema } from "../src/lib/invoice-schema";
import { getSampleResult, SAMPLES } from "../src/lib/samples";

describe("invoice review checks", () => {
  it("keeps synthetic examples valid and labels them without invented model metrics", () => {
    for (const sample of SAMPLES) {
      expect(invoiceSchema.safeParse(sample.invoice).success).toBe(true);
      expect(getSampleResult(sample.id).meta).toEqual({ mode: "sample", model: null, duration_ms: null, input_tokens: null, output_tokens: null, estimated_cost_usd: null });
    }
  });

  it("checks a balanced invoice and preserves printed mismatches", () => {
    expect(getSampleResult("cad-hst").checks.every((check) => check.status === "pass")).toBe(true);
    const mismatch = getSampleResult("total-mismatch");
    expect(mismatch.invoice.total).toBe(275.55);
    expect(mismatch.checks.find((check) => check.id === "total")?.status).toBe("warning");
  });

  it("does not infer a currency from Canadian tax and supplier names", () => {
    const result = getSampleResult("missing-currency");
    expect(result.invoice.currency).toBeNull();
    expect(result.checks.find((check) => check.id === "currency")?.status).toBe("warning");
  });

  it("adds decimal amounts exactly rather than using binary floating point", () => {
    const invoice = structuredClone(SAMPLES[0].invoice);
    invoice.line_items = [{ description: "A", quantity: 1, unit_price: 0.1, amount: 0.1 }, { description: "B", quantity: 1, unit_price: 0.2, amount: 0.2 }];
    invoice.subtotal = 0.3;
    invoice.taxes = [{ label: "Tax", rate: null, amount: 0.03 }];
    invoice.total = 0.33;
    expect(checkInvoice(invoice).filter((check) => ["line-items", "total"].includes(check.id)).every((check) => check.status === "pass")).toBe(true);
    invoice.total = 0.34;
    expect(checkInvoice(invoice).find((check) => check.id === "total")?.status).toBe("warning");
  });

  it("preserves missing values and does not assume missing tax is zero", () => {
    const invoice = structuredClone(SAMPLES[0].invoice);
    invoice.line_items[0].amount = null;
    invoice.taxes = [];
    const checks = checkInvoice(invoice);
    expect(checks.find((check) => check.id === "line-items")?.status).toBe("unavailable");
    expect(checks.find((check) => check.id === "total")?.status).toBe("unavailable");
  });

  it("rejects invented fields, nonfinite amounts, and oversized line arrays", () => {
    expect(invoiceSchema.safeParse({ ...SAMPLES[0].invoice, confidence: 0.99 }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...SAMPLES[0].invoice, total: Infinity }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...SAMPLES[0].invoice, line_items: Array(61).fill(SAMPLES[0].invoice.line_items[0]) }).success).toBe(false);
  });
});
