"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "@/lib/auth-context";
import { getRedirectForUser } from "@/lib/auth";
import { LogoMark } from "@/components/ui/LogoMark";

export default function SiteNav() {
  const [scrolled,   setScrolled]   = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const { theme, toggleTheme }      = useTheme();
  const { user }                    = useAuth();
  const pathname                    = usePathname();

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 4); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const appHref = user ? getRedirectForUser(user) : "/signin";

  return (
    <header
      aria-label="Site navigation"
      className={[
        "fixed top-0 inset-x-0 z-50 transition-all duration-200",
        scrolled
          ? "bg-stone-50/96 dark:bg-stone-950/96 backdrop-blur-md border-b border-stone-200 dark:border-stone-800"
          : "bg-transparent",
      ].join(" ")}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-[60px] flex items-center justify-between gap-8">

        {/* ── Logo + Wordmark ───────────────────────────────────────────── */}
        <Link
          href="/"
          className="flex-shrink-0 flex items-center gap-2.5 hover:opacity-75 transition-opacity"
          aria-label="SoraBase home"
        >
          <LogoMark size={28} className="text-stone-900 dark:text-stone-100" />
          <span className="font-display italic text-[22px] leading-none text-stone-900 dark:text-stone-100">
            SoraBase
          </span>
        </Link>

        {/* ── Desktop nav links ─────────────────────────────────────────── */}
        <nav className="hidden md:flex items-center gap-0.5" aria-label="Primary">
          <NavLink href="/#how-it-works" current={pathname}>How it works</NavLink>
          <NavLink href="/#modes"        current={pathname}>For teams</NavLink>
          <NavLink href="/pricing"       current={pathname}>Pricing</NavLink>
        </nav>

        {/* ── Desktop right side ────────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />

          <div aria-hidden className="w-px h-4 bg-stone-200 dark:bg-stone-700" />

          {!user && (
            <Link
              href="/signin"
              className="text-[13px] font-medium text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
            >
              Sign in
            </Link>
          )}

          <Link
            href={user ? appHref : "/signup"}
            className="btn-mkt-primary"
          >
            {user ? "Open app" : "Get started"}
          </Link>
        </div>

        {/* ── Mobile controls ───────────────────────────────────────────── */}
        <div className="flex md:hidden items-center gap-1">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
          >
            {menuOpen ? <XIcon /> : <HamburgerIcon />}
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ─────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 px-6 pt-3 pb-5 animate-fade-in">
          <nav className="flex flex-col gap-0.5 mb-4" aria-label="Mobile">
            <MobileNavLink href="/#how-it-works">How it works</MobileNavLink>
            <MobileNavLink href="/#modes">For teams</MobileNavLink>
            <MobileNavLink href="/pricing">Pricing</MobileNavLink>
          </nav>
          <div className="flex flex-col gap-2 pt-4 border-t border-stone-200 dark:border-stone-800">
            {!user && (
              <Link
                href="/signin"
                className="w-full text-center rounded border border-stone-200 dark:border-stone-700 px-4 py-2.5 text-[13px] font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/60 transition-colors"
              >
                Sign in
              </Link>
            )}
            <Link
              href={user ? appHref : "/signup"}
              className="w-full text-center btn-mkt-primary justify-center"
            >
              {user ? "Open app" : "Get started free"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ── Nav link: color-only hover, no background ─────────────────────────────── */
function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: string;
  children: React.ReactNode;
}) {
  const isActive = href === current || (href !== "/" && current.startsWith(href.split("#")[0]));
  return (
    <Link
      href={href}
      className={[
        "px-3 py-1.5 text-[13px] font-medium transition-colors rounded",
        isActive
          ? "text-stone-900 dark:text-stone-100"
          : "text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2.5 text-[13px] font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 rounded transition-colors"
    >
      {children}
    </Link>
  );
}

/* ── Theme toggle ───────────────────────────────────────────────────────────── */
function ThemeToggle({ theme, onToggle }: { theme: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      onClick={onToggle}
      className="w-8 h-8 flex items-center justify-center rounded text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────────────── */
function HamburgerIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="4.5" />
      <path strokeLinecap="round" d="M12 2.5v1.8M12 19.7v1.8M4.22 4.22l1.27 1.27M18.51 18.51l1.27 1.27M2.5 12h1.8M19.7 12h1.8M4.22 19.78l1.27-1.27M18.51 5.49l1.27-1.27" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}
