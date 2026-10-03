import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { checkBotId } from "botid/server";
import { extractInvoice } from "../src/lib/openai";
import { handleExtraction } from "../src/lib/extract-request";
import { GET } from "../src/app/api/config/route";
import { getSampleResult } from "../src/lib/samples";
import { liveExtractionEnabled } from "../src/lib/config";

vi.mock("botid/server", () => ({ checkBotId: vi.fn() }));
vi.mock("../src/lib/openai", () => ({ extractInvoice: vi.fn() }));

async function request({ origin = "http://localhost", pages = 1, consent = "true", invalid = false } = {}) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage();
  const form = new FormData();
  form.set("file", new File([invalid ? "not a PDF" : new Uint8Array(await pdf.save())], "invoice.pdf", { type: "application/pdf" }));
  form.set("consent", consent);
  return new Request("http://localhost/api/extract", { method: "POST", headers: { origin }, body: form });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("LIVE_EXTRACTION_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "test-placeholder-not-a-key");
  vi.stubEnv("OPENAI_PROJECT_HARD_LIMIT_CONFIRMED", "true");
  vi.stubEnv("APP_ORIGIN", "");
  vi.stubEnv("VERCEL_BOTID_ENABLED", "false");
  vi.stubEnv("VERCEL_RATE_LIMIT_CONFIRMED", "false");
  vi.mocked(extractInvoice).mockReset().mockResolvedValue({ ...getSampleResult("cad-hst"), meta: { mode: "live", model: "gpt-5.6-sol", duration_ms: 1, input_tokens: 10, output_tokens: 10, estimated_cost_usd: null } });
  vi.mocked(checkBotId).mockReset().mockResolvedValue({ isBot: false, isHuman: true, isVerifiedBot: false, bypassed: false });
});

afterEach(() => vi.unstubAllEnvs());

describe("extraction endpoint", () => {
  it("stays off without keys, a spending declaration, or the kill switch", async () => {
    for (const name of ["LIVE_EXTRACTION_ENABLED", "OPENAI_API_KEY", "OPENAI_PROJECT_HARD_LIMIT_CONFIRMED"]) {
      const previous = process.env[name];
      vi.stubEnv(name, "");
      expect((await handleExtraction(await request())).status).toBe(503);
      vi.stubEnv(name, previous);
    }
    expect(extractInvoice).not.toHaveBeenCalled();
  });

  it("rejects cross-origin, missing consent, fake files, and extra pages before OpenAI", async () => {
    const attempts = [
      [await request({ origin: "https://untrusted.example" }), 403],
      [await request({ consent: "false" }), 400],
      [await request({ invalid: true }), 415],
      [await request({ pages: 3 }), 422],
    ] as const;
    for (const [input, status] of attempts) expect((await handleExtraction(input)).status).toBe(status);
    expect(extractInvoice).not.toHaveBeenCalled();
  });

  it("returns valid extraction results without caching document data", async () => {
    const result = await handleExtraction(await request());
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect((await result.json()).meta.mode).toBe("live");
    expect(extractInvoice).toHaveBeenCalledOnce();
  });

  it("fails closed in hosted environments until all deployment protections are declared", async () => {
    vi.stubEnv("VERCEL", "1");
    expect(liveExtractionEnabled()).toBe(false);
    vi.stubEnv("APP_ORIGIN", "https://demo.example");
    vi.stubEnv("VERCEL_BOTID_ENABLED", "true");
    expect(liveExtractionEnabled()).toBe(false);
    vi.stubEnv("VERCEL_RATE_LIMIT_CONFIRMED", "true");
    expect(liveExtractionEnabled()).toBe(true);
    vi.mocked(checkBotId).mockResolvedValue({ isBot: true, isHuman: false, isVerifiedBot: false, bypassed: false });
    expect((await handleExtraction(await request({ origin: "https://demo.example" }))).status).toBe(403);
    expect(checkBotId).toHaveBeenCalledWith({ advancedOptions: { checkLevel: "basic" } });
    expect(extractInvoice).not.toHaveBeenCalled();
  });

  it("fails closed when browser verification itself is unavailable", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("APP_ORIGIN", "https://demo.example");
    vi.stubEnv("VERCEL_BOTID_ENABLED", "true");
    vi.stubEnv("VERCEL_RATE_LIMIT_CONFIRMED", "true");
    vi.mocked(checkBotId).mockRejectedValue(new Error("internal verification error"));
    const result = await handleExtraction(await request({ origin: "https://demo.example" }));
    expect(result.status).toBe(503);
    expect(extractInvoice).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty response", {}],
    ["an undefined response", undefined],
    ["a missing bot classification", { isHuman: true, bypassed: false }],
    ["an explicit bypass", { isBot: false, isHuman: true, bypassed: true }],
    ["a missing bypass classification", { isBot: false, isHuman: true }],
  ])("rejects %s from browser verification before OpenAI", async (_label, verification) => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("APP_ORIGIN", "https://demo.example");
    vi.stubEnv("VERCEL_BOTID_ENABLED", "true");
    vi.stubEnv("VERCEL_RATE_LIMIT_CONFIRMED", "true");
    vi.mocked(checkBotId).mockResolvedValue(verification as Awaited<ReturnType<typeof checkBotId>>);
    const result = await handleExtraction(await request({ origin: "https://demo.example" }));
    expect(result.status).toBe(403);
    expect(extractInvoice).not.toHaveBeenCalled();
  });

  it("accepts a classified human without a provider bypass in hosted mode", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("APP_ORIGIN", "https://demo.example");
    vi.stubEnv("VERCEL_BOTID_ENABLED", "true");
    vi.stubEnv("VERCEL_RATE_LIMIT_CONFIRMED", "true");
    const result = await handleExtraction(await request({ origin: "https://demo.example" }));
    expect(result.status).toBe(200);
    expect(extractInvoice).toHaveBeenCalledOnce();
  });

  it("never includes credentials or internal readiness details in public config", async () => {
    const result = await GET().json();
    expect(result).toEqual({ live_enabled: true, max_file_bytes: 4_000_000, max_pages: 2, model: "gpt-5.6-sol", turnstile_site_key: null });
    expect(JSON.stringify(result)).not.toContain("test-placeholder");
  });
});
