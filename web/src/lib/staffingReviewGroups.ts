export const GROUP_ORDER = ["identity", "profile", "job_fit", "workflow"] as const;

export type ReviewFieldGroup = (typeof GROUP_ORDER)[number];

export const GROUP_LABELS: Record<ReviewFieldGroup, string> = {
  identity: "Identity",
  profile: "Profile",
  job_fit: "Job fit",
  workflow: "Workflow",
};

export function isReviewFieldGroup(g: string): g is ReviewFieldGroup {
  return (GROUP_ORDER as readonly string[]).includes(g);
}
