import StudyReviewWorkspace from "./StudyReviewWorkspace";

interface Props {
  params: { lectureId: string };
}

export default function StudyReviewPage({ params }: Props) {
  return <StudyReviewWorkspace lectureId={params.lectureId} />;
}
