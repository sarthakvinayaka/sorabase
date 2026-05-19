/** Application modes — Recruiting is the original product; General and Study are additional verticals. */
export type AppMode = "recruiting" | "general" | "study";

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
  {
    id: "study",
    label: "Study",
    description: "Turn lectures into notes, flashcards, quizzes, and structured study material.",
    href: "/study",
  },
];

/** Derive the active mode from the current pathname. */
export function modeFromPath(pathname: string): AppMode {
  if (pathname.startsWith("/study"))   return "study";
  if (pathname.startsWith("/general")) return "general";
  return "recruiting";
}
