import { createHmac } from "crypto";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import type { CandidateDetail } from "@/lib/types";
import ApprovedRecordView from "./ApprovedRecordView";

interface Props {
  params: { candidateId: string };
}

const BACKEND_URL        = process.env.BACKEND_URL        || "http://localhost:8000";
const BACKEND_API_SECRET = process.env.BACKEND_API_SECRET || "";

export default async function ApprovedRecordPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const userId = session.user.id;
  const token  = createHmac("sha256", BACKEND_API_SECRET).update(userId).digest("hex");

  const res = await fetch(
    `${BACKEND_URL}/api/candidates/${params.candidateId}`,
    {
      cache:   "no-store",
      headers: { "x-user-id": userId, "x-api-token": token },
    },
  );

  if (!res.ok) notFound();

  const detail: CandidateDetail = await res.json();
  return <ApprovedRecordView initial={detail} />;
}
