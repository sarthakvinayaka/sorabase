import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing — SoraBase Meeting Intelligence",
  description:
    "Simple, transparent pricing for SoraBase. Start free with 10 meetings, upgrade to Pro for unlimited sessions, custom workflows, and full AI extraction.",
  alternates: {
    canonical: "https://www.sorabase.org/pricing",
  },
  openGraph: {
    title:       "Pricing — SoraBase Meeting Intelligence",
    description: "Start free. Upgrade when you're ready. Simple, transparent pricing.",
    url:         "https://www.sorabase.org/pricing",
    type:        "website",
  },
  twitter: {
    card:        "summary",
    title:       "Pricing — SoraBase",
    description: "Start free with 10 meetings. Upgrade to Pro for unlimited access.",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
