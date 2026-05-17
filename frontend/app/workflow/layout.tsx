import "@xyflow/react/dist/style.css";
import AuthGuard from "@/components/AuthGuard";

export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard required="recruiter">
      {children}
    </AuthGuard>
  );
}
