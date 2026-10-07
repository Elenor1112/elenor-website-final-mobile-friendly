// JSON-LD builders — pure functions over CMS data, rendered into pages via
// the <JsonLd> component. (Replaces src/content/schema.ts; now DB-driven.)
import type { SiteSettings } from '@/lib/validation/settings';
import type { PublicService } from '@/lib/data/services';
import type { PublicCaseStudy } from '@/lib/data/work';
import type { PublicPost } from '@/lib/data/posts';
import { hours24 } from '@/lib/hours';

const orgId = (siteUrl: string) => `${siteUrl}/#organization`;

export function organizationSchema(site: SiteSettings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MarketingAgency',
    '@id': orgId(site.url),
    name: site.name,
    url: site.url,
    logo: `${site.url}/logo.png`,
    image: `${site.url}/og-image.jpg`,
    description: site.description,
    foundingDate: String(site.foundingYear),
    telephone: site.phone,
    email: site.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      addressCountry: site.address.country,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: site.hours.days,
      ...hours24(site.hours.opens, site.hours.closes),
    },
    sameAs: Object.values(site.social).filter(Boolean),
    founder: { '@type': 'Person', name: site.founder.name, jobTitle: site.founder.jobTitle },
    areaServed: { '@type': 'Country', name: site.address.countryName },
  };
}

export function serviceSchema(service: PublicService, site: SiteSettings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    serviceType: service.name,
    description: service.metaDescription,
    url: `${site.url}/services/${service.slug}`,
    areaServed: { '@type': 'Country', name: site.address.countryName },
    provider: { '@id': orgId(site.url) },
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[], siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${siteUrl}${it.path}`,
    })),
  };
}

export function blogPostingSchema(post: PublicPost, site: SiteSettings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.dek,
    datePublished: post.date,
    dateModified: post.updatedAt,
    author: { '@type': 'Person', name: post.author.name, jobTitle: post.author.title },
    publisher: { '@id': orgId(site.url) },
    mainEntityOfPage: `${site.url}/blog/${post.slug}`,
    image: post.seo.ogImageUrl
      ? absoluteUrl(post.seo.ogImageUrl, site.url)
      : post.coverImage
        ? absoluteUrl(post.coverImage.url, site.url)
        : `${site.url}/og-image.jpg`,
  };
}

export function creativeWorkSchema(cs: PublicCaseStudy, site: SiteSettings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: `${cs.client} — ${cs.services.join(', ')}`,
    about: cs.client,
    creator: { '@id': orgId(site.url) },
    url: `${site.url}/work/${cs.slug}`,
    description: cs.result,
  };
}

export function absoluteUrl(pathOrUrl: string, siteUrl: string): string {
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${siteUrl}${pathOrUrl}`;
}
