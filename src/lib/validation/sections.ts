import { z } from 'zod';
import { safeHref } from './url';

// One zod schema per page-section `type`. Section rows store their content in
// a jsonb `data` column; these schemas are the contract between the admin
// editor forms and the public components. Every field has a default so a
// partially-filled section never crashes a render.

const cta = (label: string, href: string) =>
  z.object({ label: z.string().default(label), href: safeHref().default(href) }).prefault({});

/* ---------------------------------- home ---------------------------------- */

export const heroSchema = z.object({
  eyebrow: z.string().default('Cairo · Egypt · Since 2021'),
  headlineLine1: z.string().default('Where Innovation'),
  headlineLine2: z.string().default('Meets Quality.'),
  sub: z
    .string()
    .default(
      'Since 2021, Elenor has crafted brand identity, social, video, web & events for 50+ clients — including Coca-Cola, Saint-Gobain, Duravit, and Zoetis.',
    ),
  primaryCta: cta('Start a project', '/contact'),
  secondaryCta: cta('See our work', '/work'),
  scrollHint: z.string().default('Scroll to explore'),
  animation: z
    .object({
      introEnabled: z.boolean().default(true),
      orbitEnabled: z.boolean().default(true),
      showcaseStripEnabled: z.boolean().default(true),
    })
    .prefault({}),
});

export const philosophySchema = z.object({
  eyebrow: z.string().default('Our philosophy'),
  eyebrowHref: safeHref().default('/about'),
  heading: z.string().default('We exist to build real brand presence — and measurable growth.'),
  body: z
    .string()
    .default(
      'From early-stage startups to established enterprises, our mission, vision, and values guide every project we take on. We build marketing strategies that earn customer loyalty and drive outcomes you can measure — not vanity output.',
    ),
  values: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .default([
      { title: 'Credibility', description: 'We say what we’ll deliver and deliver what we say — work you can put your name on.' },
      { title: 'Flexibility', description: 'Plans built around your actual size, industry, and stage — never a templated playbook.' },
      { title: 'Fast response', description: 'A genuinely competitive market rewards speed; we move at the pace your brand needs.' },
      { title: 'Creativity', description: 'A relentless focus on outcomes, not just output — ideas that actually move the business.' },
    ]),
});

export const servicesShowcaseSchema = z.object({
  eyebrow: z.string().default('What we do'),
  heading: z.string().default('Explore our work, one discipline at a time.'),
});

export const statsSchema = z.object({
  eyebrow: z.string().default('Company Growth'),
  heading: z.string().default('Proof, not promises.'),
  items: z
    .array(z.object({ value: z.number(), suffix: z.string().default(''), label: z.string() }))
    .default([
      { value: 50, suffix: '+', label: 'Satisfied Clients' },
      { value: 100, suffix: '+', label: 'Successful Projects' },
      { value: 300, suffix: '+', label: 'Days of Active Operation' },
      { value: 10, suffix: '', label: 'Core Services' },
    ]),
  footnote: z.string().default('…and a team that runs on a genuinely excessive amount of coffee.'),
});

export const clientsSchema = z.object({
  eyebrow: z.string().default('Trusted by'),
  heading: z.string().default('Brands that don’t settle for template work.'),
});

export const blogPreviewSchema = z.object({
  eyebrow: z.string().default('From the studio'),
  heading: z.string().default('Insights, not filler.'),
  linkLabel: z.string().default('All articles →'),
  count: z.number().int().min(1).max(12).default(6),
});

export const ctaSectionSchema = z.object({
  heading: z.string().default('Ready to collaborate?'),
  body: z
    .string()
    .default(
      'Tell us about your business and what you’re trying to achieve. We’ll get back to you within one business day.',
    ),
  primaryCta: cta('Start a project →', '/contact'),
  secondaryCta: cta('Explore our work', '/work'),
});

/* ---------------------------------- about --------------------------------- */

export const aboutHeroSchema = z.object({
  eyebrow: z.string().default('Why Elenor'),
  title: z.string().default('We don’t just build brands. We build them from scratch.'),
  // Rendered visibly under the hero stage (see about/page.tsx), styled to match
  // the Services hub's lede. The `\n` is a deliberate line break the client can
  // keep or drop from the admin textarea — the <p> carries whitespace-pre-line,
  // so removing it just reflows the copy as one paragraph.
  lede: z
    .string()
    .default(
      'Brands are remembered, connected with, and chosen.\nAt Elenor, we combine strategy, creativity, innovation, and quality execution to turn ideas into impactful brand experiences.',
    ),
});

export const ceoQuoteSchema = z.object({
  eyebrow: z.string().default('CEO’s Word'),
  quote: z
    .string()
    .default(
      'Earning my Master of Business Administration (MBA) in Management & Marketing from ESLSCA France inspired me to establish Elenor Marketing Agency in 2021 with a clear vision: to build an agency that combines strategic thinking with creative excellence. Since day one, our mission has been simple, to help businesses build stronger brands, connect with their audiences, and achieve sustainable growth. At Elenor, we continuously embrace the latest marketing technologies and industry best practices, integrating AI-powered solutions alongside SEO, GEO, and AEO to ensure our clients remain visible in both traditional search engines and the rapidly evolving AI landscape. As marketing continues to evolve, so do we. Our commitment remains unchanged: delivering measurable results, building lasting partnerships, and creating work that makes a meaningful impact.',
    ),
  cite: z.string().default('Eng. Emad Samir, CEO & Founder'),
  // Stored inline rather than as a media id: section rows come back as raw
  // jsonb with no join (see fetchPage), so an id would need a second lookup on
  // a cached path that runs for every About render. Nullable and fully
  // defaulted because rows seeded before this field existed carry no `portrait`
  // key — and parseSectionData answers *any* parse failure by falling back to
  // schema.parse({}), which would silently replace the client's edited quote.
  // For the same reason `url` is a bare string: media.storage can be 'local',
  // whose paths are relative and would fail z.string().url().
  portrait: z
    .object({
      id: z.string().default(''),
      url: z.string().default(''),
      alt: z.string().default(''),
    })
    .nullable()
    .default(null)
    // Absorbs anything unexpected in this one field instead of letting it fail.
    // Without it a malformed value (a bare string left by an older save, say)
    // fails the whole object, and parseSectionData's fallback then discards
    // every other field with it — losing the quote to salvage the portrait.
    .catch(null),
});

export const storySchema = z.object({
  heading: z.string().default('What Tailored Actually Means'),
  paragraphs: z
    .array(z.string())
    .default([
      'We are not builders, but we build from scratch. Elenor’s team develops marketing plans based on each client’s real size, industry, and stage, grounded in actual market research, not a templated playbook. That means strategy, identity, content, and media handled by one accountable team, so the brand experience stays consistent from the first concept to the final campaign.',
      'The result shows up in named work: pharmaceutical and healthcare brands like Zoetis and Marcyrl, FMCG and industrial brands like Coca-Cola and Saint-Gobain, and real-estate and hospitality clients like Emaar and Al-Walid Horse Resort.',
    ]),
});

export const valuesSchema = z.object({
  items: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .default([
      { title: 'Credibility', description: 'Work you can put your name on, backed by named, verifiable client results.' },
      { title: 'Flexibility', description: 'Strategies sized to your industry and stage — researched, not templated.' },
      { title: 'Reliability', description: 'Fast response and consistent delivery in a genuinely competitive market.' },
    ]),
});

export const missionVisionSchema = z.object({
  missionTitle: z.string().default('Our mission'),
  mission: z.string().default(''),
  visionTitle: z.string().default('Our vision'),
  vision: z.string().default(''),
});

// Icon grid on the About page: Vision / Mission / Values / Goals, each with a
// hover-revealed blurb. Distinct from `missionVisionSchema` and `valuesSchema`
// above (older, differently-shaped sections still available for other pages).
export const brandPhilosophySchema = z.object({
  heading: z.string().default('Brand Philosophy'),
  vision: z
    .string()
    .default(
      'To become a leading 360° marketing partner in the region, known for turning bold ideas into impactful brand experiences that drive growth and create lasting value.',
    ),
  mission: z
    .string()
    .default(
      'At Elenor, we bring strategy, creativity, technology, and production together to build meaningful brand experiences. We partner with businesses to transform their ideas into innovative, high-quality marketing solutions that create real impact and measurable growth.',
    ),
  values: z
    .string()
    .default(
      'Integrity, credibility, innovation, quality, teamwork, creativity, flexibility, satisfaction, success, management, and professionalism.',
    ),
  goals: z
    .string()
    .default(
      'Establish Elenor as a leading 360° marketing partner. Turn innovation into high-quality creative and production results.',
    ),
});

export const timelineSchema = z.object({
  heading: z.string().default('Milestones'),
  items: z
    .array(z.object({ year: z.string(), title: z.string(), description: z.string().default('') }))
    .default([]),
});

export const teamSchema = z.object({
  heading: z.string().default('The team'),
  members: z
    .array(
      z.object({
        name: z.string(),
        jobTitle: z.string().default(''),
        bio: z.string().default(''),
        photoMediaId: z.string().nullable().default(null),
      }),
    )
    .default([]),
});

export const aboutFaqSchema = z.object({
  eyebrow: z.string().default('Questions'),
  heading: z.string().default('About Elenor'),
});

/* --------------------------------- registry -------------------------------- */

export const sectionSchemas = {
  hero: heroSchema,
  philosophy: philosophySchema,
  services_showcase: servicesShowcaseSchema,
  stats: statsSchema,
  clients: clientsSchema,
  blog_preview: blogPreviewSchema,
  cta: ctaSectionSchema,
  about_hero: aboutHeroSchema,
  ceo_quote: ceoQuoteSchema,
  story: storySchema,
  values: valuesSchema,
  mission_vision: missionVisionSchema,
  brand_philosophy: brandPhilosophySchema,
  timeline: timelineSchema,
  team: teamSchema,
  about_faq: aboutFaqSchema,
} as const;

export type SectionType = keyof typeof sectionSchemas;
export type SectionData<T extends SectionType> = z.infer<(typeof sectionSchemas)[T]>;

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: 'Hero',
  philosophy: 'Philosophy',
  services_showcase: 'Services showcase',
  stats: 'Statistics',
  clients: 'Clients & testimonials',
  blog_preview: 'Blog preview',
  cta: 'Call to action',
  about_hero: 'About hero',
  ceo_quote: 'CEO quote',
  story: 'Company story',
  values: 'Values',
  mission_vision: 'Mission & vision',
  brand_philosophy: 'Brand philosophy',
  timeline: 'Timeline',
  team: 'Team',
  about_faq: 'About FAQ',
};

/** Parse section data leniently: invalid/missing fields fall back to defaults. */
export function parseSectionData<T extends SectionType>(
  type: T,
  data: unknown,
): SectionData<T> {
  const schema = sectionSchemas[type];
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data as SectionData<T>;
  return schema.parse({}) as SectionData<T>;
}
