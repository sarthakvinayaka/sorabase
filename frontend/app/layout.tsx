import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider }              from "@/lib/auth-context";
import { ThemeProvider, ThemeScript } from "@/components/marketing/ThemeProvider";
import ConditionalNav                 from "@/components/ConditionalNav";

export const metadata: Metadata = {
  title: {
    default:  "SoraBase — Meeting Intelligence Platform",
    template: "%s | SoraBase",
  },
  description:
    "SoraBase turns every call, meeting, and transcript into structured, actionable data. Reusable schemas, AI extraction, workflow outputs, and integrations for every team.",
  keywords: [
    "meeting intelligence", "transcript extraction", "structured data",
    "recruiting workflow", "meeting automation",
  ],
  openGraph: {
    siteName:    "SoraBase",
    type:        "website",
    title:       "SoraBase — Meeting Intelligence Platform",
    description: "From every meeting, a structured record.",
    images:      [{ url: "/logo.svg", width: 100, height: 100 }],
  },
  icons: {
    icon:        [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple:       [{ url: "/logo.svg" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Synchronous theme application — prevents flash of unstyled content */}
        <ThemeScript />
      </head>
      <body className="bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 min-h-screen antialiased">
        {/* Skip link — only visible on keyboard focus */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded focus:bg-teal-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
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
