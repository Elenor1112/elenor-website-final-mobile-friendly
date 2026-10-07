// Portfolio case studies. Real case study cards (client, industry, service,
// outcome) per brief §8.4 — replaces the raw image-grid-with-no-context format.
// Each case study page shows a per-service image gallery (see ClientCaseStudy).

export type CaseStudy = {
  slug: string;
  client: string;
  /** Primary industry — the badge shown on the /work card. */
  industry: string;
  /**
   * Extra industries this study also filters under on /work, beyond `industry`.
   * e.g. Coca-Cola is primarily FMCG but also shows under Industrial.
   */
  industries?: string[];
  services: string[];
  // Filter tags for the services showcase grid. Mirrors `services` (the service
  // names a case study is tagged with) as a dedicated, explicit field so the
  // showcase filter and any future re-tagging stay decoupled from `services`.
  categories: string[];
  result: string;
};

// One service tab on a case study page: a label and the images shown under it.
export type ServiceGallery = {
  id: string;
  label: string;
  images: string[]; // public paths under /assets/[client]/[service]/
};

// Shape consumed by the tabbed case-study gallery.
export type ClientCaseStudy = {
  clientName: string;
  services: ServiceGallery[];
};

export const industries = [
  'All',
  'Healthcare',
  'Pharmaceuticals',
  'Real Estate & Constructions',
  'FMCG',
  'Food & Beverages',
  'Automotive',
  'Media Production',
  'Law Firms',
  'Institutions',
  'Facility Management',
  'Home Appliances',
  'Hospitality',
  'Industrial',
  'Tech',
] as const;

// Clients shown in the industry filter that don't have a case study page yet —
// name + industries only. Promote an entry to `caseStudies` (with services,
// result, and gallery assets) when its content lands.
export type RosterClient = {
  name: string;
  industries: string[];
};

export const clientRoster: RosterClient[] = [
  // Healthcare
  { name: 'IBSA Derma', industries: ['Healthcare'] },
  { name: 'VCC', industries: ['Healthcare'] },
  // Automotive
  { name: 'Four Whales', industries: ['Automotive'] },
  // Media Production
  { name: 'Icon', industries: ['Media Production'] },
  // Law Firms
  { name: 'H&Z Law Firm', industries: ['Law Firms'] },
  { name: 'Ehab Makram', industries: ['Law Firms'] },
  // Pharmaceuticals
  { name: 'GSK', industries: ['Pharmaceuticals'] },
  { name: 'Rose Beauty', industries: ['Pharmaceuticals'] },
  { name: 'MDI', industries: ['Pharmaceuticals'] },
  // Real Estate & Constructions
  { name: 'iCity', industries: ['Real Estate & Constructions'] },
  { name: 'Land Bank', industries: ['Real Estate & Constructions'] },
  { name: 'Better Life', industries: ['Real Estate & Constructions'] },
];

export const caseStudies: CaseStudy[] = [
  {
    slug: 'mediconnect',
    client: 'MediConnect',
    industry: 'Healthcare',
    services: ['Brand Identity', 'Social Media', 'Web & App Development'],
    categories: ['Brand Identity', 'Social Media', 'Web & App Development'],
    result:
      'An end-to-end healthcare brand — identity, social presence, and a website & app — built to feel trustworthy and modern.',
  },
  {
    slug: 'al-nesr-al-jawhari',
    client: 'Al-Nesr Al-Jawhari',
    industry: 'FMCG',
    services: ['Brand Identity', 'Web & App Development', 'Interior Design', 'Printing & Production', 'Giveaways'],
    categories: ['Brand Identity', 'Web & App Development', 'Interior Design', 'Printing & Production', 'Giveaways'],
    result: 'A unified brand identity and a fast, mobile-first web presence built from scratch.',
  },
  {
    slug: 'zoetis-social',
    client: 'Zoetis',
    industry: 'Healthcare',
    services: ['Social Media', 'Giveaways'],
    categories: ['Social Media', 'Giveaways'],
    result: 'A consistent, scientifically-credible social presence across multiple platforms, extended into branded giveaways.',
  },
  {
    slug: 'saint-gobain-social',
    client: 'Saint-Gobain',
    industry: 'Industrial',
    services: ['Social Media', 'Printing & Production', 'Giveaways'],
    categories: ['Social Media', 'Printing & Production', 'Giveaways'],
    result:
      'An on-brand, consistent social presence for a global building-materials leader — extended into print and production.',
  },
  {
    slug: 'emaar-brand',
    client: 'Emaar',
    industry: 'Real Estate & Constructions',
    services: ['Brand Identity'],
    categories: ['Brand Identity'],
    result: 'A cohesive brand identity applied across print, apparel, and on-site collateral.',
  },
  {
    slug: 'duravit-event',
    client: 'Duravit',
    industry: 'Home Appliances',
    services: ['Event Planning', 'Printing & Production'],
    categories: ['Event Planning', 'Printing & Production'],
    result: 'A polished, on-brand event experience — staging, print, and production delivered end to end.',
  },
  {
    slug: 'al-walid-horse-resort',
    client: 'Al-Walid Horse Resort',
    industry: 'Institutions',
    services: ['Web & App Development'],
    categories: ['Web & App Development'],
    result: 'A fast, mobile-first digital presence that captures the resort experience.',
  },
  {
    slug: 'marcyrl-printing',
    client: 'Marcyrl Pharmaceutical',
    industry: 'Pharmaceuticals',
    services: ['Printing & Production'],
    categories: ['Printing & Production'],
    result: 'Precise, on-brand printing and production for a pharmaceutical leader.',
  },
  {
    slug: 'kiros-tours-brand',
    client: "Kiro's Tours",
    industry: 'Hospitality',
    services: ['Social Media'],
    categories: ['Social Media'],
    result: 'A distinctive travel brand with a social presence to match.',
  },
  {
    slug: 'mmec-web',
    client: 'MMEC',
    industry: 'Real Estate & Constructions',
    services: ['Web & App Development'],
    categories: ['Web & App Development'],
    result: 'A fast, mobile-first corporate site with an SEO-ready foundation.',
  },
  {
    slug: 'coca-cola',
    client: 'Coca-Cola',
    industry: 'FMCG',
    industries: ['Industrial'],
    services: ['Event Planning', 'Giveaways', 'Printing & Production', 'Interior Design'],
    categories: ['Event Planning', 'Giveaways', 'Printing & Production', 'Interior Design'],
    result:
      'Events, branded giveaways, interior fit-out, and on-site production delivered end to end at global-brand standard.',
  },
  {
    slug: 'blend-house',
    client: 'Blend House',
    industry: 'Food & Beverages',
    services: ['Brand Identity', 'Social Media'],
    categories: ['Brand Identity', 'Social Media'],
    result:
      'A full brand identity — logo system, menus, and company profile — extended into a social presence with the same flavour.',
  },
  {
    slug: 'dots-brand',
    client: 'DOTS',
    industry: 'Food & Beverages',
    services: ['Brand Identity'],
    categories: ['Brand Identity'],
    result: 'A playful, appetite-driven restaurant identity — logo, menus, and packaging.',
  },
  {
    slug: 'taza-brand',
    client: 'Taza',
    industry: 'Food & Beverages',
    services: ['Brand Identity'],
    categories: ['Brand Identity'],
    result: 'A fresh bakery brand identity carried through logo, packaging, and a full menu system.',
  },
  {
    slug: 'sirgona-brand',
    client: 'Sirgona',
    industry: 'Real Estate & Constructions',
    services: ['Brand Identity', 'Printing & Production'],
    categories: ['Brand Identity', 'Printing & Production'],
    result: 'A real-estate brand identity carried through into print and production collateral.',
  },
  {
    slug: 'ericsson-printing',
    client: 'Ericsson',
    industry: 'Tech',
    services: ['Printing & Production'],
    categories: ['Printing & Production'],
    result:
      'Business cards, roll-ups, and branded event pieces produced to a global tech brand’s standard.',
  },
  {
    slug: 'global-napi-video',
    client: 'Global Napi',
    industry: 'Pharmaceuticals',
    industries: ['Industrial'],
    services: ['Video Production'],
    categories: ['Video Production'],
    result:
      'Concept-to-edit corporate video production for one of Egypt’s leading pharmaceutical manufacturers.',
  },
  {
    slug: 'pantogar-social',
    client: 'Pantogar',
    industry: 'Pharmaceuticals',
    services: ['Social Media'],
    categories: ['Social Media'],
    result: 'On-brand social content for a leading hair-health brand.',
  },
  {
    slug: 'rizq',
    client: 'Rizq',
    industry: 'Law Firms',
    services: ['Social Media', 'Web & App Development'],
    categories: ['Social Media', 'Web & App Development'],
    result:
      'A credible digital presence for a law firm — sharp social content backed by a fast, modern website.',
  },
  {
    slug: 'simba-brand',
    client: 'Simba',
    industry: 'FMCG',
    services: ['Brand Identity'],
    categories: ['Brand Identity'],
    result: 'A bold FMCG brand identity carried across packaging, stickers, and signage.',
  },
  {
    slug: 'icy-miray-brand',
    client: 'Icy Miray',
    industry: 'FMCG',
    services: ['Brand Identity'],
    categories: ['Brand Identity'],
    result: 'A fresh dairy brand identity brought to life across cheese packaging.',
  },
  {
    slug: 'pfizer-printing',
    client: 'Pfizer',
    industry: 'Pharmaceuticals',
    services: ['Printing & Production'],
    categories: ['Printing & Production'],
    result: 'Precise, on-brand printing and production for a global pharmaceutical leader.',
  },
  {
    slug: 'nemo-brand',
    client: 'Nemo',
    industry: 'Institutions',
    services: ['Brand Identity'],
    categories: ['Brand Identity'],
    result: 'A distinctive brand identity built from the ground up.',
  },
  {
    slug: 'pro-sign-social',
    client: 'Pro-Sign',
    industry: 'Automotive',
    services: ['Social Media'],
    categories: ['Social Media'],
    result: 'On-brand social content that makes an automotive protection brand stand out.',
  },
  {
    slug: 'robek-brand',
    client: 'ROBEK',
    industry: 'Home Appliances',
    services: ['Brand Identity'],
    categories: ['Brand Identity'],
    result: 'A clean, modern brand identity for a home-appliances brand.',
  },
  {
    slug: 'new-alex-brand',
    client: 'New Alex',
    industry: 'FMCG',
    services: ['Brand Identity'],
    categories: ['Brand Identity'],
    result: 'A fresh FMCG brand identity carried across packaging and collateral.',
  },
  {
    slug: 'ices-web',
    client: 'ICES',
    industry: 'Institutions',
    services: ['Web & App Development'],
    categories: ['Web & App Development'],
    result: 'A fast, mobile-first web presence built from scratch.',
  },
  {
    slug: 'aiesec-social',
    client: 'AIESEC',
    industry: 'Institutions',
    services: ['Social Media'],
    categories: ['Social Media'],
    result: 'A consistent, on-brand social presence for a global youth organization.',
  },
  {
    slug: 'mental-joy',
    client: 'Mental Joy',
    industry: 'Healthcare',
    services: ['Brand Identity', 'Social Media'],
    categories: ['Brand Identity', 'Social Media'],
    result:
      'A warm mental-health brand identity extended into a relatable, on-brand social presence.',
  },
  {
    slug: 'auto-group-social',
    client: 'Auto Group',
    industry: 'Automotive',
    services: ['Social Media'],
    categories: ['Social Media'],
    result: 'On-brand social content for an automotive brand.',
  },
  {
    slug: 'videology',
    client: 'Videology',
    industry: 'Media Production',
    services: ['Brand Identity', 'Web & App Development'],
    categories: ['Brand Identity', 'Web & App Development'],
    result:
      'A full brand identity carried through into a fast, modern website and app for a production house.',
  },
  {
    slug: 'cbre-interior',
    client: 'CBRE',
    industry: 'Facility Management',
    services: ['Interior Design'],
    categories: ['Interior Design'],
    result: 'A refined interior fit-out for a global commercial real-estate leader.',
  },
  {
    slug: 'renaissance-hotel-interior',
    client: 'Renaissance Hotel',
    industry: 'Hospitality',
    services: ['Interior Design'],
    categories: ['Interior Design'],
    result: 'A polished, hospitality-grade interior design brought to life across the property.',
  },
];

// Explicit display order for /work and the home services showcase. Slugs listed
// here sort first, in this order; anything not listed keeps its array order
// after them. The client asked for these seven to lead (Coca-Cola, Duravit,
// Zoetis, Al-Nesr Al-Jawhari, Pantogar, Saint-Gobain, Pfizer).
export const caseStudyOrder: string[] = [
  'coca-cola',
  'duravit-event',
  'zoetis-social',
  'al-nesr-al-jawhari',
  'pantogar-social',
  'saint-gobain-social',
  'pfizer-printing',
];

export const getCaseStudy = (slug: string) => caseStudies.find((c) => c.slug === slug);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Gallery images per service tab. Placeholder paths for now —
// /assets/[client-name]/[service-tab]/NN.jpg — swapped for real shots as they
// land in public/assets without touching the page or component.
const IMAGES_PER_SERVICE = 8;

// Real image counts for galleries whose shots have landed in public/assets,
// keyed by `[client-slug]/[service-slug]`. Anything not listed keeps the
// IMAGES_PER_SERVICE placeholder count.
const IMAGE_COUNTS: Record<string, number> = {
  'mediconnect/brand-identity': 5,
  'mediconnect/social-media': 5,
  'mediconnect/web-app-development': 5,
  'saint-gobain/social-media': 8,
  'emaar/brand-identity': 8,
  'duravit/event-planning': 5,
  'marcyrl-pharmaceutical/printing-production': 4,
  'al-walid-horse-resort/web-app-development': 7,
  'mmec/web-app-development': 5,
  'kiro-s-tours/social-media': 7,
  'zoetis/social-media': 7,
  'al-nesr-al-jawhari/brand-identity': 6,
  'al-nesr-al-jawhari/interior-design': 8,
  'al-nesr-al-jawhari/printing-production': 9,
  'al-nesr-al-jawhari/web-app-development': 6,
  'coca-cola/event-planning': 32,
  'coca-cola/giveaways': 43,
  'coca-cola/printing-production': 28,
  'coca-cola/interior-design': 9,
  'renaissance-hotel/interior-design': 7,
  'cbre/interior-design': 2,
  'saint-gobain/giveaways': 1,
  'zoetis/giveaways': 1,
  'al-nesr-al-jawhari/giveaways': 1,
  'blend-house/brand-identity': 31,
  'blend-house/social-media': 9,
  'dots/brand-identity': 15,
  'taza/brand-identity': 11,
  'sirgona/brand-identity': 2,
  'sirgona/printing-production': 5,
  'duravit/printing-production': 7,
  'ericsson/printing-production': 10,
  'global-napi/video-production': 11,
  'pantogar/social-media': 5,
  'pfizer/printing-production': 5,
  'rizq/social-media': 7,
  'rizq/web-app-development': 4,
  'saint-gobain/printing-production': 6,
  'simba/brand-identity': 6,
  'icy-miray/brand-identity': 3,
  'nemo/brand-identity': 6,
  'pro-sign/social-media': 5,
  'robek/brand-identity': 5,
  'new-alex/brand-identity': 7,
  'ices/web-app-development': 4,
  'aiesec/social-media': 5,
  'mental-joy/brand-identity': 7,
  'mental-joy/social-media': 6,
  'auto-group/social-media': 3,
  'videology/brand-identity': 7,
  'videology/web-app-development': 4,
};

// File extension per gallery dir, for shots that aren't .jpg (e.g. PNG UI
// screens, or galleries optimized to WebP). Anything not listed defaults to 'jpg'.
const IMAGE_EXT: Record<string, string> = {
  'al-nesr-al-jawhari/web-app-development': 'png',
  'blend-house/brand-identity': 'webp',
  'blend-house/social-media': 'webp',
  'coca-cola/event-planning': 'webp',
  'coca-cola/giveaways': 'webp',
  'coca-cola/printing-production': 'webp',
  // coca-cola/interior-design + cbre/interior-design + saint-gobain/giveaways default to 'jpg'
  'renaissance-hotel/interior-design': 'webp',
  'zoetis/giveaways': 'webp',
  'al-nesr-al-jawhari/giveaways': 'png',
  'dots/brand-identity': 'webp',
  'duravit/printing-production': 'webp',
  'ericsson/printing-production': 'webp',
  'global-napi/video-production': 'webp',
  'pantogar/social-media': 'webp',
  'pfizer/printing-production': 'webp',
  'rizq/social-media': 'webp',
  'rizq/web-app-development': 'webp',
  'saint-gobain/printing-production': 'webp',
  'simba/brand-identity': 'webp',
  'icy-miray/brand-identity': 'webp',
  'sirgona/brand-identity': 'webp',
  'sirgona/printing-production': 'webp',
  'taza/brand-identity': 'webp',
  'nemo/brand-identity': 'webp',
  'pro-sign/social-media': 'webp',
  'robek/brand-identity': 'webp',
  'new-alex/brand-identity': 'webp',
  'ices/web-app-development': 'webp',
  'aiesec/social-media': 'webp',
  'mental-joy/brand-identity': 'webp',
  'mental-joy/social-media': 'webp',
  'auto-group/social-media': 'webp',
  'videology/brand-identity': 'webp',
  'videology/web-app-development': 'webp',
};

export const getClientCaseStudy = (c: CaseStudy): ClientCaseStudy => ({
  clientName: c.client,
  services: c.services.map((label) => {
    const id = slugify(label);
    const dir = `${slugify(c.client)}/${id}`;
    const ext = IMAGE_EXT[dir] ?? 'jpg';
    return {
      id,
      label,
      images: Array.from(
        { length: IMAGE_COUNTS[dir] ?? IMAGES_PER_SERVICE },
        (_, i) => `/assets/${dir}/${String(i + 1).padStart(2, '0')}.${ext}`
      ),
    };
  }),
});
