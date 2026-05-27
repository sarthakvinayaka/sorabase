import type { Metadata } from "next";
import AuthGuard from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: "Study Mode — Sorabase",
  robots: { index: false, follow: false },
};

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard required="study">
      {children}
    </AuthGuard>
  );
}
