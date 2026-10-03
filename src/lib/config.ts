import type { DemoConfig } from "./contracts";
import { MAX_FILE_BYTES, MAX_PAGES, MODEL } from "./limits";

export function isHostedEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL === "1" || env.NODE_ENV === "production";
}

export function liveExtractionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const enabled = env.LIVE_EXTRACTION_ENABLED === "true"
    && Boolean(env.OPENAI_API_KEY?.trim())
    && env.OPENAI_PROJECT_HARD_LIMIT_CONFIRMED === "true";
  if (!enabled) return false;
  if (!isHostedEnvironment(env)) return true;
  try {
    const origin = new URL(env.APP_ORIGIN ?? "");
    return origin.protocol === "https:"
      && origin.origin === env.APP_ORIGIN
      && env.VERCEL_BOTID_ENABLED === "true"
      && env.VERCEL_RATE_LIMIT_CONFIRMED === "true";
  } catch {
    return false;
  }
}

export function getDemoConfig(): DemoConfig {
  return {
    live_enabled: liveExtractionEnabled(),
    max_file_bytes: MAX_FILE_BYTES,
    max_pages: MAX_PAGES,
    model: MODEL,
    turnstile_site_key: null,
  };
}
