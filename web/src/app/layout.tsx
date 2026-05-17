import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SoraBase",
    template: "%s | SoraBase",
  },
  description: "Recruiting intake, review console, exports, and staffing analytics.",
  openGraph: {
    siteName: "SoraBase",
    type: "website",
    url: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <header className="border-b border-zinc-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3 text-sm font-medium text-zinc-700">
            <Link className="hover:text-zinc-950" href="/">
              Home
            </Link>
            <Link className="hover:text-zinc-950" href="/analytics">
              Analytics
            </Link>
            <Link className="hover:text-zinc-950" href="/upload">
              Upload audio
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
