import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import AuthGuard from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: "General Mode",
  robots: { index: false, follow: false },
};

export default function GeneralLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard required="general">
      {children}
    </AuthGuard>
  );
}
