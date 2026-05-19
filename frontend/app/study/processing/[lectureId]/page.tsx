import StudyProcessingWorkspace from "./StudyProcessingWorkspace";

interface Props {
  params: { lectureId: string };
  searchParams: {
    source?: string;
    template?: string;
    title?: string;
    course?: string;
    date?: string;
  };
}

export default function StudyProcessingPage({ params, searchParams }: Props) {
  return (
    <StudyProcessingWorkspace
      conversationId={params.lectureId}
      source={searchParams.source ?? "transcript"}
      template={searchParams.template ?? "standard"}
      title={searchParams.title ?? ""}
      course={searchParams.course ?? ""}
      lectureDate={searchParams.date ?? ""}
    />
  );
}
