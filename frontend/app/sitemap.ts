import type { MetadataRoute } from "next";

const BASE = "https://www.sorabase.org";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url:             `${BASE}/`,
      lastModified:    new Date("2025-05-01"),
      changeFrequency: "weekly",
      priority:        1.0,
    },
    {
      url:             `${BASE}/pricing`,
      lastModified:    new Date("2025-05-01"),
      changeFrequency: "monthly",
      priority:        0.8,
    },
  ];
}
