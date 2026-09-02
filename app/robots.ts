import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from './lib/site';

export default function robots(): MetadataRoute.Robots {
  const privatePaths = ['/admin', '/api/'];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: privatePaths },
      ...['Googlebot', 'Bingbot', 'OAI-SearchBot', 'GPTBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User']
        .map((userAgent) => ({ userAgent, allow: '/', disallow: privatePaths })),
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
