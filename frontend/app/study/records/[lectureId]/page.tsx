import StudyRecordView from "./StudyRecordView";

interface Props {
  params: { lectureId: string };
}

export default function StudyRecordPage({ params }: Props) {
  return <StudyRecordView lectureId={params.lectureId} />;
}
