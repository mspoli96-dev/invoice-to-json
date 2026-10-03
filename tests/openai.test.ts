import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import type { ResponseUsage } from "openai/resources/responses/responses";
import { estimateModelCost, extractInvoice, getExtractionDiagnostic } from "../src/lib/openai";
import { SAMPLES } from "../src/lib/samples";
import { MODEL } from "../src/lib/limits";
import type { ValidatedDocument } from "../src/lib/files";

const document: ValidatedDocument = { bytes: Buffer.from("synthetic provider fixture"), filename: "invoice.pdf", mediaType: "application/pdf" };
const usage: ResponseUsage = { input_tokens: 1_000, output_tokens: 500, total_tokens: 1_500, input_tokens_details: { cached_tokens: 100, cache_write_tokens: 200 }, output_tokens_details: { reasoning_tokens: 300 } };

function response(overrides: Record<string, unknown> = {}) {
  return {
    status: "completed",
    model: MODEL,
    service_tier: "default",
    usage,
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(SAMPLES[0].invoice) }] }],
    ...overrides,
  };
}

function provider(result = response()) {
  const count = vi.fn().mockResolvedValue({ input_tokens: 2_000 });
  const create = vi.fn().mockResolvedValue(result);
  const client = { responses: { inputTokens: { count }, create } } as unknown as Pick<OpenAI, "responses">;
  return { client, count, create };
}

describe("OpenAI extraction adapter", () => {
  it("counts the same structured request before generation and uses the approved model settings", async () => {
    const { client, count, create } = provider();
    const result = await extractInvoice(document, client);
    expect(count).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    const sent = create.mock.calls[0][0];
    const counted = count.mock.calls[0][0];
    expect(sent).toMatchObject({ model: MODEL, reasoning: { effort: "high" }, store: false, service_tier: "default", max_output_tokens: 8_000, tools: [] });
    expect(counted.input).toEqual(sent.input);
    expect(counted.text).toEqual(sent.text);
    expect(create.mock.calls[0][1]).toMatchObject({ maxRetries: 0, timeout: 120_000 });
    expect(sent.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(result.invoice).toEqual(SAMPLES[0].invoice);
    expect(result.meta.mode).toBe("live");
  });

  it("rejects excessive or unverifiable input before a model generation", async () => {
    for (const tokens of [20_001, NaN, -1]) {
      const { client, count, create } = provider();
      count.mockResolvedValue({ input_tokens: tokens });
      await expect(extractInvoice(document, client)).rejects.toMatchObject({ status: tokens > 20_000 ? 422 : 502 });
      expect(create).not.toHaveBeenCalled();
    }
  });

  it("does not fall back to unbounded generation if token counting fails", async () => {
    const { client, count, create } = provider();
    count.mockRejectedValue(new Error("count unavailable"));
    await expect(extractInvoice(document, client)).rejects.toMatchObject({ status: 502 });
    expect(create).not.toHaveBeenCalled();
  });

  it("handles model refusal and incomplete responses without returning partial invoice data", async () => {
    for (const result of [response({ output: [{ type: "message", content: [{ type: "refusal", refusal: "Cannot process" }] }] }), response({ status: "incomplete" })]) {
      const { client, create } = provider(result);
      await expect(extractInvoice(document, client)).rejects.toMatchObject({ status: 422 });
      expect(create).toHaveBeenCalledOnce();
    }
  });

  it("rejects malformed JSON and schema violations", async () => {
    for (const content of ["not json", JSON.stringify({ ...SAMPLES[0].invoice, confidence: 1 })]) {
      const { client } = provider(response({ output: [{ type: "message", content: [{ type: "output_text", text: content }] }] }));
      await expect(extractInvoice(document, client)).rejects.toMatchObject({ status: 502 });
    }
  });

  it("maps rate limits and timeout errors without retrying or exposing provider details", async () => {
    const failures = [
      [new OpenAI.RateLimitError(429, { code: "project_spend_limit_exceeded" }, "sensitive provider text", new Headers()), 429],
      [new OpenAI.APIConnectionTimeoutError(), 504],
      [new OpenAI.APIUserAbortError(), 504],
      [new OpenAI.AuthenticationError(401, {}, "secret key rejected", new Headers()), 503],
    ] as const;
    for (const [error, status] of failures) {
      const { client, create } = provider();
      create.mockRejectedValue(error);
      await expect(extractInvoice(document, client)).rejects.toMatchObject({ status });
      expect(create).toHaveBeenCalledOnce();
    }
  });

  it("retains only allowlisted failure diagnostics without the provider message or headers", async () => {
    const { client, count, create } = provider();
    count.mockRejectedValue(new OpenAI.BadRequestError(400, { code: "model_not_found" }, "Never expose this provider text", new Headers({ "x-private": "private-value" })));
    const failure = await extractInvoice(document, client).catch((error: unknown) => error);
    expect(getExtractionDiagnostic(failure)).toEqual({ stage: "input_count", upstream_status: 400, provider_code: "model_not_found" });
    expect(JSON.stringify(getExtractionDiagnostic(failure))).not.toContain("private");
    expect(create).not.toHaveBeenCalled();
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain("provider text");
  });
});

describe("model-only cost estimate", () => {
  it("counts cache writes, cache reads, and reasoning output once", () => {
    expect(estimateModelCost(usage, MODEL, new Date("2026-10-03"))).toBe(0.01384);
  });

  it("does not estimate when pricing or usage is uncertain", () => {
    expect(estimateModelCost(usage, "different-model", new Date("2026-10-03"))).toBeNull();
    expect(estimateModelCost(usage, MODEL, new Date("2026-11-22"))).toBeNull();
    expect(estimateModelCost({ ...usage, input_tokens_details: { cached_tokens: 0 } } as ResponseUsage, MODEL, new Date("2026-10-03"))).toBeNull();
    expect(estimateModelCost({ ...usage, input_tokens_details: { cached_tokens: 900, cache_write_tokens: 500 } }, MODEL, new Date("2026-10-03"))).toBeNull();
  });
});
