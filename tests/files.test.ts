import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { readUpload, validateDocument } from "../src/lib/files";
import { MAX_BODY_BYTES, MAX_FILE_BYTES } from "../src/lib/limits";

async function pdfFile(pages: number, encrypted = false) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage();
  if (encrypted) pdf.context.trailerInfo.Encrypt = pdf.context.register(pdf.context.obj({ Filter: "Standard" }));
  return new File([new Uint8Array(await pdf.save())], "test.pdf", { type: "application/pdf" });
}

describe("document validation", () => {
  it("accepts a valid two-page PDF and sanitizes its forwarded filename", async () => {
    const result = await validateDocument(await pdfFile(2));
    expect(result.mediaType).toBe("application/pdf");
    expect(result.filename).toBe("invoice.pdf");
  });

  it("rejects a third page, encryption, and a truncated PDF", async () => {
    await expect(validateDocument(await pdfFile(3))).rejects.toMatchObject({ status: 422 });
    await expect(validateDocument(await pdfFile(1, true))).rejects.toMatchObject({ status: 422 });
    await expect(validateDocument(new File(["%PDF-1.7\ntruncated"], "broken.pdf"))).rejects.toMatchObject({ status: 422 });
  });

  it("checks actual bytes instead of trusting the filename or MIME type", async () => {
    await expect(validateDocument(new File(["<script>bad()</script>"], "invoice.pdf", { type: "application/pdf" }))).rejects.toMatchObject({ status: 415 });
    await expect(validateDocument(new File([], "empty.pdf"))).rejects.toMatchObject({ status: 400 });
    await expect(validateDocument(new File([new Uint8Array(MAX_FILE_BYTES + 1)], "big.pdf"))).rejects.toMatchObject({ status: 413 });
  });

  it("accepts decodable PNG and JPEG images and rejects oversized dimensions", async () => {
    for (const format of ["png", "jpeg"] as const) {
      const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: "white" } }).toFormat(format).toBuffer();
      expect((await validateDocument(new File([new Uint8Array(bytes)], "invoice.any"))).mediaType).toBe(`image/${format}`);
    }
    const tall = await sharp({ create: { width: 1, height: 10_001, channels: 3, background: "white" } }).png().toBuffer();
    await expect(validateDocument(new File([new Uint8Array(tall)], "tall.png"))).rejects.toMatchObject({ status: 422 });
  });

  it("rejects corrupt image data after a plausible magic signature", async () => {
    await expect(validateDocument(new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2])], "broken.png"))).rejects.toMatchObject({ status: 422 });
  });
});

describe("bounded multipart uploads", () => {
  it("requires consent and exactly one file", async () => {
    const form = new FormData();
    form.append("file", await pdfFile(1));
    form.append("consent", "false");
    await expect(readUpload(new Request("http://localhost/api/extract", { method: "POST", body: form }))).rejects.toMatchObject({ status: 400 });
    form.set("consent", "true");
    form.append("file", await pdfFile(1));
    await expect(readUpload(new Request("http://localhost/api/extract", { method: "POST", body: form }))).rejects.toMatchObject({ status: 400 });
  });

  it("enforces the actual stream size even when Content-Length lies", async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(1_000_000)); } });
    const request = new Request("http://localhost/api/extract", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=demo", "content-length": "100" }, body: stream, duplex: "half" } as RequestInit);
    await expect(readUpload(request)).rejects.toMatchObject({ status: 413 });
    expect(pulls).toBeLessThanOrEqual(Math.ceil(MAX_BODY_BYTES / 1_000_000) + 1);
  });
});
