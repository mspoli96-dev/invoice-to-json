import { z } from "zod";
import type { Invoice } from "./contracts";

const text = z.string().max(500).nullable();
const amount = z.number().min(-1_000_000_000).max(1_000_000_000).nullable();

export const invoiceSchema = z.strictObject({
  document_type: z.enum(["invoice", "receipt", "other"]),
  invoice_number: text,
  issue_date: text,
  due_date: text,
  supplier: z.strictObject({ name: text }),
  customer: z.strictObject({ name: text }),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  line_items: z.array(z.strictObject({
    description: text,
    quantity: amount,
    unit_price: amount,
    amount,
  })).max(60),
  subtotal: amount,
  taxes: z.array(z.strictObject({ label: text.describe("Printed tax name or acronym without its percentage, for example HST. The percentage belongs in rate."), rate: amount, amount })).max(10),
  total: amount,
  notes: z.array(z.string().max(600)).max(15),
}) satisfies z.ZodType<Invoice>;
