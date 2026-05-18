import type { Config } from "tailwindcss";

/**
 * SoraBase design system.
 *
 * Philosophy: warm stone neutrals, smoked aubergine accent, editorial serif headings.
 * No loud gradients, no AI-purple, no toy-rounded UI.
 * Radius: xs=3px → lg=10px (tight, restrained)
 * Shadow: single-layer, low-opacity, purely for depth cues
 * Typography: Inter (body) + DM Serif Display (headings) + JetBrains Mono (code)
 */

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    borderRadius: {
      none:    "0",
      xs:      "3px",
      sm:      "5px",
      DEFAULT: "6px",
      md:      "7px",
      lg:      "10px",
      xl:      "14px",
      "2xl":   "18px",
      full:    "9999px",
    },
    extend: {
      fontFamily: {
        sans:    ["Inter",             "ui-sans-serif",  "system-ui", "-apple-system", "sans-serif"],
        mono:    ["JetBrains Mono",    "ui-monospace",   "SFMono-Regular", "monospace"],
        display: ["DM Serif Display",  "Georgia",        "serif"],
      },

      colors: {
        /* ── Smoked plum — warm wine-charcoal, dyed leather, not purple ── */
        aubergine: {
          50:  "#faf7f4",   /* warm ivory parchment               */
          100: "#f2ebe3",   /* soft cream blush                   */
          200: "#ddd2c6",   /* warm stone taupe (borders/tints)   */
          300: "#c2a898",   /* dusty mauve-taupe                  */
          400: "#9e7880",   /* muted plum-rose (dark-mode text)   */
          500: "#7c5060",   /* smoked plum-mauve                  */
          600: "#5e3848",   /* deep smoked plum                   */
          700: "#4a2838",   /* dark plum-wine (icons, accents)    */
          800: "#3a1828",   /* wine-charcoal — PRIMARY CTA        */
          900: "#260e18",   /* espresso-plum — CTA hover          */
          950: "#140810",   /* near-black plum (dark bg tints)    */
        },
        /* ── Warm stone — replaces cold slate/zinc everywhere ────────────── */
        stone: {
          25:  "#FDFCFB",
          50:  "#FAFAF9",
          100: "#F5F4F2",
          150: "#EEEDE9",
          200: "#E7E5E1",
          300: "#D4D1CB",
          400: "#A9A49D",
          500: "#78746D",
          600: "#5C5852",
          700: "#44413C",
          800: "#2E2C28",
          900: "#1C1A17",
          950: "#0F0E0C",
        },
        /* ── Semantic — intentionally restrained ─────────────────────────── */
        positive: {
          DEFAULT: "#1A6B3C",
          light:   "#EBF5F0",
          border:  "#A3D4B8",
          text:    "#1A6B3C",
        },
        warning: {
          DEFAULT: "#92620A",
          light:   "#FEF7ED",
          border:  "#F5D18A",
          text:    "#7A5008",
        },
        negative: {
          DEFAULT: "#B91C1C",
          light:   "#FEF2F2",
          border:  "#FECACA",
          text:    "#991B1B",
        },
        info: {
          DEFAULT: "#1E40AF",
          light:   "#EFF6FF",
          border:  "#BFDBFE",
          text:    "#1E3A8A",
        },
      },

      boxShadow: {
        card:          "0 1px 2px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)",
        panel:         "0 2px 8px rgba(0,0,0,0.07)",
        popover:       "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)",
        focus:         "0 0 0 2.5px rgba(58,24,40,0.22)",
        "focus-error": "0 0 0 2.5px rgba(185,28,28,0.20)",
        none:          "none",
      },

      fontSize: {
        "2xs": ["10px",  { lineHeight: "14px",  letterSpacing: "0.01em" }],
        xs:    ["11px",  { lineHeight: "16px" }],
        sm:    ["13px",  { lineHeight: "20px" }],
        base:  ["14px",  { lineHeight: "22px" }],
        lg:    ["16px",  { lineHeight: "24px" }],
        xl:    ["18px",  { lineHeight: "26px" }],
        "2xl": ["22px",  { lineHeight: "30px" }],
        "3xl": ["26px",  { lineHeight: "34px" }],
        /* Display scale for marketing */
        "4xl": ["32px",  { lineHeight: "38px",  letterSpacing: "-0.01em"  }],
        "5xl": ["40px",  { lineHeight: "46px",  letterSpacing: "-0.02em"  }],
        "6xl": ["52px",  { lineHeight: "56px",  letterSpacing: "-0.025em" }],
        "7xl": ["64px",  { lineHeight: "68px",  letterSpacing: "-0.03em"  }],
        "8xl": ["80px",  { lineHeight: "84px",  letterSpacing: "-0.03em"  }],
        "9xl": ["100px", { lineHeight: "104px", letterSpacing: "-0.03em"  }],
      },

      letterSpacing: {
        label:  "0.06em",
        tight:  "-0.01em",
        tighter:"-0.02em",
      },

      transitionDuration: {
        DEFAULT: "120ms",
        fast:    "80ms",
        slow:    "250ms",
      },

      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.16, 1, 0.3, 1)",
        out:     "cubic-bezier(0.16, 1, 0.3, 1)",
        in:      "cubic-bezier(0.4, 0, 1, 1)",
      },

      animation: {
        "fade-in":    "fadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-up":   "slideUp 240ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "spin-slow":  "spin 2s linear infinite",
      },

      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
