import "@xyflow/react/dist/style.css";
import AuthGuard from "@/components/AuthGuard";

export default function GeneralLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard required="general">
      {children}
    </AuthGuard>
  );
}
