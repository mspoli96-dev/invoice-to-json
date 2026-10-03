import { checkBotId } from "botid/server";
import { isHostedEnvironment, liveExtractionEnabled } from "./config";
import { ExtractionError } from "./errors";
import { readUpload, validateDocument } from "./files";
import { extractInvoice } from "./openai";

export async function handleExtraction(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  try {
    if (!liveExtractionEnabled()) {
      throw new ExtractionError("Live extraction is currently unavailable. Explore a sample invoice instead.", 503);
    }
    const hosted = isHostedEnvironment();
    const allowedOrigin = hosted ? process.env.APP_ORIGIN : new URL(request.url).origin;
    if (request.headers.get("origin") !== allowedOrigin) {
      throw new ExtractionError("Open this demo in your browser to upload a document.", 403);
    }
    const file = await readUpload(request);
    const document = await validateDocument(file);
    if (hosted) {
      let verification;
      try {
        verification = await checkBotId({ advancedOptions: { checkLevel: "basic" } });
      } catch {
        throw new ExtractionError("Browser verification is temporarily unavailable. Please try again later.", 503);
      }
      if (verification?.isBot !== false || verification.bypassed !== false) {
        throw new ExtractionError("Browser verification failed. Please refresh the page and try again.", 403);
      }
    }
    const result = await extractInvoice(document);
    return Response.json(result, { headers });
  } catch (error) {
    const known = error instanceof ExtractionError;
    return Response.json({ error: known ? error.message : "Extraction could not be completed. Please try another document." }, { status: known ? error.status : 500, headers });
  }
}
