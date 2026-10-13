import { z } from 'zod';
import { sanitizeRichText } from '@/lib/richtext/sanitize';
import { isSafeHref } from './url';

// Input schemas shared by admin forms (react-hook-form resolvers) and server
// actions — the single source of truth for what a valid entity looks like.

export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers, and hyphens only');

const richTextDocSchema = z
  .object({ type: z.literal('doc'), content: z.array(z.unknown()).optional() })
  .transform((doc) => sanitizeRichText(doc) ?? { type: 'doc' as const, content: [] });

export const richTextSchema = richTextDocSchema.nullable();

export const seoInputSchema = z.object({
  seoTitle: z.string().max(200).nullable().default(null),
  seoDescription: z.string().max(400).nullable().default(null),
  ogImageId: z.string().uuid().nullable().default(null),
  // Same-site path or an http(s) URL; anything else (javascript:, mailto:…) is refused.
  canonicalUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || (isSafeHref(v) && /^(\/|https?:\/\/)/i.test(v)), 'Enter a /path or https:// URL.')
    .transform((v) => v || null)
    .nullable()
    .default(null),
  noIndex: z.boolean().default(false),
  seoKeywords: z.array(z.string().max(80)).max(20).default([]),
});
export type SeoInput = z.infer<typeof seoInputSchema>;

export const contentStatusSchema = z.enum(['draft', 'scheduled', 'published', 'archived']);

/* -------------------------------- services --------------------------------- */

export const faqItemSchema = z.object({
  q: z.string().min(1, 'Question required').max(500),
  a: z.string().min(1, 'Answer required').max(2000),
});

export const serviceInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  title: z.string().min(1, 'Title required').max(200),
  name: z.string().min(1, 'Name required').max(200),
  short: z.string().max(300).default(''),
  lede: z.string().max(1000).default(''),
  metaDescription: z.string().max(400).default(''),
  body: richTextSchema.default(null),
  included: z.array(z.string().min(1).max(300)).default([]),
  process: z.array(z.string().min(1).max(300)).default([]),
  proof: z.array(z.string().min(1).max(200)).default([]),
  faqs: z.array(faqItemSchema).default([]),
  accent: z.enum(['brand', 'cyan', 'amber']).default('brand'),
  icon: z.enum(['box', 'torus', 'octa', 'sphere', 'badge']).default('box'),
  featuredImageId: z.string().uuid().nullable().default(null),
  galleryMediaIds: z.array(z.string().uuid()).default([]),
  status: contentStatusSchema.default('published'),
  seo: seoInputSchema.prefault({}),
});
export type ServiceInput = z.infer<typeof serviceInputSchema>;

/* ------------------------------ case studies ------------------------------- */

export const metricSchema = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(60),
});

// YouTube watch/share/embed/shorts URL — validated loosely, the embed helper
// (youtubeEmbedId) is what actually needs to parse it.
export const youtubeUrlSchema = z
  .string()
  .url()
  .regex(/(?:youtube\.com|youtu\.be)\//, 'Must be a YouTube URL');

// One gallery item: a still image, or a 3D model with its viewer settings.
// `mediaId` is the image itself for image rows, and the optional poster for
// model rows — which is why it is nullable.
export const galleryItemInputSchema = z
  .object({
    type: z.enum(['image', 'model']).default('image'),
    mediaId: z.string().uuid().nullable().default(null),
    modelMediaId: z.string().uuid().nullable().default(null),
    environmentPreset: z
      .enum(['forest', 'studio', 'city', 'sunset', 'warehouse'])
      .default('forest'),
    autoRotate: z.boolean().default(false),
    enableHoverRotation: z.boolean().default(true),
    enableMouseParallax: z.boolean().default(true),
    // Framing nudges in world units — bounded so a typo can't push the model
    // out of frame entirely.
    modelXOffset: z.number().min(-10).max(10).default(0),
    modelYOffset: z.number().min(-10).max(10).default(0),
  })
  // Mirrors the DB check constraint: a row must have something to render.
  .refine((i) => (i.type === 'model' ? Boolean(i.modelMediaId) : Boolean(i.mediaId)), {
    message: 'Gallery items need an image; 3D items need a model file.',
  });

export const galleryInputSchema = z.object({
  label: z.string().min(1, 'Gallery label required').max(120),
  serviceSlug: z.string().max(120).nullable().default(null),
  items: z.array(galleryItemInputSchema).default([]),
  videoUrls: z.array(youtubeUrlSchema).max(20).default([]),
});

export const caseStudyInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  client: z.string().min(1, 'Client required').max(200),
  industry: z.string().max(120).default(''),
  // Additional industries this study also appears under in the /work filter.
  // `industry` is folded in below, so callers only list the extras.
  industries: z.array(z.string().min(1).max(120)).default([]),
  services: z.array(z.string().min(1).max(120)).default([]),
  categories: z.array(z.string().min(1).max(120)).default([]),
  technologies: z.array(z.string().min(1).max(120)).default([]),
  result: z.string().max(600).default(''),
  description: richTextSchema.default(null),
  metrics: z.array(metricSchema).default([]),
  testimonial: z
    .object({
      quote: z.string().max(2000).default(''),
      author: z.string().max(200).default(''),
      role: z.string().max(200).default(''),
    })
    .nullable()
    .default(null),
  coverImageId: z.string().uuid().nullable().default(null),
  featured: z.boolean().default(false),
  status: contentStatusSchema.default('published'),
  galleries: z.array(galleryInputSchema).default([]),
  seo: seoInputSchema.prefault({}),
})
  // Keep the two industry columns consistent: `industries` always leads with the
  // primary `industry`, deduped, so the /work filter can match on it alone.
  .transform((cs) => ({
    ...cs,
    industries: [...new Set([cs.industry, ...cs.industries])].filter(Boolean),
  }));
// Callers (the admin form) send the pre-transform shape; the parsed result is
// what the server action writes.
export type CaseStudyInput = z.input<typeof caseStudyInputSchema>;
export type ParsedCaseStudyInput = z.output<typeof caseStudyInputSchema>;

/* ---------------------------------- posts ---------------------------------- */

export const postInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  title: z.string().min(1, 'Title required').max(300),
  excerpt: z.string().max(600).default(''),
  body: richTextDocSchema,
  coverImageId: z.string().uuid().nullable().default(null),
  authorName: z.string().min(1, 'Author required').max(200),
  authorTitle: z.string().max(200).default(''),
  categoryId: z.string().uuid().nullable().default(null),
  tags: z.array(z.string().min(1).max(60)).max(20).default([]),
  status: contentStatusSchema.default('draft'),
  publishedAt: z.string().datetime({ offset: true }).nullable().default(null),
  seo: seoInputSchema.prefault({}),
});
export type PostInput = z.infer<typeof postInputSchema>;

/* ----------------------------------- faqs ---------------------------------- */

export const faqInputSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().min(1, 'Question required').max(500),
  answer: z.string().min(1, 'Answer required').max(2000),
  categoryId: z.string().uuid().nullable().default(null),
  isActive: z.boolean().default(true),
});
export type FaqInput = z.infer<typeof faqInputSchema>;

/* ------------------------------- testimonials ------------------------------ */

export const testimonialInputSchema = z.object({
  id: z.string().uuid().optional(),
  quote: z.string().min(1, 'Quote required').max(2000),
  author: z.string().min(1, 'Author required').max(200),
  role: z.string().max(200).default(''),
  company: z.string().max(200).default(''),
  avatarId: z.string().uuid().nullable().default(null),
  isActive: z.boolean().default(true),
});
export type TestimonialInput = z.infer<typeof testimonialInputSchema>;
