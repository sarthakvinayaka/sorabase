import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import AuthGuard from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: "Workflow Builder",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard required="recruiter">
      {children}
    </AuthGuard>
  );
}
