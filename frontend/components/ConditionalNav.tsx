"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SiteNav from "./marketing/SiteNav";
import { modeFromPath } from "@/lib/mode";
import { LogoMark } from "@/components/ui/LogoMark";

const MARKETING_PATHS = new Set(["/", "/pricing"]);
const AUTH_PATHS      = new Set(["/signin", "/signup"]);
const BUILDER_PATHS   = ["/workflow", "/general", "/app/"];

export default function ConditionalNav() {
  const pathname = usePathname();

  // Marketing pages — full SiteNav with logo + links + CTA
  if (MARKETING_PATHS.has(pathname)) {
    return <SiteNav />;
  }

  // Auth pages — minimal header handled by the auth layout itself
  if (AUTH_PATHS.has(pathname)) return null;

  // Builder / app-entry pages — have their own toolbars or no nav needed
  if (BUILDER_PATHS.some((p) => pathname.startsWith(p))) return null;

  // Internal app pages — shared app nav
  const mode = modeFromPath(pathname);

  return (
    <nav className="sticky top-0 z-40 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
      <div className="max-w-6xl mx-auto px-5 h-13 flex items-center justify-between">

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            aria-label="SoraBase home"
          >
            <LogoMark size={22} className="text-stone-900 dark:text-stone-100" />
            <span className="font-display italic text-[18px] leading-none text-stone-900 dark:text-stone-100">
              SoraBase
            </span>
          </Link>

          <div className="h-3.5 w-px bg-stone-200 dark:bg-stone-700" />

          <div className="flex items-center text-xs">
            <Link
              href="/workflow"
              className={[
                "px-2 py-0.5 rounded transition-colors",
                mode === "recruiting"
                  ? "text-rose-900 dark:text-rose-400 font-semibold"
                  : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300",
              ].join(" ")}
            >
              Recruiting
            </Link>
            <span className="text-stone-300 dark:text-stone-600 select-none">/</span>
            <Link
              href="/general"
              className={[
                "px-2 py-0.5 rounded transition-colors",
                mode === "general"
                  ? "text-rose-900 dark:text-rose-400 font-semibold"
                  : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300",
              ].join(" ")}
            >
              General
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {mode === "general" ? (
            <>
              <NavLink href="/general/dashboard">Dashboard</NavLink>
              <NavLink href="/general">New session</NavLink>
            </>
          ) : (
            <>
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/candidates">Queue</NavLink>
              <div className="w-px h-4 bg-stone-200 dark:bg-stone-700 mx-1" />
              <Link
                href="/workflow"
                className="rounded bg-rose-800 text-white text-xs font-medium px-3 py-1.5 hover:bg-rose-900 transition-colors"
              >
                Workflow
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active   = pathname === href || (href !== "/general" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={[
        "px-3 py-1.5 text-xs font-medium rounded transition-colors",
        active
          ? "text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-800"
          : "text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
