import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from './lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-09-02T00:00:00Z');
  return [
    { url: SITE_ORIGIN, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_ORIGIN}/guide`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_ORIGIN}/en`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_ORIGIN}/en/guide`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_ORIGIN}/about`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_ORIGIN}/privacy`, lastModified, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_ORIGIN}/terms`, lastModified, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
