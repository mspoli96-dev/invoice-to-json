import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SAMPLES } from "../src/lib/samples";

async function main() {
  const output = path.resolve("public/samples");
  const expected = path.resolve("fixtures/expected");
  await mkdir(output, { recursive: true });
  await mkdir(expected, { recursive: true });
  const navy = rgb(0.09, 0.14, 0.24);
  const muted = rgb(0.40, 0.45, 0.51);
  const blue = rgb(0.16, 0.30, 0.85);
  for (const sample of SAMPLES) {
    const invoice = sample.invoice;
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Synthetic invoice ${invoice.invoice_number ?? sample.id}`);
    pdf.setAuthor("Webytex");
    pdf.setSubject("Fictional sample document for software testing. Not a real invoice.");
    pdf.setCreationDate(new Date("2026-10-03T00:00:00Z"));
    pdf.setModificationDate(new Date("2026-10-03T00:00:00Z"));
    const page = pdf.addPage([612, 792]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const text = (value: string, x: number, y: number, size = 11, strong = false, color = navy) => {
      page.drawText(value, { x, y, size, font: strong ? bold : font, color });
    };
    const right = (value: string, x: number, y: number, size = 11, strong = false) => {
      const selectedFont = strong ? bold : font;
      text(value, x - selectedFont.widthOfTextAtSize(value, size), y, size, strong);
    };
    const money = (value: number | null) => value === null ? "" : value.toFixed(2);
    page.drawRectangle({ x: 0, y: 773, width: 612, height: 19, color: blue });
    text("SYNTHETIC SAMPLE / NOT A REAL INVOICE", 48, 742, 9, true, blue);
    text("INVOICE", 48, 689, 31, true);
    right(invoice.invoice_number ?? "", 564, 694, 13, true);
    text(invoice.supplier.name ?? "", 48, 652, 16, true);
    text("Fictional supplier for demonstration purposes", 48, 632, 10, false, muted);
    page.drawLine({ start: { x: 48, y: 607 }, end: { x: 564, y: 607 }, thickness: 1, color: rgb(0.87, 0.89, 0.92) });
    text("BILL TO", 48, 579, 9, true, muted);
    text(invoice.customer.name ?? "", 48, 557, 13, true);
    text("ISSUED", 359, 579, 9, true, muted);
    text(invoice.issue_date ?? "", 359, 557);
    if (invoice.due_date) {
      text("DUE", 477, 579, 9, true, muted);
      text(invoice.due_date, 477, 557);
    }
    if (invoice.currency) text(`Currency: ${invoice.currency}`, 48, 516, 10, true);
    page.drawRectangle({ x: 48, y: 469, width: 516, height: 28, color: rgb(0.94, 0.95, 0.97) });
    text("DESCRIPTION", 60, 479, 9, true, muted);
    right("QTY", 347, 479, 9, true);
    right("UNIT PRICE", 450, 479, 9, true);
    right("AMOUNT", 552, 479, 9, true);
    let y = 447;
    for (const item of invoice.line_items) {
      text(item.description ?? "", 60, y, 10);
      right(item.quantity === null ? "" : String(item.quantity), 347, y, 10);
      right(money(item.unit_price), 450, y, 10);
      right(money(item.amount), 552, y, 10);
      page.drawLine({ start: { x: 48, y: y - 15 }, end: { x: 564, y: y - 15 }, thickness: 0.5, color: rgb(0.91, 0.92, 0.94) });
      y -= 40;
    }
    y -= 14;
    text("Subtotal", 358, y);
    right(money(invoice.subtotal), 552, y);
    for (const tax of invoice.taxes) {
      y -= 25;
      const rate = tax.rate === null ? "" : ` (${tax.rate}%)`;
      text(`${tax.label ?? "Tax"}${rate}`, 358, y);
      right(money(tax.amount), 552, y);
    }
    y -= 39;
    page.drawRectangle({ x: 346, y: y - 12, width: 218, height: 38, color: rgb(0.92, 0.94, 1) });
    text("TOTAL", 358, y, 12, true);
    right(`${invoice.currency ? `${invoice.currency} ` : "$ "}${money(invoice.total)}`, 552, y, 15, true);
    text("DEMO DOCUMENT", 48, 121, 9, true, blue);
    text("All companies, transactions and amounts in this document are fictional.", 48, 102, 9, false, muted);
    text("This document is provided only to test invoice extraction software.", 48, 87, 9, false, muted);
    text("Invoice to JSON / Webytex", 48, 45, 9, true, muted);
    right("1 / 1", 564, 45, 9);
    const stem = path.basename(sample.preview_url).replace(/\.(png|pdf)$/, "");
    const pdfPath = path.join(output, `${stem}.pdf`);
    await writeFile(pdfPath, await pdf.save());
    await writeFile(path.join(expected, `${stem}.json`), JSON.stringify(invoice, null, 2) + "\n");
    if (process.argv.includes("--render")) {
      execFileSync("pdftoppm", ["-singlefile", "-r", "120", "-png", pdfPath, path.join(output, stem)], { windowsHide: true });
    }
    console.log(`Created ${stem}.pdf${process.argv.includes("--render") ? " and PNG preview" : ""}`);
  }
}

main().catch(() => {
  console.error("Sample generation failed. Check the sample data and optional Poppler installation.");
  process.exitCode = 1;
});
