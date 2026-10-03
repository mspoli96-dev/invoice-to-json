import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SAMPLES } from "../src/lib/samples";
import { validateDocument } from "../src/lib/files";
import { extractInvoice, getExtractionDiagnostic } from "../src/lib/openai";
import { ExtractionError } from "../src/lib/errors";
import { MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS, MODEL } from "../src/lib/limits";
import type { Invoice } from "../src/lib/contracts";

function comparable(invoice: Invoice) {
  const { notes: _notes, ...fields } = invoice;
  return fields;
}

const MAX_EVALUATION_USD = 2;
const MAX_EVALUATION_REQUESTS = 6;
const MODEL_COST_RESERVATION_USD = (MAX_INPUT_TOKENS * 5 + MAX_OUTPUT_TOKENS * 20) / 1_000_000;

async function main() {
  if (!process.argv.includes("--run-paid-evaluation")) {
    console.log("No API requests made. This evaluation uses the six included synthetic PDF/PNG fixtures.");
    console.log("After approving a funded API project, set OPENAI_API_KEY and run npm run evaluate -- --run-paid-evaluation.");
    return;
  }
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_PROJECT_HARD_LIMIT_CONFIRMED !== "true") {
    throw new Error("Configure an authorized API key and confirm its provider-enforced project spending limit before running.");
  }
  if (MODEL !== "gpt-5.6-sol" || new Date() > new Date("2026-11-21T23:59:59.999Z")) {
    throw new Error("Review the model pricing before running this evaluation.");
  }
  const runId = new Date().toISOString().replaceAll(":", "-");
  const destination = path.resolve(".local/evaluations", runId);
  await mkdir(destination, { recursive: true });
  const summary: Record<string, unknown>[] = [];
  let requestsStarted = 0;
  let failure: Record<string, unknown> | null = null;
  async function save() {
    await writeFile(path.join(destination, "results.json"), JSON.stringify({
      run_id: runId,
      dataset: "three synthetic invoices, PDF and raster versions",
      evaluation: "Exact top-level field comparison; notes excluded; arrays compared in source order. This small dataset is not a production accuracy estimate.",
      authorized_evaluation_budget_usd: MAX_EVALUATION_USD,
      requests_started: requestsStarted,
      reserved_model_cost_usd: Number((requestsStarted * MODEL_COST_RESERVATION_USD).toFixed(6)),
      budget_note: "Model-token reservation uses the maximum input/cache-write rate and output cap. It excludes hosting and is not a provider billing receipt. Failed requests retain their reservation. No retries are made.",
      failure,
      results: summary,
    }, null, 2) + "\n");
  }
  console.log(`Evaluation output: ${destination}`);
  for (const sample of SAMPLES) {
    for (const extension of ["pdf", "png"] as const) {
      const stem = path.basename(sample.preview_url, ".png");
      if (requestsStarted >= MAX_EVALUATION_REQUESTS || (requestsStarted + 1) * MODEL_COST_RESERVATION_USD > MAX_EVALUATION_USD) {
        throw new Error("The evaluation request or budget limit has been reached.");
      }
      const bytes = await readFile(path.resolve("public/samples", `${stem}.${extension}`));
      const file = new File([bytes], `${stem}.${extension}`, { type: extension === "pdf" ? "application/pdf" : "image/png" });
      const document = await validateDocument(file);
      requestsStarted++;
      await save();
      let result;
      try {
        result = await extractInvoice(document);
      } catch (error) {
        failure = {
          fixture: `${stem}.${extension}`,
          public_error: error instanceof ExtractionError ? error.message : "The evaluation could not complete this fixture.",
          diagnostic: getExtractionDiagnostic(error),
        };
        await save();
        throw error;
      }
      const expected = comparable(sample.invoice);
      const actual = comparable(result.invoice);
      const fields = Object.keys(expected) as (keyof typeof expected)[];
      const mismatches = fields.filter((field) => JSON.stringify(expected[field]) !== JSON.stringify(actual[field]));
      const record = {
        fixture: `${stem}.${extension}`,
        fields_compared: fields.length,
        fields_matched: fields.length - mismatches.length,
        mismatches,
        exact_fixture_match: mismatches.length === 0,
        result,
      };
      summary.push(record);
      if (mismatches.length) failure = { fixture: `${stem}.${extension}`, reason: "field_mismatch", mismatches };
      await save();
      console.log(`${stem}.${extension}: ${record.fields_matched}/${record.fields_compared} fields matched; ${result.meta.duration_ms} ms`);
      if (failure) throw new Error("The fixture did not match its expected fields. Review the saved result before continuing.");
    }
  }
  console.log(`Saved six fixture results to ${destination}. Review failures before publishing any findings.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof ExtractionError ? error.message : "Evaluation stopped. Review the saved result or local setup before continuing.");
  const diagnostic = getExtractionDiagnostic(error);
  if (diagnostic) console.error(JSON.stringify(diagnostic));
  console.error("Stopped without retrying. Completed results are retained. A failed request may still incur charges.");
  process.exitCode = 1;
});
