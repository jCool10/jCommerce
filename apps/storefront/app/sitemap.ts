import type { MetadataRoute } from 'next';
import { catalogApi } from '@/lib/api/catalog';

const PAGE_LIMIT = 100;
const MAX_PAGES = 10;

// Dynamic sitemap — paginates the catalog so we don't blow the request budget
// on large stores. Static routes (/products, /search) are listed first.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100';
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/search`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
  ];

  const productEntries: MetadataRoute.Sitemap = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    try {
      const result = await catalogApi.list({ limit: PAGE_LIMIT, cursor }, { server: true });
      for (const product of result.items) {
        productEntries.push({
          url: `${base}/products/${product.id}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    } catch {
      break;
    }
  }

  return [...staticEntries, ...productEntries];
}
