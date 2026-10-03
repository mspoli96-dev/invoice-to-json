"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Check, CheckCheck, CircleAlert, CircleCheck, CircleMinus, Clipboard, Code2, FileText, Info, LoaderCircle, LockKeyhole, RotateCcw, ScanLine, ShieldCheck, Upload, X } from "lucide-react";
import type { DemoConfig, ExtractionResult, Invoice, InvoiceCheck } from "@/lib/contracts";
import { getSampleResult, SAMPLES } from "@/lib/samples";

const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);
const defaultFileLimit = 4_000_000;

function formatAmount(value: number | null, currency: string | null) {
  if (value === null) return "Not found";
  if (currency) {
    try {
      return new Intl.NumberFormat("en-CA", { style: "currency", currency, currencyDisplay: "code" }).format(value);
    } catch { /* An unsupported currency should not hide the extracted amount. */ }
  }
  return new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function Field({ label, value }: { label: string; value: string | null }) {
  return <div className="data-field"><dt>{label}</dt><dd className={value === null ? "missing-value" : undefined}>{value ?? "Not found"}</dd></div>;
}

function CheckRow({ check }: { check: InvoiceCheck }) {
  const Icon = check.status === "pass" ? CircleCheck : check.status === "warning" ? CircleAlert : CircleMinus;
  return (
    <li className={`check-row check-${check.status}`}>
      <Icon size={16} aria-hidden="true" />
      <div><span className="check-title">{check.title}</span><p>{check.detail}</p></div>
      <span className="check-state">{check.status === "pass" ? "Passed" : check.status === "warning" ? "Review" : "Unavailable"}</span>
    </li>
  );
}

function InvoiceOverview({ invoice }: { invoice: Invoice }) {
  return (
    <div className="invoice-overview">
      <div className="amount-summary"><div><span className="field-label">INVOICE TOTAL</span><strong className={invoice.total === null ? "missing-value" : undefined}>{formatAmount(invoice.total, invoice.currency)}</strong></div><span className="document-type"><FileText size={13} aria-hidden="true" />{invoice.document_type}</span></div>
      <dl className="fields-grid"><Field label="Invoice number" value={invoice.invoice_number} /><Field label="Currency" value={invoice.currency} /><Field label="Issued" value={invoice.issue_date} /><Field label="Due" value={invoice.due_date} /><Field label="From" value={invoice.supplier.name} /><Field label="Billed to" value={invoice.customer.name} /></dl>
      <div className="line-items"><div className="line-items-heading"><h4>Line items</h4><span>{invoice.line_items.length} {invoice.line_items.length === 1 ? "item" : "items"}</span></div>
        {invoice.line_items.length ? <div className="table-scroll" tabIndex={0} aria-label="Invoice line items"><table><thead><tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Amount</th></tr></thead><tbody>{invoice.line_items.map((item, index) => <tr key={`${index}-${item.description}`}><td>{item.description ?? <span className="missing-value">Not found</span>}</td><td>{item.quantity ?? "—"}</td><td>{item.amount === null ? "—" : formatAmount(item.amount, null)}</td></tr>)}</tbody></table></div> : <p className="empty-line-items">No line items were found.</p>}
        <dl className="totals-list"><div><dt>Subtotal</dt><dd>{formatAmount(invoice.subtotal, null)}</dd></div>{invoice.taxes.map((tax, index) => <div key={`${index}-${tax.label}`}><dt>{tax.label ?? "Tax"}{tax.rate === null ? "" : ` (${tax.rate}%)`}</dt><dd>{formatAmount(tax.amount, null)}</dd></div>)}</dl>
      </div>
      {invoice.notes.length ? <div className="invoice-notes"><Info size={15} aria-hidden="true" /><div><h4>Extraction notes</h4><ul>{invoice.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></div></div> : null}
    </div>
  );
}

function JsonView({ value }: { value: string }) {
  return <div className="json-view" tabIndex={0} aria-label="Invoice JSON"><div className="code-file"><Code2 size={14} aria-hidden="true" /><span>invoice.json</span><span className="code-format">JSON</span></div><pre><code>{value.split("\n").map((line, index) => <span className="code-line" key={index}><span className="line-number" aria-hidden="true">{index + 1}</span><span>{line.split(/("(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*"|\bnull\b|\b\d+(?:\.\d+)?\b)/g).map((token, tokenIndex) => <span key={tokenIndex} className={token.endsWith(":") ? "json-key" : token.startsWith('"') ? "json-string" : token === "null" ? "json-null" : /^\d/.test(token) ? "json-number" : undefined}>{token}</span>)}</span></span>)}</code></pre></div>;
}

export function InvoiceWorkspace() {
  const [config, setConfig] = useState<DemoConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [sampleId, setSampleId] = useState<string | null>(SAMPLES[0].id);
  const [result, setResult] = useState<ExtractionResult | null>(() => getSampleResult(SAMPLES[0].id));
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [processingRequested, setProcessingRequested] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "json">("overview");
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overviewTab = useRef<HTMLButtonElement>(null);
  const jsonTab = useRef<HTMLButtonElement>(null);
  const selectedSample = SAMPLES.find((sample) => sample.id === sampleId);
  const liveEnabled = config?.live_enabled === true;
  const maxFileBytes = config?.max_file_bytes ?? defaultFileLimit;
  const json = result ? JSON.stringify(result.invoice, null, 2) : "";
  const previewUrl = fileUrl ?? selectedSample?.preview_url;
  const isPdf = file ? file.type === "application/pdf" || /\.pdf$/i.test(file.name) : Boolean(previewUrl?.endsWith(".pdf"));
  const warnings = result?.checks.filter((check) => check.status === "warning").length ?? 0;
  const unavailable = result?.checks.filter((check) => check.status === "unavailable").length ?? 0;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Configuration unavailable"); return response.json() as Promise<DemoConfig>; })
      .then(setConfig)
      .catch((cause: unknown) => { if (!(cause instanceof Error && cause.name === "AbortError")) setConfigError(true); });
    return () => { controller.abort(); request.current?.abort(); if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);

  useEffect(() => {
    if (!file) { setFileUrl(null); return; }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectSample(id: string) {
    request.current?.abort();
    setSampleId(id);
    setFile(null);
    setResult(getSampleResult(id));
    setConsent(false);
    setProcessingRequested(false);
    setError(null);
    setCopied(false);
    if (fileInput.current) fileInput.current.value = "";
    setAnnouncement("Sample loaded. This is saved example data. No AI request was made.");
  }

  function selectFile(candidate: File | undefined) {
    if (!candidate || busy) return;
    setError(null);
    if (!allowedTypes.has(candidate.type) && !(candidate.type === "" && /\.(pdf|png|jpe?g)$/i.test(candidate.name))) {
      setError("Choose a PDF, PNG, or JPEG file.");
      return;
    }
    if (candidate.size > maxFileBytes) {
      setError(`This file is too large. Choose a file under ${(maxFileBytes / 1_000_000).toFixed(0)} MB.`);
      return;
    }
    if (candidate.size === 0) { setError("This file is empty. Please choose another document."); return; }
    setFile(candidate);
    setSampleId(null);
    setResult(null);
    setConsent(false);
    setProcessingRequested(false);
    setCopied(false);
    setAnnouncement(`${candidate.name} selected. Your document has not been sent.`);
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 1) { setError("Please choose one invoice at a time."); return; }
    selectFile(event.dataTransfer.files[0]);
  }

  async function extract() {
    if (!file || !consent || !liveEnabled || busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setProcessingRequested(true);
    setError(null);
    setResult(null);
    setAnnouncement("Reading your invoice. This can take a moment.");
    const body = new FormData();
    body.append("file", file);
    body.append("consent", "true");
    try {
      const response = await fetch("/api/extract", { method: "POST", body, signal: controller.signal });
      const data: ExtractionResult | { error: string } = await response.json();
      if (!response.ok || "error" in data) throw new Error("error" in data ? data.error : "The invoice could not be processed. Please try again.");
      setResult(data);
      setActiveTab("overview");
      setAnnouncement("Your result is ready. Review the invoice details and checks before using the JSON.");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") setAnnouncement("Extraction cancelled. The server may already have received the document.");
      else setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally { setBusy(false); request.current = null; }
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setAnnouncement("Invoice JSON copied to clipboard.");
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2400);
    } catch { setError("Clipboard access is unavailable. Use Download JSON instead."); }
  }

  function downloadJson() {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `invoice-${result?.invoice.invoice_number?.replace(/[^a-zA-Z0-9_-]/g, "_") ?? "result"}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setAnnouncement("Invoice JSON download started.");
  }

  function switchTab(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "overview" : event.key === "End" ? "json" : activeTab === "overview" ? "json" : "overview";
    setActiveTab(next);
    (next === "overview" ? overviewTab : jsonTab).current?.focus();
  }

  return (
    <section className="workspace-section" id="workspace" aria-labelledby="workspace-title">
      <div className="workspace-heading"><div><span className="eyebrow">THE INTERACTIVE DEMO</span><h2 id="workspace-title">See what’s inside an invoice.</h2></div><span className="workspace-status"><span className={liveEnabled ? "status-dot live" : "status-dot"} />{liveEnabled ? "Live extraction available" : "Explore with sample data"}</span></div>
      <div className="workspace">
        <div className="sample-toolbar"><span className="sample-intro">Try an example</span><div className="sample-options" role="group" aria-label="Choose a synthetic invoice">{SAMPLES.map((sample, index) => <button key={sample.id} className={`sample-button ${sampleId === sample.id ? "selected" : ""}`} onClick={() => selectSample(sample.id)} aria-pressed={sampleId === sample.id} title={sample.description} disabled={busy}><span className="sample-index">0{index + 1}</span>{sample.name}{sampleId === sample.id ? <Check size={13} aria-hidden="true" /> : null}</button>)}</div></div>
        <div className="workspace-body">
          <div className="document-panel">
            <div className="panel-heading"><h3><span className="panel-number">01</span> Your document</h3><span className="panel-hint">INPUT</span></div>
            <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={dropFile}>
              <input type="file" ref={fileInput} id="invoice-upload" className="visually-hidden" accept="application/pdf,image/png,image/jpeg" onChange={(event) => selectFile(event.target.files?.[0])} disabled={busy} aria-label="Upload an invoice" tabIndex={-1} />
              <span className="upload-symbol"><Upload size={19} strokeWidth={1.7} aria-hidden="true" /></span><div><p><button type="button" className="file-picker" onClick={() => fileInput.current?.click()} disabled={busy}>Choose a file</button><span> or drag it here</span></p><span className="upload-limits">PDF, PNG, JPG · up to {(maxFileBytes / 1_000_000).toFixed(0)} MB{config ? ` · ${config.max_pages} pages max` : ""}</span></div>
            </div>
            <div className="document-preview-header"><div><FileText size={14} aria-hidden="true" /><span title={file?.name ?? selectedSample?.name}>{file?.name ?? `${selectedSample?.id ?? "sample"}.pdf`}</span></div>{file ? <button className="icon-button" onClick={() => selectSample(SAMPLES[0].id)} aria-label="Remove file and return to the sample" disabled={busy}><X size={15} /></button> : <span className="synthetic-label">FICTIONAL EXAMPLE</span>}</div>
            <div className={`document-stage ${isPdf ? "pdf-stage" : ""}`}>
              {previewUrl ? isPdf ? <iframe src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`} title={`Preview of ${file?.name ?? selectedSample?.name ?? "invoice"}`} className="pdf-preview" /> : <Image src={previewUrl} alt={file ? `Preview of ${file.name}` : `Fictional invoice: ${selectedSample?.description ?? selectedSample?.name}`} width={816} height={1056} unoptimized className="document-image" priority /> : <div className="preview-placeholder"><FileText size={32} /><p>Your document will appear here.</p></div>}
              {!file ? <span className="paper-corner" aria-hidden="true" /> : null}
            </div>
            <div className="document-caption">{file ? <><LockKeyhole size={13} aria-hidden="true" /><span>{processingRequested ? "Processing was requested. Review the result or message." : "Preview only. Your file has not been sent."}</span>{fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer" aria-label="Open your original document in a new tab"><ArrowUpRight size={14} /></a> : null}</> : <><Info size={13} aria-hidden="true" /><span>Synthetic invoice. No real customer data.</span>{selectedSample ? <a href={selectedSample.preview_url.replace(/\.(png|webp|jpg)$/i, ".pdf")} download className="sample-download">PDF <ArrowDownToLine size={12} aria-hidden="true" /></a> : null}</>}</div>
            {file ? <div className="extraction-controls">{liveEnabled ? <><label className="consent-label"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={busy} /><span>I have permission to share this document and agree to send it to OpenAI for extraction.</span></label><p className="privacy-note">Use a sample or a redacted document. Uploaded contents are processed by OpenAI; do not include sensitive information.</p><button className="button button-primary extract-button" onClick={extract} disabled={!consent || busy}>{busy ? <><LoaderCircle size={17} className="spin" aria-hidden="true" />Reading your invoice…</> : <><ScanLine size={17} aria-hidden="true" />Extract invoice<ArrowRight size={16} aria-hidden="true" /></>}</button>{busy ? <button className="cancel-button" onClick={() => request.current?.abort()}>Cancel request</button> : null}</> : <div className="mode-note"><Info size={16} aria-hidden="true" /><div><strong>Live extraction is currently off.</strong><p>You can preview your file here. Choose an example above to explore a complete result.</p><button className="text-button" onClick={() => selectSample(SAMPLES[0].id)}>Try a sample <ArrowRight size={13} aria-hidden="true" /></button></div></div>}</div> : null}
          </div>

          <div className="result-panel" aria-busy={busy}>
            <div className="panel-heading"><h3><span className="panel-number">02</span> Structured result</h3><span className="panel-hint">OUTPUT</span></div>
            <div className="result-toolbar"><div className="result-tabs" role="tablist" aria-label="Result view"><button id="overview-tab" ref={overviewTab} role="tab" aria-selected={activeTab === "overview"} aria-controls="result-view" tabIndex={activeTab === "overview" ? 0 : -1} onKeyDown={switchTab} onClick={() => setActiveTab("overview")} className={activeTab === "overview" ? "active" : ""}>Overview</button><button id="json-tab" ref={jsonTab} role="tab" aria-selected={activeTab === "json"} aria-controls="result-view" tabIndex={activeTab === "json" ? 0 : -1} onKeyDown={switchTab} onClick={() => setActiveTab("json")} className={activeTab === "json" ? "active" : ""}><Code2 size={13} aria-hidden="true" />JSON</button></div><button className="copy-button" onClick={copyJson} disabled={!result || busy} aria-label={copied ? "JSON copied" : "Copy invoice JSON"}>{copied ? <CheckCheck size={14} aria-hidden="true" /> : <Clipboard size={14} aria-hidden="true" />}<span>{copied ? "Copied" : "Copy"}</span></button></div>
            {error ? <div className="error-message" role="alert"><CircleAlert size={17} aria-hidden="true" /><p>{error}</p><button className="icon-button" onClick={() => setError(null)} aria-label="Dismiss error"><X size={14} /></button></div> : null}
            {result ? <>
              <div className={`result-origin ${result.meta.mode === "sample" ? "sample-origin" : "live-origin"}`}>{result.meta.mode === "sample" ? <><span className="origin-dot" /><span>Sample data · no AI request</span></> : <><ScanLine size={13} aria-hidden="true" /><span>AI-extracted · review before using</span></>}<span className="ready-label">{result.meta.mode === "sample" ? "PREVIEW" : "READY"}</span></div>
              <div id="result-view" role="tabpanel" aria-labelledby={activeTab === "overview" ? "overview-tab" : "json-tab"} tabIndex={0}>{activeTab === "overview" ? <InvoiceOverview invoice={result.invoice} /> : <JsonView value={json} />}</div>
              <section className="checks-section" aria-label="Document checks"><div className="checks-heading"><h4><ShieldCheck size={16} aria-hidden="true" />A second look</h4><span className={warnings ? "checks-attention" : "checks-count"}>{warnings ? `${warnings} to review` : unavailable ? `${unavailable} unavailable` : "Checks passed"}</span></div><ul className="checks-list">{result.checks.map((check) => <CheckRow key={check.id} check={check} />)}</ul><p className="checks-disclaimer">Checks flag common issues. They don’t verify that every value matches the document.</p></section>
              <div className="result-actions"><button className="button button-primary download-button" onClick={downloadJson}><ArrowDownToLine size={16} aria-hidden="true" />Download JSON</button><span>Yours to use.<br />Always worth a review.</span></div>
              {result.meta.mode === "live" ? <div className="extraction-meta"><span>{result.meta.model ?? "OpenAI extraction"}</span>{result.meta.duration_ms !== null ? <span>{(result.meta.duration_ms / 1000).toFixed(1)}s</span> : null}{result.meta.estimated_cost_usd !== null ? <span>Est. ${result.meta.estimated_cost_usd.toFixed(4)} USD</span> : null}</div> : null}
            </> : <div className="result-empty"><div className={`empty-icon ${busy ? "reading" : ""}`}>{busy ? <LoaderCircle size={31} className="spin" aria-hidden="true" /> : <BracesIcon />}</div><h4>{busy ? "Finding the useful details." : "Your data will go here."}</h4><p>{busy ? "Reading the document, organizing the fields, and checking the numbers. Please keep this page open." : liveEnabled ? "Choose an invoice and approve extraction to turn the document into structured data." : "Live extraction is currently off. The examples above show exactly how the review experience works."}</p>{!busy ? <button className="button button-secondary" onClick={() => selectSample(SAMPLES[0].id)}><RotateCcw size={14} aria-hidden="true" />Back to a sample</button> : <div className="loading-steps"><span><Check size={13} />Document ready</span><span><LoaderCircle size={13} className="spin" />Extracting fields</span></div>}</div>}
          </div>
        </div>
        <div className="workspace-bottom-note"><LockKeyhole size={13} aria-hidden="true" /><span>{liveEnabled ? "Files are sent only when you approve and select Extract invoice." : configError ? "Live settings are unavailable. The sample experience still works." : "Examples run in your browser. Nothing is uploaded and no AI credits are used."}</span><span className="bottom-format">DOCUMENT → JSON</span></div>
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>
    </section>
  );
}

function BracesIcon() {
  return <Code2 size={31} strokeWidth={1.3} aria-hidden="true" />;
}
