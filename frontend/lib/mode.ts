/** Application modes — Recruiting is the original product; General covers all other use cases. */
export type AppMode = "recruiting" | "general";

export interface ModeConfig {
  id: AppMode;
  label: string;
  description: string;
  href: string;
}

export const MODES: ModeConfig[] = [
  {
    id: "recruiting",
    label: "Recruiting",
    description: "Candidate screening, AI scoring, and structured extraction for staffing teams.",
    href: "/workflow",
  },
  {
    id: "general",
    label: "General",
    description: "Transcript processing and structured analysis for any conversation or document.",
    href: "/general",
  },
];

/** Derive the active mode from the current pathname. */
export function modeFromPath(pathname: string): AppMode {
  if (pathname.startsWith("/general")) return "general";
  return "recruiting";
}
