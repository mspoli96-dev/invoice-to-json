import { ArrowDown, ArrowRight, ArrowUpRight, Braces, Code2, FileText } from "lucide-react";
import { InvoiceWorkspace } from "@/components/invoice-workspace";

const contactUrl = "https://business.webytex.com/#quick-contact";
const trackedContactUrl = "https://business.webytex.com/?utm_source=invoice_to_json&utm_medium=demo&utm_campaign=open_source#quick-contact";
const repositoryUrl = process.env.NEXT_PUBLIC_REPOSITORY_URL;

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#workspace">Skip to the workspace</a>
      <header className="site-header page-width">
        <a className="wordmark" href="#" aria-label="Invoice to JSON home">
          <span className="brand-symbol" aria-hidden="true"><Braces size={24} strokeWidth={2.1} /></span>
          <span className="brand-name">Invoice to JSON<span className="brand-by">by <strong>WEBYTEX</strong></span></span>
        </a>
        <nav className="header-nav" aria-label="Main navigation">
          <a className="nav-how" href="#how-it-works">How it works</a>
          {repositoryUrl ? <a href={repositoryUrl} target="_blank" rel="noreferrer" className="repo-link"><Code2 size={16} aria-hidden="true" /><span>View source</span><ArrowUpRight size={13} aria-hidden="true" /></a> : null}
          <a href={trackedContactUrl} className="nav-contact" target="_blank" rel="noreferrer" aria-label="Contact Webytex"><span className="nav-contact-long" aria-hidden="true">Let’s build something</span><span className="nav-contact-short" aria-hidden="true">Let’s talk</span><ArrowUpRight size={16} aria-hidden="true" /></a>
        </nav>
      </header>

      <main>
        <section className="hero page-width" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> SMALL WORKFLOWS. REAL POSSIBILITIES.</p>
            <h1 id="page-title">Paperwork in.<br /><span>Useful data out.</span></h1>
            <p className="hero-description">Turn an invoice into structured JSON.<br className="desktop-break" /> Review the details. Catch the gaps. Keep things moving.</p>
            <a className="hero-link" href="#workspace">Explore the demo <ArrowDown size={17} aria-hidden="true" /></a>
          </div>
          <div className="hero-diagram" aria-hidden="true">
            <div className="diagram-label">FROM DOCUMENT TO DATA</div>
            <div className="diagram-flow">
              <div className="mini-document"><FileText size={24} strokeWidth={1.3} /><span /><span /><span className="short" /><div className="document-stamp">INVOICE</div></div>
              <div className="flow-connector"><span /><ArrowRight size={18} /></div>
              <div className="mini-code"><span>{"{"}</span><p><b>"total"</b>: 265.55,</p><p><b>"currency"</b>: "CAD"</p><span>{"}"}</span></div>
            </div>
            <p>A little less manual work.<br />A lot more room for what matters.</p>
          </div>
        </section>

        <div className="page-width"><InvoiceWorkspace /></div>

        <section className="how-section page-width" id="how-it-works" aria-labelledby="how-title">
          <div className="section-intro"><p className="eyebrow">THE WORKFLOW</p><h2 id="how-title">Simple on the surface.<br />{" "}Thoughtful underneath.</h2><p>A focused example of where AI can help with the everyday work between documents and your systems.</p></div>
          <div className="steps-grid">
            <article><span className="step-number">01 / INPUT</span><h3>Start with a document</h3><p>A PDF, a scan, or a photo of an invoice. Try the included fictional examples to explore the entire review flow.</p></article>
            <article><span className="step-number">02 / REVIEW</span><h3>Make the gaps visible</h3><p>Missing values stay empty. Arithmetic checks flag inconsistencies. The original stays in view so you can check the details.</p></article>
            <article><span className="step-number">03 / USE</span><h3>Take the data with you</h3><p>Copy or download a predictable JSON structure. It’s a starting point for the workflow your business actually needs.</p></article>
          </div>
        </section>

        <section className="contact-section page-width" aria-labelledby="contact-title">
          <div><p className="eyebrow">YOUR PROCESS COULD BE NEXT</p><h2 id="contact-title">What’s still being<br />{" "}done by hand?</h2></div>
          <div className="contact-copy"><p>We build practical software and AI workflows for businesses. Bring us one repetitive process. We’ll help scope a useful first version.</p><a className="button button-primary contact-button" href={trackedContactUrl} target="_blank" rel="noreferrer">Talk to Webytex <ArrowUpRight size={18} aria-hidden="true" /></a><span className="contact-footnote">A conversation about your workflow. No big pitch.</span></div>
        </section>
      </main>

      <footer className="site-footer page-width">
        <div className="footer-brand"><a href={contactUrl} target="_blank" rel="noreferrer">WEBYTEX <ArrowUpRight size={13} aria-hidden="true" /></a><span>Small tools. Useful possibilities.</span></div>
        <div className="footer-details"><p>Built with Next.js and TypeScript. Live extraction uses OpenAI. Developed with AI assistance and human direction.</p><p>This is a focused demonstration. Review every result before using it in a business process. {repositoryUrl ? <a href={repositoryUrl} target="_blank" rel="noreferrer">Explore the code <ArrowUpRight size={12} aria-hidden="true" /></a> : <span>Source publication is being prepared.</span>}</p></div>
      </footer>
    </>
  );
}
