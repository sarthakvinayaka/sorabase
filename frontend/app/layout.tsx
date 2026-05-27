import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider }              from "@/lib/auth-context";
import { ThemeProvider, ThemeScript } from "@/components/marketing/ThemeProvider";
import ConditionalNav                 from "@/components/ConditionalNav";

const BASE = "https://www.sorabase.org";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),

  title: {
    default:  "Sorabase — Meeting Intelligence Platform",
    template: "%s | Sorabase",
  },
  description:
    "Sorabase turns every call, meeting, and transcript into structured, actionable data. Reusable schemas, AI extraction, workflow outputs, and integrations for every team.",
  keywords: [
    "meeting intelligence", "transcript extraction", "structured data",
    "recruiting workflow", "meeting automation",
  ],

  alternates: {
    canonical: BASE,
  },

  openGraph: {
    siteName:    "Sorabase",
    type:        "website",
    url:         BASE,
    title:       "Sorabase — Meeting Intelligence Platform",
    description: "From every meeting, a structured record.",
    images:      [{ url: "/favicon-512.png", width: 512, height: 512, alt: "Sorabase" }],
    locale:      "en_US",
  },

  twitter: {
    card:        "summary",
    title:       "Sorabase — Meeting Intelligence Platform",
    description: "From every meeting, a structured record.",
    images:      ["/favicon-512.png"],
  },

  icons: {
    icon: [
      { url: "/favicon.ico",       sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon.svg",          type: "image/svg+xml" },
    ],
    apple:    [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
    other:    [{ rel: "manifest", url: "/site.webmanifest" }],
  },

  robots: {
    index:             true,
    follow:            true,
    googleBot: {
      index:             true,
      follow:            true,
      "max-snippet":     -1,
      "max-image-preview": "large",
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Synchronous theme application — prevents flash of unstyled content */}
        <ThemeScript />
      </head>
      <body className="bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 min-h-screen antialiased overflow-x-hidden">
        {/* Skip link — only visible on keyboard focus */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded focus:bg-aubergine-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <AuthProvider>
            <ConditionalNav />
            <div id="main-content">{children}</div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
