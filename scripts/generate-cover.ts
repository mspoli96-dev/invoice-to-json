import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const publicDirectory = path.resolve(__dirname, "../public");
const svgPath = path.join(publicDirectory, "article-cover.svg");
const pngPath = path.join(publicDirectory, "article-cover.png");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-labelledby="title description">
  <title id="title">Invoice to JSON by Webytex</title>
  <desc id="description">An original illustration of an invoice becoming structured JSON, with currency CAD and total 265.55. Paperwork in. Useful data out.</desc>
  <defs>
    <filter id="paper-shadow" x="-25%" y="-20%" width="150%" height="160%">
      <feDropShadow dx="0" dy="14" stdDeviation="17" flood-color="#243850" flood-opacity="0.065"/>
    </filter>
    <filter id="data-shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#254fe5" flood-opacity="0.045"/>
    </filter>
  </defs>

  <rect width="1920" height="1080" fill="#f8f7f3"/>

  <g font-family="Arial, Helvetica, sans-serif">
    <g transform="translate(126 96)">
      <rect width="46" height="46" rx="12" fill="#254fe5"/>
      <path d="M18 12h-4v8l-4 3 4 3v8h4m10-22h4v8l4 3-4 3v8h-4" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="65" y="30" fill="#5d6776" font-size="19" letter-spacing="2.7">BY <tspan font-weight="700">WEBYTEX</tspan></text>
    </g>

    <text x="122" y="260" fill="#232a36" font-size="112" font-weight="700" letter-spacing="-5">Invoice <tspan fill="#254fe5">to JSON</tspan></text>
    <text x="128" y="322" fill="#647084" font-size="34" letter-spacing="0.2">Paperwork in. Useful data out.</text>
  </g>

  <g transform="rotate(-6 453 664)">
    <path d="M272 431h286l76 76v380a13 13 0 0 1-13 13H272a13 13 0 0 1-13-13V444a13 13 0 0 1 13-13Z" fill="#fff" stroke="#d8ddd9" stroke-width="2" filter="url(#paper-shadow)"/>
    <path d="M558 432v62a13 13 0 0 0 13 13h62" fill="#f3f5f5" stroke="#d8ddd9" stroke-width="2" stroke-linejoin="round"/>
    <g font-family="Arial, Helvetica, sans-serif">
      <text x="299" y="521" fill="#52647c" font-size="24" font-weight="700" letter-spacing="4">INVOICE</text>
      <text x="300" y="553" fill="#8693a3" font-size="14" letter-spacing="1.3">DEMO-2026-1042</text>
    </g>
    <g fill="#e5e9eb">
      <rect x="300" y="597" width="196" height="8" rx="4"/>
      <rect x="300" y="620" width="140" height="8" rx="4"/>
      <rect x="300" y="678" width="152" height="8" rx="4"/>
      <rect x="540" y="678" width="49" height="8" rx="4"/>
      <rect x="300" y="713" width="183" height="8" rx="4"/>
      <rect x="540" y="713" width="49" height="8" rx="4"/>
      <rect x="300" y="748" width="114" height="8" rx="4"/>
      <rect x="540" y="748" width="49" height="8" rx="4"/>
    </g>
    <path d="M299 649h290M299 782h290" fill="none" stroke="#e5e9eb" stroke-width="1.5"/>
    <g font-family="Arial, Helvetica, sans-serif">
      <text x="300" y="833" fill="#8693a3" font-size="14" letter-spacing="1.8">TOTAL</text>
      <text x="589" y="837" text-anchor="end" fill="#344661" font-size="28" font-weight="700">CAD 265.55</text>
    </g>
  </g>

  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M714 659H891" stroke="#b5c2e9" stroke-width="3" stroke-dasharray="5 12"/>
    <path d="M866 641l22 18-22 18" stroke="#254fe5" stroke-width="4"/>
  </g>

  <g transform="rotate(3 1325 658)">
    <rect x="971" y="453" width="711" height="410" rx="23" fill="#edf1ff" stroke="#d6dffc" stroke-width="2" filter="url(#data-shadow)"/>
    <g font-family="Consolas, 'Liberation Mono', monospace" font-size="27" xml:space="preserve">
      <text x="1018" y="532" fill="#7688b0">{</text>
      <text x="1018" y="594"><tspan fill="#254ab7">  &quot;invoice_number&quot;</tspan><tspan fill="#7688b0">: </tspan><tspan fill="#4c629e">&quot;DEMO-2026-1042&quot;</tspan><tspan fill="#7688b0">,</tspan></text>
      <text x="1018" y="656"><tspan fill="#254ab7">  &quot;currency&quot;</tspan><tspan fill="#7688b0">: </tspan><tspan fill="#4c629e">&quot;CAD&quot;</tspan><tspan fill="#7688b0">,</tspan></text>
      <text x="1018" y="718"><tspan fill="#254ab7">  &quot;total&quot;</tspan><tspan fill="#7688b0">: </tspan><tspan fill="#254fe5">265.55</tspan></text>
      <text x="1018" y="790" fill="#7688b0">}</text>
    </g>
  </g>

  <g font-family="Arial, Helvetica, sans-serif" font-size="16" letter-spacing="2.8" fill="#7f8b9b">
    <text x="421" y="981" text-anchor="middle">PDF / IMAGE</text>
    <text x="1330" y="981" text-anchor="middle">STRUCTURED DATA</text>
  </g>
</svg>`;

async function main() {
  await writeFile(svgPath, svg, "utf8");
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pngPath);
  const metadata = await sharp(pngPath).metadata();
  if (metadata.width !== 1920 || metadata.height !== 1080) {
    throw new Error("The article cover must render at 1920 by 1080 pixels.");
  }
  console.log("Generated public/article-cover.svg and public/article-cover.png (1920 × 1080).");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The article cover could not be generated.");
  process.exitCode = 1;
});
