"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import SiteNav from "./marketing/SiteNav";
import { modeFromPath } from "@/lib/mode";
import { LogoMark } from "@/components/ui/LogoMark";
import { useRecordingStatus } from "@/lib/useExtensionStatus";
import { useAuth } from "@/lib/auth-context";
import type { AccessType } from "@/lib/auth";

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

          <div className="h-3.5 w-px bg-stone-200 dark:bg-stone-700" />

          <div className="flex items-center text-xs">
            <Link
              href="/workflow"
              className={[
                "px-2 py-0.5 rounded transition-colors",
                mode === "recruiting"
                  ? "text-aubergine-900 dark:text-aubergine-400 font-semibold"
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
                  ? "text-aubergine-900 dark:text-aubergine-400 font-semibold"
                  : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300",
              ].join(" ")}
            >
              General
            </Link>
            <span className="text-stone-300 dark:text-stone-600 select-none">/</span>
            <Link
              href="/study"
              className={[
                "px-2 py-0.5 rounded transition-colors",
                mode === "study"
                  ? "text-aubergine-900 dark:text-aubergine-400 font-semibold"
                  : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300",
              ].join(" ")}
            >
              Study
            </Link>
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
              <NavLink href="/study/dashboard">Dashboard</NavLink>
              <NavLink href="/study/dashboard?tab=library">Library</NavLink>
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

const HOME_MODES: { id: Exclude<AccessType, "pending">; label: string; href: string }[] = [
  { id: "recruiter", label: "Recruiter", href: "/workflow" },
  { id: "general",   label: "General",  href: "/general"  },
  { id: "study",     label: "Study",    href: "/study"    },
];

function UserMenu() {
  const { user, signOut, switchHomeMode } = useAuth();
  const router   = useRouter();
  const [open, setOpen]           = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  async function handleSwitch(mode: Exclude<AccessType, "pending">, href: string) {
    if (mode === user!.access) { setOpen(false); return; }
    setSwitching(mode);
    try {
      await switchHomeMode(mode);
      setOpen(false);
      router.push(href);
    } finally {
      setSwitching(null);
    }
  }

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
          {/* Click-outside overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-lg z-50 py-1 overflow-hidden">
            {/* User info */}
            <div className="px-3 py-2.5 border-b border-stone-100 dark:border-stone-800">
              <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">{user.name}</p>
              <p className="text-[11px] text-stone-400 dark:text-stone-500 truncate">{user.email}</p>
            </div>

            {/* Workspace switcher */}
            <div className="px-3 py-2 border-b border-stone-100 dark:border-stone-800">
              <p className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-[0.08em] mb-1.5">
                Home workspace
              </p>
              {HOME_MODES.map((m) => {
                const isHome    = user.access === m.id;
                const isLoading = switching === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={switching !== null}
                    onClick={() => handleSwitch(m.id, m.href)}
                    className={[
                      "w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors",
                      isHome
                        ? "bg-aubergine-50 dark:bg-aubergine-950/30 text-aubergine-900 dark:text-aubergine-300 font-medium"
                        : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-200",
                      "disabled:opacity-50",
                    ].join(" ")}
                  >
                    <span>{m.label}</span>
                    {isLoading ? (
                      <svg className="w-3 h-3 animate-spin text-aubergine-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : isHome ? (
                      <svg className="w-3 h-3 text-aubergine-600 dark:text-aubergine-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 3L2 9h2v8h5v-5h2v5h5V9h2L10 3z" />
                      </svg>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Sign out */}
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
