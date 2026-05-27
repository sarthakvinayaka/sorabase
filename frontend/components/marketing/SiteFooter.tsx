import Link from "next/link";

const NAV_COLS: Record<string, { label: string; href: string }[]> = {
  Product: [
    { label: "How it works",   href: "/#how-it-works" },
    { label: "Recruiter mode", href: "/#modes"        },
    { label: "General mode",   href: "/#modes"        },
    { label: "Integrations",   href: "/#integrations" },
    { label: "Pricing",        href: "/pricing"       },
  ],
  Resources: [
    { label: "Documentation",  href: "#" },
    { label: "API reference",  href: "#" },
    { label: "Changelog",      href: "#" },
    { label: "Status",         href: "#" },
  ],
  Company: [
    { label: "About",          href: "#" },
    { label: "Blog",           href: "#" },
    { label: "Careers",        href: "#" },
    { label: "Contact",        href: "#" },
  ],
  Legal: [
    { label: "Privacy",        href: "#" },
    { label: "Terms",          href: "#" },
    { label: "Security",       href: "#" },
  ],
};

export default function SiteFooter() {
  return (
    <footer className="bg-white dark:bg-stone-950 border-t border-stone-200 dark:border-stone-800">

      {/* ── Brand moment ─────────────────────────────────────────────────── */}
      <div className="mkt-section py-16 lg:py-20 border-b border-stone-100 dark:border-stone-900">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <div>
            <p className="eyebrow mb-5">Meeting intelligence platform</p>
            <Link
              href="/"
              className="font-display italic text-stone-900 dark:text-stone-100 hover:opacity-70 transition-opacity"
              style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)", lineHeight: 1.05 }}
            >
              Sorabase
            </Link>
          </div>
          <p className="text-sm text-stone-400 dark:text-stone-500 leading-relaxed max-w-xs lg:text-right">
            Turn every meeting, call, and transcript into structured,
            actionable data — for recruiting teams and every team after.
          </p>
        </div>
      </div>

      {/* ── Link grid ────────────────────────────────────────────────────── */}
      <div className="mkt-section py-14">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
          {(Object.entries(NAV_COLS) as [string, { label: string; href: string }[]][]).map(
            ([col, items]) => (
              <div key={col}>
                <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500 mb-4">
                  {col}
                </p>
                <ul className="space-y-2.5">
                  {items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="text-[13px] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────── */}
      <div className="mkt-section py-6 border-t border-stone-100 dark:border-stone-900 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-stone-400 dark:text-stone-500">
            © {new Date().getFullYear()} Sorabase, Inc.
          </p>
          <span aria-hidden className="text-stone-300 dark:text-stone-700">·</span>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            All rights reserved.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <SocialLink href="#" label="X / Twitter">
            <svg className="w-[15px] h-[15px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.635 5.903-5.635zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </SocialLink>
          <SocialLink href="#" label="LinkedIn">
            <svg className="w-[15px] h-[15px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </SocialLink>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="w-7 h-7 flex items-center justify-center rounded text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
    >
      {children}
    </a>
  );
}
