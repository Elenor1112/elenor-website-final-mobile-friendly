import 'server-only';
import type { KnowledgeSourceType } from '@/db/schema';
import { richTextToPlainText } from '@/lib/richtext/render';
import { getFaqCategories } from '@/lib/data/faqs';
import { getPage } from '@/lib/data/pages';
import { getPosts } from '@/lib/data/posts';
import { getServices } from '@/lib/data/services';
import { getContactSettings, getSiteSettings } from '@/lib/data/settings';
import { hours24 } from '@/lib/hours';
import { getTestimonials } from '@/lib/data/testimonials';
import { getCaseStudies } from '@/lib/data/work';

/**
 * Turns CMS rows into flat, embeddable documents.
 *
 * Everything here reads through the public data layer, which already filters
 * to published rows — that is the structural guarantee behind the "never
 * expose unpublished content" guardrail, rather than a filter the indexer
 * could forget to apply. The one explicit status check below covers posts,
 * whose data layer returns scheduled items too.
 */

export type KnowledgeDocument = {
  sourceType: KnowledgeSourceType;
  /** Stable identity for this document within its type. */
  sourceId: string;
  title: string;
  slug: string;
  /** Public URL, used for citations. */
  url: string | null;
  /** Plain text; the chunker splits this. */
  content: string;
  keywords: string[];
};

/** Joins non-empty parts with blank lines so the chunker sees paragraphs. */
function paragraphs(...parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join('\n\n');
}

function list(label: string, items: string[]): string {
  const clean = items.filter((i) => i && i.trim());
  return clean.length > 0 ? `${label}: ${clean.join(', ')}.` : '';
}

async function servicesToDocuments(): Promise<KnowledgeDocument[]> {
  const services = await getServices();
  return services
    .filter((s) => s.status === 'published')
    .map((service) => ({
      sourceType: 'service' as const,
      sourceId: service.slug,
      title: service.title || service.name,
      slug: service.slug,
      url: `/services/${service.slug}`,
      keywords: [service.name, ...service.included].filter(Boolean),
      content: paragraphs(
        `Service: ${service.name}.`,
        service.lede,
        service.short,
        service.metaDescription,
        richTextToPlainText(service.body),
        list("What's included", service.included),
        list('Our process', service.process),
        list('Proof points', service.proof),
        ...service.faq.map((f) => `Question: ${f.q}\nAnswer: ${f.a}`),
      ),
    }));
}

async function caseStudiesToDocuments(): Promise<KnowledgeDocument[]> {
  const studies = await getCaseStudies();
  return studies
    .filter((s) => s.status === 'published')
    .map((study) => ({
      sourceType: 'case-study' as const,
      sourceId: study.slug,
      title: `${study.client} case study`,
      slug: study.slug,
      url: `/work/${study.slug}`,
      keywords: [study.client, study.industry, ...study.industries, ...study.services],
      content: paragraphs(
        `Client: ${study.client}.`,
        study.industry && `Industry: ${study.industry}.`,
        list('Services delivered', study.services),
        list('Industries', study.industries),
        list('Technologies', study.technologies),
        study.result && `Result: ${study.result}`,
        richTextToPlainText(study.description),
        ...study.metrics.map((m) => `${m.label}: ${m.value}`),
        study.testimonial &&
          `Client testimonial: "${study.testimonial.quote}" — ${study.testimonial.author}, ${study.testimonial.role}.`,
      ),
    }));
}

async function postsToDocuments(): Promise<KnowledgeDocument[]> {
  const posts = await getPosts();
  return posts
    .filter((post) => {
      // getPosts() includes scheduled posts whose time has come; exclude
      // anything not actually live.
      if (post.status !== 'published' && post.status !== 'scheduled') return false;
      return !post.date || new Date(post.date).getTime() <= Date.now();
    })
    .map((post) => ({
      sourceType: 'post' as const,
      sourceId: post.slug,
      title: post.title,
      slug: post.slug,
      url: `/blog/${post.slug}`,
      keywords: [post.category, ...(post.seo.keywords ?? [])].filter(Boolean),
      content: paragraphs(
        `Article: ${post.title}.`,
        post.category && `Category: ${post.category}.`,
        post.dek,
        richTextToPlainText(post.body),
      ),
    }));
}

async function faqsToDocuments(): Promise<KnowledgeDocument[]> {
  const categories = await getFaqCategories();
  // One document per category keeps related Q&A pairs in the same chunk
  // neighbourhood, which retrieves better than one doc per question.
  return categories
    .filter((category) => category.faqs.length > 0)
    .map((category) => ({
      sourceType: 'faq' as const,
      sourceId: category.slug,
      title: `FAQ — ${category.name}`,
      slug: category.slug,
      url: '/faq',
      keywords: [category.name],
      content: paragraphs(
        `Frequently asked questions about ${category.name}.`,
        ...category.faqs.map((f) => `Question: ${f.q}\nAnswer: ${f.a}`),
      ),
    }));
}

async function testimonialsToDocument(): Promise<KnowledgeDocument[]> {
  const testimonials = await getTestimonials();
  if (testimonials.length === 0) return [];
  return [
    {
      sourceType: 'testimonial',
      sourceId: 'all',
      title: 'Client testimonials',
      slug: '',
      url: '/',
      keywords: testimonials.map((t) => t.company).filter(Boolean),
      content: paragraphs(
        'What our clients say about working with Elenor Marketing Agency.',
        ...testimonials.map(
          (t) =>
            `"${t.quote}" — ${t.author}${t.role ? `, ${t.role}` : ''}${t.company ? ` at ${t.company}` : ''}.`,
        ),
      ),
    },
  ];
}

/** Flattens a page's section data into readable prose. */
function sectionToText(data: unknown, depth = 0): string {
  if (depth > 4 || data == null) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'number' || typeof data === 'boolean') return String(data);
  if (Array.isArray(data)) {
    return data.map((item) => sectionToText(item, depth + 1)).filter(Boolean).join(' ');
  }
  if (typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>)
      // Media ids and flags carry no meaning for a reader.
      .filter(([key]) => !/id$|^is[A-Z]|^enabled$|url$|^accent$|^icon$/i.test(key))
      .map(([, value]) => sectionToText(value, depth + 1))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

async function pagesToDocuments(): Promise<KnowledgeDocument[]> {
  const slugs = ['home', 'about'] as const;
  const docs: KnowledgeDocument[] = [];

  for (const slug of slugs) {
    const page = await getPage(slug);
    if (!page) continue;
    const body = page.sections
      .filter((s) => s.isEnabled)
      .map((s) => sectionToText(s.data))
      .filter(Boolean)
      .join('\n\n');
    if (!body.trim()) continue;

    docs.push({
      sourceType: 'page',
      sourceId: slug,
      title: page.title || (slug === 'home' ? 'Elenor Marketing Agency' : 'About Elenor'),
      slug,
      url: slug === 'home' ? '/' : `/${slug}`,
      keywords: page.seo.keywords ?? [],
      content: paragraphs(page.seo.description, body),
    });
  }
  return docs;
}

/** Company facts (contact details, hours, address) as a single document. */
async function companyToDocument(): Promise<KnowledgeDocument[]> {
  const [site, contact] = await Promise.all([getSiteSettings(), getContactSettings()]);
  const address = site.address;
  const hours = { ...site.hours, ...hours24(site.hours.opens, site.hours.closes) };

  return [
    {
      sourceType: 'settings',
      sourceId: 'company',
      title: `About ${site.name}`,
      slug: '',
      url: '/contact',
      keywords: ['contact', 'address', 'phone', 'email', 'hours', 'location'],
      content: paragraphs(
        `${site.name} (${site.shortName}) — ${site.tagline}.`,
        site.description,
        `Founded in ${site.foundingYear}. Founder: ${site.founder.name}, ${site.founder.jobTitle}.`,
        `Email: ${site.email}. Phone: ${site.phoneDisplay}. WhatsApp: ${site.whatsapp}.`,
        `Address: ${address.street}, ${address.locality}, ${address.region}, ${address.countryName}.`,
        `Opening hours: ${hours.days.join(', ')}, ${hours.opens}–${hours.closes}.`,
        list('Featured clients', site.featuredClients),
        typeof contact === 'object' && contact
          ? sectionToText(contact)
          : '',
      ),
    },
  ];
}

/**
 * Collects every indexable document. Sources are gathered independently so one
 * failing source (e.g. a malformed page section) cannot abort the whole index.
 */
export async function collectKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  const collectors: (() => Promise<KnowledgeDocument[]>)[] = [
    servicesToDocuments,
    caseStudiesToDocuments,
    postsToDocuments,
    faqsToDocuments,
    testimonialsToDocument,
    pagesToDocuments,
    companyToDocument,
  ];

  const results = await Promise.allSettled(collectors.map((collect) => collect()));
  const documents: KnowledgeDocument[] = [];
  const failures: string[] = [];

  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      documents.push(...result.value);
    } else {
      failures.push(collectors[i].name);
      console.error(
        `[elenor-ai] knowledge source "${collectors[i].name}" failed:`,
        result.reason,
      );
    }
  }

  // One flaky source degrades the index; every source failing means something
  // systemic (no database, wrong environment). Surfacing that as an error beats
  // reporting a "successful" run that indexed nothing.
  if (failures.length === collectors.length) {
    throw new Error(
      `Every knowledge source failed (${failures.join(', ')}). ` +
        'The database is usually unreachable or unmigrated — check DATABASE_URL and run `npm run db:migrate`.',
    );
  }

  // Empty documents would embed to noise.
  return documents.filter((doc) => doc.content.trim().length > 0);
}
