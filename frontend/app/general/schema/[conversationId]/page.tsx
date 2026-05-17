import { notFound } from "next/navigation";
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

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export default async function SchemaReviewPage({ params, searchParams }: Props) {
  const res = await fetch(
    `${BACKEND_URL}/api/conversations/${params.conversationId}`,
    { cache: "no-store" },
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
