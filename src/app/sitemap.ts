import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aerotext.studio";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/edit`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];
}
