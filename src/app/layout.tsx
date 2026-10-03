import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";

const uiFont = DM_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const headingFont = Manrope({ subsets: ["latin"], variable: "--font-heading", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Invoice to JSON | Webytex",
  description:
    "Turn an invoice PDF or image into structured JSON you can review. Explore synthetic examples, inspect the checks, and see how a small workflow becomes useful software.",
  applicationName: "Invoice to JSON",
  icons: { icon: "/mark.svg" },
  openGraph: {
    title: "Invoice to JSON | Webytex",
    description: "Paperwork in. Useful data out. Turn an invoice into reviewable JSON.",
    type: "website",
    images: [{ url: "/article-cover.png", width: 1920, height: 1080, alt: "An invoice transformed into structured JSON" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Invoice to JSON | Webytex",
    description: "Paperwork in. Useful data out. Explore the open-source invoice extraction demo.",
    images: ["/article-cover.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${uiFont.variable} ${headingFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
