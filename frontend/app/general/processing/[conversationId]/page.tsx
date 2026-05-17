import ProcessingWorkspace from "./ProcessingWorkspace";

interface Props {
  params: { conversationId: string };
  searchParams: { source?: string };
}

export default function ProcessingPage({ params, searchParams }: Props) {
  return (
    <ProcessingWorkspace
      conversationId={params.conversationId}
      source={searchParams.source ?? "transcript"}
    />
  );
}
