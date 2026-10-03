# Validation

Checked October 3, 2026. Evidence covers local application behaviour, a bounded live OpenAI evaluation, the hosted browser extraction flow, and hosted request protections.

## Local application

| Check | Result | Evidence and limit |
| --- | --- | --- |
| TypeScript | Passed | `npm run typecheck` after the browser-verification fix |
| Automated tests | Passed | 34 tests in four files, including malformed BotID verification-result rejection |
| Production build | Passed | Next.js 16.3.8 on Node.js 24.x, after the browser-verification fix |
| Clean synthetic sample | Passed | CAD 265.55; prepared source and expected JSON |
| Missing currency | Passed | Currency remains `null`; warning shown |
| Printed total mismatch | Passed | CAD 275.55 preserved; arithmetic discrepancy shown |
| JSON export | Passed | Download parsed and deep-compared with the missing-currency fixture |
| Copy JSON | UI confirmed | Success announcement observed; independent clipboard readback unavailable |
| Keyboard tabs | Passed | Right arrow selects JSON; Home selects Overview |
| Local preview | Passed | Synthetic PNG previewed without a provider request |
| Unsupported file | Passed | Markdown upload rejected |
| Sample recovery | Passed | Returning from a local file restores the selected sample |
| Responsive layout | Passed | Desktop inspection and 375 CSS-pixel mobile viewport without horizontal overflow |
| Production browser console | Passed locally | No captured errors or warnings during the local check |
| Disabled live route | Passed | Local configuration reports disabled; POST returns 503 without a provider call |
| Evaluation command | Dry run passed | Default command makes no API calls |
| Source inventory | Bounded check passed | No credential-pattern matches or unexpected private paths found; not a security certification |

Automated tests exercise real PDF parsing, file signatures, image decoding limits, multipart stream limits, schema validation, decimal arithmetic, missing values, request origin, consent, and configuration guards. Mocked provider cases cover counting, refusal, incomplete output, quota, timeout, and unavailable usage metadata. These application tests do not themselves measure model extraction quality.

## Live synthetic evaluation

The final evaluation began at 23:03:42 UTC on October 3, 2026. It used `gpt-5.6-sol`, high reasoning, and the default service tier. Three fictional invoices were evaluated in both PDF and PNG form.

Each fixture compares 11 top-level invoice fields. Notes are excluded; arrays are compared in source order. A matching compound field means its complete serialized value matched the fixture. The result is not a count of independently correct individual cells or tokens.

| Fixture | Compared fields matched | Measured duration | Estimated model cost, USD |
| --- | --- | --- | --- |
| `cad-hst.pdf` | 11 / 11 | 4.061 s | 0.022202 |
| `cad-hst.png` | 11 / 11 | 3.550 s | 0.015827 |
| `missing-currency.pdf` | 11 / 11 | 4.259 s | 0.022202 |
| `missing-currency.png` | 11 / 11 | 3.721 s | 0.015587 |
| `total-mismatch.pdf` | 11 / 11 | 3.626 s | 0.022302 |
| `total-mismatch.png` | 11 / 11 | 3.115 s | 0.015587 |
| **Final pass** | **66 / 66 across 6 fixtures** | **Mean 3.722 s** | **0.113707** |

Durations include token counting and generation inside the adapter. They exclude browser upload and are not end-to-end hosted latency measurements. Cost estimates use returned usage metadata and the configured model rates. They exclude hosting and any separate token-counting charge and are not actual billing receipts.

An earlier pass at 23:02:20 UTC made two requests. The PDF matched; the PNG differed in the `taxes` field because the printed tax label and percentage could be represented ambiguously. The prompt/schema were clarified before the full six-case pass. The eight recorded requests together estimated USD 0.151056 in model usage. The earlier mismatch remains part of the evaluation history.

These fixtures were used to develop and refine the extraction instructions. They are not an independent holdout dataset. The result does not establish production accuracy, customer ROI, robustness to unseen layouts, or universal document compatibility.

Reproduce the method with `npm run evaluate -- --run-paid-evaluation` only with an authorized funded API project and spending controls. The default `npm run evaluate` makes no API requests. Raw evaluation records are retained locally in a Git-ignored directory; this document publishes only the bounded aggregate evidence.

## Public release

- Repository created: [mspoli96-dev/invoice-to-json](https://github.com/mspoli96-dev/invoice-to-json).
- Public demo: [webytex-invoice-to-json.vercel.app](https://webytex-invoice-to-json.vercel.app). The hosted page is available, shows its source links, and reports live extraction enabled.
- Complete hosted browser extraction passed after the strict verification fix: upload `missing-currency.png`, confirm processing, and extract. The result was labelled as AI-extracted, retained `currency: null` with its warning, and returned total 265.55. The interface reported 4.0 seconds and approximately USD 0.0157 in estimated model cost. No browser console errors or warnings were captured.
- A direct request with the valid synthetic document and correct origin, but without valid BotID verification, returned HTTP 403 before contacting OpenAI.
- Hosted rate limit: `POST /api/extract`, three requests per 60 seconds per IP address in each region. After an initial observation-only stage, the enforced rule returned HTTP 429 on the fourth and fifth requests during the release check.
- A USD 5 provider project spending limit was configured and inspected. Its usage display had not yet incorporated the evaluation requests when checked. That display is not evidence that the requests were free or that the cap has been reached and tested.
- The 34-test suite, type checking, and local production build passed after the latest browser-verification fix. Source publication, GitHub CI, and confirmation of the resulting Git-linked deployment remain the final release steps.

The browser smoke test is additional to the eight development evaluation requests above. Its displayed estimate is rounded and is not included in that eight-request aggregate.

The regional request limit is not a global quota. A configured provider spending limit is distinct from observed enforcement at its threshold.
