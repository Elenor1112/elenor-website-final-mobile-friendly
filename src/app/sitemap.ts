import type { MetadataRoute } from 'next';
import { getSiteSettings } from '@/lib/data/settings';
import { getServices } from '@/lib/data/services';
import { getCaseStudies } from '@/lib/data/work';
import { getPosts } from '@/lib/data/posts';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [site, services, caseStudies, posts] = await Promise.all([
    getSiteSettings(),
    getServices().catch(() => []),
    getCaseStudies().catch(() => []),
    getPosts().catch(() => []),
  ]);
  const base = site.url;
  const now = new Date();

  const staticRoutes = ['', '/about', '/services', '/work', '/blog', '/faq', '/contact'].map(
    (path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.8,
    })
  );

  const legalRoutes = [
    {
      url: `${base}/privacy-policy`,
      lastModified: new Date('2026-11-02'),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
  ];

  const serviceRoutes = services
    .filter((s) => !s.seo.noIndex)
    .map((s) => ({
      url: `${base}/services/${s.slug}`,
      lastModified: new Date(s.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    }));

  const workRoutes = caseStudies
    .filter((c) => !c.seo.noIndex)
    .map((c) => ({
      url: `${base}/work/${c.slug}`,
      lastModified: new Date(c.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

  const postRoutes = posts
    .filter((p) => !p.seo.noIndex)
    .map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));

  return [...staticRoutes, ...legalRoutes, ...serviceRoutes, ...workRoutes, ...postRoutes];
}
