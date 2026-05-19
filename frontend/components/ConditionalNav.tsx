"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import SiteNav from "./marketing/SiteNav";
import { modeFromPath } from "@/lib/mode";
import { LogoMark } from "@/components/ui/LogoMark";
import { useRecordingStatus } from "@/lib/useExtensionStatus";
import { useAuth } from "@/lib/auth-context";

const MARKETING_PATHS = new Set(["/", "/pricing"]);
const AUTH_PATHS      = new Set(["/signin", "/signup"]);

// Returns true for pages that manage their own toolbar / layout header
function isNavSuppressed(pathname: string): boolean {
  // Canvas builder pages — have their own Toolbar component
  if (pathname === "/workflow" || pathname === "/general") return true;
  // App gate pages — have their own page-level headers
  if (pathname === "/entry" || pathname.startsWith("/onboarding")) return true;
  // General Mode focused-flow step pages — full-screen workspaces with own headers
  if (
    pathname.startsWith("/general/processing") ||
    pathname.startsWith("/general/schema") ||
    pathname.startsWith("/general/results")
  ) return true;
  // Study Mode focused-flow pages — full-screen workspaces with own headers
  if (pathname === "/study") return true;
  if (
    pathname.startsWith("/study/processing") ||
    pathname.startsWith("/study/review") ||
    pathname.startsWith("/study/flashcards")
  ) return true;
  return false;
}

export default function ConditionalNav() {
  const pathname  = usePathname();
  const { recording } = useRecordingStatus();

  // Marketing pages — full SiteNav with logo + links + CTA
  if (MARKETING_PATHS.has(pathname)) {
    return <SiteNav />;
  }

  // Auth pages — minimal header handled by the auth layout itself
  if (AUTH_PATHS.has(pathname)) return null;

  // Builder / focused-flow pages — suppress shared nav
  if (isNavSuppressed(pathname)) return null;

  // Internal app pages — shared app nav
  const mode    = modeFromPath(pathname);
  // Logo routes authenticated users to their mode home, not the marketing site
  const appHome = mode === "general" ? "/general/dashboard"
                : mode === "study"   ? "/study/dashboard"
                : "/dashboard";

  return (
    <nav className="sticky top-0 z-40 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
      <div className="max-w-6xl mx-auto px-5 h-13 flex items-center justify-between">

        <div className="flex items-center gap-3">
          <Link
            href={appHome}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            aria-label="SoraBase home"
          >
            <LogoMark size={22} className="text-stone-900 dark:text-stone-100" />
            <span className="font-display italic text-[18px] leading-none text-stone-900 dark:text-stone-100">
              SoraBase
            </span>
          </Link>

          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5">
            <ModeTab href="/workflow"        active={mode === "recruiting"}>Recruiting</ModeTab>
            <ModeTab href="/general"         active={mode === "general"}>General</ModeTab>
            <ModeTab href="/study/dashboard" active={mode === "study"}>Study</ModeTab>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Live recording indicator */}
          {recording && (
            <div className="flex items-center gap-1.5 mr-2 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-2xs font-semibold text-red-600 dark:text-red-400">Recording</span>
            </div>
          )}

          {mode === "study" ? (
            <>
              <NavLink href="/study/dashboard">Library</NavLink>
              <div className="w-px h-4 bg-stone-200 dark:bg-stone-700 mx-1" />
              <Link
                href="/study"
                className="rounded bg-aubergine-800 text-white text-xs font-medium px-3 py-1.5 hover:bg-aubergine-900 transition-colors"
              >
                New lecture
              </Link>
            </>
          ) : mode === "general" ? (
            <>
              <NavLink href="/general/dashboard">Dashboard</NavLink>
              <NavLink href="/general/dashboard?tab=data">Data</NavLink>
              <div className="w-px h-4 bg-stone-200 dark:bg-stone-700 mx-1" />
              <Link
                href="/general"
                className="rounded bg-aubergine-800 text-white text-xs font-medium px-3 py-1.5 hover:bg-aubergine-900 transition-colors"
              >
                Workspace
              </Link>
            </>
          ) : (
            <>
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/candidates">Queue</NavLink>
              <div className="w-px h-4 bg-stone-200 dark:bg-stone-700 mx-1" />
              <Link
                href="/workflow"
                className="rounded bg-aubergine-800 text-white text-xs font-medium px-3 py-1.5 hover:bg-aubergine-900 transition-colors"
              >
                Workflow
              </Link>
            </>
          )}

          <div className="w-px h-4 bg-stone-200 dark:bg-stone-700 mx-1" />
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 rounded-full bg-aubergine-100 dark:bg-aubergine-950/40 border border-aubergine-200 dark:border-aubergine-900 flex items-center justify-center text-aubergine-800 dark:text-aubergine-400 text-[11px] font-semibold hover:bg-aubergine-200 dark:hover:bg-aubergine-900/50 transition-colors"
        aria-label="Account menu"
      >
        {initials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-lg z-50 py-1 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-stone-100 dark:border-stone-800">
              <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">{user.name}</p>
              <p className="text-[11px] text-stone-400 dark:text-stone-500 truncate">{user.email}</p>
            </div>
            <div className="py-1">
              <button
                type="button"
                onClick={() => { setOpen(false); signOut(); }}
                className="w-full text-left px-3 py-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ModeTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={[
        "px-3 py-1 text-xs font-medium rounded-md transition-colors",
        active
          ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm"
          : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300",
      ].join(" ")}
    >
      {children}
    </Link>
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
