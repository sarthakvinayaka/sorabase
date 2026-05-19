import StudyCourseView from "./StudyCourseView";

interface Props {
  params: { slug: string };
}

export default function StudyCoursePage({ params }: Props) {
  // slug is URL-encoded course name
  const courseName = decodeURIComponent(params.slug);
  return <StudyCourseView courseName={courseName} />;
}
