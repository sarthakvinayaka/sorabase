import { notFound } from "next/navigation";
import type { CandidateDetail } from "@/lib/types";
import GeneralResultsWorkspace from "./GeneralResultsWorkspace";

interface Props {
  params: { candidateId: string };
}

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export default async function GeneralResultsPage({ params }: Props) {
  const res = await fetch(
    `${BACKEND_URL}/api/candidates/${params.candidateId}`,
    { cache: "no-store" },
  );

  if (!res.ok) notFound();

  const detail: CandidateDetail = await res.json();
  return <GeneralResultsWorkspace initial={detail} />;
}
