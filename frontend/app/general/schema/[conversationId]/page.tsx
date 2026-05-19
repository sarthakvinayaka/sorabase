import { createHmac } from "crypto";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import SchemaReviewWorkspace from "./SchemaReviewWorkspace";

interface Props {
  params: { conversationId: string };
  searchParams: { source?: string };
}

interface ConversationData {
  id:         string;
  raw_text:   string | null;
  char_count: number | null;
}

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const BACKEND_API_SECRET = process.env.BACKEND_API_SECRET || "";

export default async function SchemaReviewPage({ params, searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const userId = session.user.id;
  const token = createHmac("sha256", BACKEND_API_SECRET).update(userId).digest("hex");

  const res = await fetch(
    `${BACKEND_URL}/api/conversations/${params.conversationId}`,
    {
      cache: "no-store",
      headers: { "x-user-id": userId, "x-api-token": token },
    },
  );

  if (!res.ok) notFound();

  const conv: ConversationData = await res.json();

  return (
    <SchemaReviewWorkspace
      conversationId={params.conversationId}
      source={searchParams.source ?? "transcript"}
      rawText={conv.raw_text ?? ""}
      charCount={conv.char_count ?? 0}
    />
  );
}
