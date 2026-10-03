import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { ExtractionError } from "./errors";
import { MAX_BODY_BYTES, MAX_FILE_BYTES, MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS, MAX_PAGES } from "./limits";

export type ValidatedDocument = {
  bytes: Buffer;
  mediaType: "application/pdf" | "image/png" | "image/jpeg";
  filename: "invoice.pdf" | "invoice.png" | "invoice.jpg";
};

export async function readUpload(request: Request): Promise<File> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType)) {
    throw new ExtractionError("Upload one PDF, PNG, or JPEG using the upload form.", 415);
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)) {
    throw new ExtractionError("The upload is too large. Choose a file under 4 MB.", 413);
  }
  if (!request.body) throw new ExtractionError("Choose a file to extract.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void reader.cancel();
      reject(new ExtractionError("The upload took too long. Please try again.", 408));
    }, 15_000);
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        void reader.cancel();
        throw new ExtractionError("The upload is too large. Choose a file under 4 MB.", 413);
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new ExtractionError("The upload could not be read. Choose the file again.", 400);
  }
  if ([...form.keys()].some((key) => key !== "file" && key !== "consent") || form.getAll("file").length !== 1 || form.getAll("consent").length !== 1) {
    throw new ExtractionError("Upload exactly one file and confirm document processing.", 400);
  }
  if (form.get("consent") !== "true") {
    throw new ExtractionError("Confirm that this document can be sent to OpenAI for processing.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ExtractionError("Choose a file to extract.", 400);
  return file;
}

export async function validateDocument(file: File): Promise<ValidatedDocument> {
  if (!file.size) throw new ExtractionError("The file is empty. Choose another document.", 400);
  if (file.size > MAX_FILE_BYTES) throw new ExtractionError("The file exceeds the 4 MB limit.", 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    if (!bytes.subarray(-1_024).includes(Buffer.from("%%EOF"))) {
      throw new ExtractionError("This PDF is incomplete or corrupted.", 422);
    }
    let pdf: PDFDocument;
    try {
      pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false });
    } catch {
      throw new ExtractionError("This PDF is corrupted or password-protected. Upload an unlocked PDF or an image.", 422);
    }
    if (pdf.isEncrypted) throw new ExtractionError("Password-protected PDFs are not supported.", 422);
    const pages = pdf.getPageCount();
    if (pages < 1 || pages > MAX_PAGES) throw new ExtractionError("Choose a PDF with 1 or 2 pages.", 422);
    return { bytes, mediaType: "application/pdf", filename: "invoice.pdf" };
  }
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!png && !jpeg) throw new ExtractionError("Only PDF, PNG, and JPEG files are supported. Renaming a file does not change its format.", 415);
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "warning" });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION || metadata.width * metadata.height > MAX_IMAGE_PIXELS || (metadata.pages ?? 1) !== 1) {
      throw new Error("Invalid image dimensions");
    }
    await image.stats();
  } catch {
    throw new ExtractionError("The image is corrupted, animated, or too large. Use a still image up to 20 megapixels and 10,000 pixels per side.", 422);
  }
  return { bytes, mediaType: png ? "image/png" : "image/jpeg", filename: png ? "invoice.png" : "invoice.jpg" };
}
