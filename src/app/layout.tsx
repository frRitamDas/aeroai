import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/theme-script";
import { TooltipProvider } from "@/components/ui/overlays";

export const metadata: Metadata = {
  metadataBase: new URL("https://aerotext.studio"),
  title: {
    default: "AeroText Studio — AI PDF & image text editor",
    template: "%s · AeroText Studio",
  },
  description:
    "Edit text inside images and PDFs with AI. Detect, erase, replace and restyle text in photos, scans, receipts and PDF pages — then export pixel-perfect PNG, JPEG, WebP or PDF. 100% free, no watermark, nothing leaves your browser.",
  applicationName: "AeroText Studio",
  keywords: [
    "pdf editor",
    "image text editor",
    "edit text in image",
    "photo text editor",
    "receipt text editor",
    "ocr text replacement",
    "inpaint text removal",
    "free pdf editor",
    "photext alternative",
  ],
  authors: [{ name: "AeroText Studio" }],
  creator: "AeroText Studio",
  openGraph: {
    type: "website",
    title: "AeroText Studio — AI PDF & image text editor",
    description:
      "Modify, erase and replace text in images and PDFs without design skills. Runs fully in your browser.",
    siteName: "AeroText Studio",
  },
  twitter: {
    card: "summary_large_image",
    title: "AeroText Studio — AI PDF & image text editor",
    description: "Edit text inside images and PDFs with AI. Free, no watermark, private.",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
  robots: { index: true, follow: true },
  category: "productivity",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#080a12" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        {/* Display font for headings; the editor loads its own text fonts on
            demand, so a single stylesheet here keeps first paint fast.
            eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Caveat:wght@500;600&display=swap"
        />
      </head>
      <body className="min-h-dvh antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
