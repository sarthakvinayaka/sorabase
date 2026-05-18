import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/app/",
          "/onboarding",
          "/dashboard",
          "/candidates",
          "/workflow",
          "/general",
          "/review/",
          "/signin",
          "/signup",
        ],
      },
    ],
    sitemap: "https://www.sorabase.org/sitemap.xml",
  };
}
