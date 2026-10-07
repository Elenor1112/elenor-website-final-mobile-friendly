/**
 * Seeds the CMS database from the original static TypeScript content layer
 * and the files on disk under public/assets. Idempotent: re-running never
 * overwrites content that already exists (so admin edits are safe).
 *
 * Usage: npm run db:seed   (requires DATABASE_URL in .env.local; run
 * `npm run db:migrate` first)
 */
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { eq, sql } from 'drizzle-orm';
import { createScriptDb } from './db';
import * as schema from '../src/db/schema';
import { sectionSchemas, type SectionType } from '../src/lib/validation/sections';

// Original static content (relocated from src/content — kept as seed data).
import { site, stats as siteStats } from './seed-data/site';
import { services as serviceData } from './seed-data/services';
import {
  caseStudies as caseStudyData,
  caseStudyOrder,
  clientRoster,
  industries,
} from './seed-data/work';
import { posts as postData } from './seed-data/posts';
import { testimonials as testimonialData } from './seed-data/testimonials';

const db = createScriptDb();

const PUBLIC_ASSETS = path.join(process.cwd(), 'public', 'assets');

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

/* ------------------------------ tiptap helpers ----------------------------- */

type TiptapNode = Record<string, unknown>;
const text = (t: string, marks?: TiptapNode[]) =>
  ({ type: 'text', text: t, ...(marks ? { marks } : {}) }) as TiptapNode;
const link = (t: string, href: string) =>
  text(t, [{ type: 'link', attrs: { href, target: null, rel: null } }]);
const paragraph = (...content: TiptapNode[]) => ({ type: 'paragraph', content });
const heading = (level: number, t: string) => ({
  type: 'heading',
  attrs: { level },
  content: [text(t)],
});
const doc = (...content: TiptapNode[]) => ({ type: 'doc', content });

// The single placeholder article body previously hardcoded in
// src/app/(site)/blog/[slug]/page.tsx — assigned to every seeded post and
// flagged for replacement in the admin.
const placeholderBody = doc(
  paragraph(
    text(
      'This is a representative article body. In the production build, blog content is authored in the CMS and rendered from rich text — but the structure here shows the pattern: a direct opening that answers the title’s question, scannable subheads phrased the way people actually search, and contextual links into the services that can act on the idea.',
    ),
  ),
  heading(2, 'Why this matters now'),
  paragraph(
    text(
      'Search is splitting into two motions: discovery, where engines surface options, and answering, where an AI returns a single synthesized response. Winning both requires content that is specific, structured, and self-contained — exactly the kind of work covered on our ',
    ),
    link('social media', '/services/social-media'),
    text(' and '),
    link('web & app development', '/services/web-app-development'),
    text(' pages.'),
  ),
  heading(2, 'The practical takeaway'),
  paragraph(
    text(
      'Lead every page and section with a concrete claim, name real clients and numbers, and phrase headers as questions. That single habit does more for both classic SEO and AI citation than any amount of generic superlatives.',
    ),
  ),
);

/* ------------------------------- cover images ------------------------------ */

// Real cover photos per case-study slug (from ServicesShowcase.tsx).
const COVER_IMAGES: Record<string, string> = {
  mediconnect: '/assets/mediconnect/cover.webp',
  'duravit-event': '/assets/duravit/cover.jpg',
  'al-nesr-al-jawhari': '/assets/al-nesr-al-jawhari/cover.jpg',
  'al-walid-horse-resort': '/assets/al-walid-horse-resort/cover.jpg',
  'zoetis-social': '/assets/zoetis/cover.png',
  'marcyrl-printing': '/assets/marcyrl-pharmaceutical/cover.png',
  'saint-gobain-social': '/assets/saint-gobain/cover.jpg',
  'kiros-tours-brand': '/assets/kiro-s-tours/cover.jpg',
  'emaar-brand': '/assets/emaar/cover.jpg',
  'mmec-web': '/assets/mmec/cover.jpg',
  'coca-cola': '/assets/coca-cola/event-planning/01.webp',
  'blend-house': '/assets/blend-house/cover.webp',
  'dots-brand': '/assets/dots/cover.webp',
  'taza-brand': '/assets/taza/brand-identity/01.webp',
  'sirgona-brand': '/assets/sirgona/cover.webp',
  'ericsson-printing': '/assets/ericsson/cover.webp',
  'global-napi-video': '/assets/global-napi/cover.webp',
  'pantogar-social': '/assets/pantogar/cover.webp',
  'pfizer-printing': '/assets/pfizer/printing-production/01.webp',
  rizq: '/assets/rizq/cover.webp',
  'simba-brand': '/assets/simba/cover.webp',
  'icy-miray-brand': '/assets/icy-miray/cover.webp',
  'nemo-brand': '/assets/nemo/brand-identity/01.webp',
  'pro-sign-social': '/assets/pro-sign/social-media/01.webp',
  'robek-brand': '/assets/robek/brand-identity/01.webp',
  'new-alex-brand': '/assets/new-alex/brand-identity/01.webp',
  'ices-web': '/assets/ices/web-app-development/01.webp',
  'aiesec-social': '/assets/aiesec/social-media/01.webp',
  'mental-joy': '/assets/mental-joy/brand-identity/01.webp',
  'auto-group-social': '/assets/auto-group/social-media/01.webp',
  videology: '/assets/videology/brand-identity/03.webp',
  'cbre-interior': '/assets/cbre/interior-design/01.jpg',
  'renaissance-hotel-interior': '/assets/renaissance-hotel/interior-design/01.webp',
};

// 3D icon shape per service slug (from services/[slug]/page.tsx).
const ICON_SHAPES: Record<string, string> = {
  'brand-identity': 'badge',
  'social-media': 'torus',
  'web-app-development': 'sphere',
  'video-production': 'box',
  'ai-motion-graphics': 'torus',
  'event-planning': 'octa',
  'printing-production': 'box',
  giveaways: 'box',
  'interior-design': 'sphere',
};

/* --------------------------------- steps ----------------------------------- */

async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('· Skipping admin user (ADMIN_EMAIL/ADMIN_PASSWORD not set)');
    return;
  }
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) {
    console.log(`· Admin user ${email} already exists`);
    return;
  }
  await db.insert(schema.users).values({
    email,
    name: process.env.ADMIN_NAME ?? 'Super Admin',
    passwordHash: await bcrypt.hash(password, 12),
    role: 'SUPER_ADMIN',
  });
  console.log(`✓ Created SUPER_ADMIN ${email}`);
}

async function seedMedia(): Promise<Map<string, string>> {
  if (!fs.existsSync(PUBLIC_ASSETS)) {
    console.log('· public/assets not found — skipping media scan');
    return new Map();
  }

  // Folders: one per client dir, one child per service dir.
  const folderId = new Map<string, string>(); // "client" or "client/service" -> id
  const existingFolders = await db.query.mediaFolders.findMany();
  const folderKey = (name: string, parentId: string | null) => `${parentId ?? 'root'}:${name}`;
  const existingByKey = new Map(existingFolders.map((f) => [folderKey(f.name, f.parentId), f.id]));

  async function ensureFolder(name: string, parentId: string | null): Promise<string> {
    const key = folderKey(name, parentId);
    const found = existingByKey.get(key);
    if (found) return found;
    const [row] = await db
      .insert(schema.mediaFolders)
      .values({ name, parentId })
      .returning({ id: schema.mediaFolders.id });
    existingByKey.set(key, row.id);
    return row.id;
  }

  type FileEntry = { abs: string; url: string; folder: string };
  const files: FileEntry[] = [];
  for (const client of fs.readdirSync(PUBLIC_ASSETS, { withFileTypes: true })) {
    if (!client.isDirectory()) continue;
    const clientDir = path.join(PUBLIC_ASSETS, client.name);
    for (const entry of fs.readdirSync(clientDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const svcDir = path.join(clientDir, entry.name);
        for (const f of fs.readdirSync(svcDir)) {
          if (!MIME[path.extname(f).toLowerCase()]) continue;
          files.push({
            abs: path.join(svcDir, f),
            url: `/assets/${client.name}/${entry.name}/${f}`,
            folder: `${client.name}/${entry.name}`,
          });
        }
      } else if (MIME[path.extname(entry.name).toLowerCase()]) {
        files.push({
          abs: path.join(clientDir, entry.name),
          url: `/assets/${client.name}/${entry.name}`,
          folder: client.name,
        });
      }
    }
  }

  for (const key of new Set(files.map((f) => f.folder))) {
    const [clientName, svcName] = key.split('/');
    const clientId = await ensureFolder(clientName, null);
    folderId.set(clientName, clientId);
    if (svcName) folderId.set(key, await ensureFolder(svcName, clientId));
  }

  const existingUrls = new Set(
    (await db.select({ url: schema.media.url }).from(schema.media)).map((m) => m.url),
  );

  const rows: (typeof schema.media.$inferInsert)[] = [];
  for (const f of files) {
    if (existingUrls.has(f.url)) continue;
    const ext = path.extname(f.abs).toLowerCase();
    const stat = fs.statSync(f.abs);
    let width: number | null = null;
    let height: number | null = null;
    try {
      const meta = await sharp(f.abs).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {
      /* svg/undecodable — dimensions stay null */
    }
    // Derive a human alt from the path: "coca-cola event-planning 01".
    const alt = f.url
      .replace('/assets/', '')
      .replace(/\.[a-z0-9]+$/i, '')
      .split('/')
      .join(' — ')
      .replace(/-/g, ' ');
    rows.push({
      folderId: folderId.get(f.folder) ?? null,
      filename: path.basename(f.abs),
      url: f.url,
      storage: 'local',
      mimeType: MIME[ext],
      sizeBytes: stat.size,
      width,
      height,
      alt,
    });
  }

  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(schema.media).values(rows.slice(i, i + 50)).onConflictDoNothing({
      target: schema.media.url,
    });
  }
  console.log(`✓ Media: ${rows.length} new file(s) registered (${files.length} on disk)`);

  const all = await db.select({ id: schema.media.id, url: schema.media.url }).from(schema.media);
  return new Map(all.map((m) => [m.url, m.id]));
}

async function seedSettings() {
  const values: { key: string; value: Record<string, unknown> }[] = [
    {
      key: 'site',
      value: {
        name: site.name,
        shortName: site.shortName,
        tagline: site.tagline,
        url: site.url,
        foundingYear: site.foundingYear,
        description: site.description,
        email: site.email,
        phone: site.phone,
        phoneDisplay: site.phoneDisplay,
        whatsapp: site.whatsapp,
        address: { ...site.address },
        hours: { days: [...site.hours.days], opens: site.hours.opens, closes: site.hours.closes },
        founder: { ...site.founder },
        social: { ...site.social },
        featuredClients: [
          'Coca-Cola', 'Saint-Gobain', 'Duravit', 'Zoetis', 'Emaar', 'ICES', 'Mediconnect',
          'Marcyrl', 'IBSA Derma', 'MMEC', 'Al-Nesr Al-Jawhari', 'Videology', "Kiro's Tours",
          'H&Z Law Firm', 'Al-Walid Horse Resort', 'Pro-Sign',
        ],
      },
    },
    { key: 'theme', value: {} }, // schema defaults carry the current palette
    { key: 'analytics', value: {} },
    {
      key: 'contact',
      value: {
        budgets: ['Under EGP 25k', 'EGP 25k–75k', 'EGP 75k–200k', 'EGP 200k+', 'Not sure yet'],
        notifyEmails: [site.email],
        mapEmbedSrc: '',
      },
    },
    { key: 'work', value: { industries: [...industries] } },
  ];
  await db.insert(schema.settings).values(values).onConflictDoNothing({
    target: schema.settings.key,
  });
  console.log('✓ Settings seeded (existing keys preserved)');
}

async function seedServices() {
  const rows = serviceData.map((s, i) => ({
    slug: s.slug,
    title: s.title,
    name: s.name,
    short: s.short,
    lede: s.lede,
    metaDescription: s.metaDescription,
    included: [...s.included],
    process: [...s.process],
    proof: [...s.proof],
    faqs: s.faq.map((f) => ({ q: f.q, a: f.a })),
    accent: s.accent,
    icon: ICON_SHAPES[s.slug] ?? 'box',
    sortOrder: i,
    status: 'published' as const,
  }));
  await db.insert(schema.services).values(rows).onConflictDoNothing({
    target: schema.services.slug,
  });
  console.log(`✓ Services: ${rows.length} seeded`);
}

async function seedWork(mediaByUrl: Map<string, string>) {
  // Apply the explicit lead order (caseStudyOrder) first, then everything else
  // in its source array order, so sortOrder matches the intended display order.
  const orderedData = [...caseStudyData].sort((a, b) => {
    const ai = caseStudyOrder.indexOf(a.slug);
    const bi = caseStudyOrder.indexOf(b.slug);
    const an = ai === -1 ? caseStudyOrder.length + caseStudyData.indexOf(a) : ai;
    const bn = bi === -1 ? caseStudyOrder.length + caseStudyData.indexOf(b) : bi;
    return an - bn;
  });
  const inserted = await db
    .insert(schema.caseStudies)
    .values(
      orderedData.map((c, i) => ({
        slug: c.slug,
        client: c.client,
        industry: c.industry,
        // Primary first, then any extras — matches caseStudyInputSchema's shape.
        industries: [...new Set([c.industry, ...(c.industries ?? [])])],
        services: [...c.services],
        categories: [...c.categories],
        result: c.result,
        coverImageId: COVER_IMAGES[c.slug] ? mediaByUrl.get(COVER_IMAGES[c.slug]) ?? null : null,
        sortOrder: i,
        status: 'published' as const,
      })),
    )
    .onConflictDoNothing({ target: schema.caseStudies.slug })
    .returning({ id: schema.caseStudies.id, slug: schema.caseStudies.slug });

  // Galleries only for freshly-inserted case studies (never touch edited ones).
  let galleryCount = 0;
  for (const row of inserted) {
    const cs = caseStudyData.find((c) => c.slug === row.slug);
    if (!cs) continue;
    let order = 0;
    for (const label of cs.services) {
      const dirRel = `${slugify(cs.client)}/${slugify(label)}`;
      const dirAbs = path.join(PUBLIC_ASSETS, dirRel);
      if (!fs.existsSync(dirAbs)) continue;
      const imgs = fs
        .readdirSync(dirAbs)
        .filter((f) => MIME[path.extname(f).toLowerCase()])
        .sort()
        .map((f) => mediaByUrl.get(`/assets/${dirRel}/${f}`))
        .filter((id): id is string => Boolean(id));
      if (imgs.length === 0) continue;
      const [gallery] = await db
        .insert(schema.caseStudyGalleries)
        .values({ caseStudyId: row.id, label, serviceSlug: slugify(label), sortOrder: order++ })
        .returning({ id: schema.caseStudyGalleries.id });
      await db.insert(schema.caseStudyGalleryImages).values(
        imgs.map((mediaId, i) => ({ galleryId: gallery.id, mediaId, sortOrder: i })),
      );
      galleryCount++;
    }
  }
  console.log(`✓ Case studies: ${inserted.length} new, ${galleryCount} galleries`);

  const rosterCount = await db.select({ n: sql<number>`count(*)` }).from(schema.rosterClients);
  if (Number(rosterCount[0].n) === 0) {
    await db.insert(schema.rosterClients).values(
      clientRoster.map((r, i) => ({ name: r.name, industries: [...r.industries], sortOrder: i })),
    );
    console.log(`✓ Roster clients: ${clientRoster.length} seeded`);
  }
}

async function seedPosts() {
  const categoryNames = [...new Set(postData.map((p) => p.category))];
  await db
    .insert(schema.postCategories)
    .values(categoryNames.map((name, i) => ({ slug: slugify(name), name, sortOrder: i })))
    .onConflictDoNothing({ target: schema.postCategories.slug });
  const cats = await db.select().from(schema.postCategories);
  const catId = new Map(cats.map((c) => [c.name, c.id]));

  await db
    .insert(schema.posts)
    .values(
      postData.map((p) => ({
        slug: p.slug,
        title: p.title,
        excerpt: p.dek,
        body: placeholderBody as never,
        authorName: p.author.name,
        authorTitle: p.author.title,
        categoryId: catId.get(p.category) ?? null,
        status: 'published' as const,
        publishedAt: new Date(p.date),
        readingMinutes: p.readMinutes,
      })),
    )
    .onConflictDoNothing({ target: schema.posts.slug });
  console.log(`✓ Posts: ${postData.length} seeded (placeholder bodies — replace in admin)`);
}

async function seedFaqs() {
  const count = await db.select({ n: sql<number>`count(*)` }).from(schema.faqs);
  if (Number(count[0].n) > 0) {
    console.log('· FAQs already present — skipping');
    return;
  }
  await db
    .insert(schema.faqCategories)
    .values([
      { slug: 'general', name: 'General', sortOrder: 0 },
      { slug: 'about', name: 'About Elenor', sortOrder: 1 },
    ])
    .onConflictDoNothing({ target: schema.faqCategories.slug });
  const cats = await db.select().from(schema.faqCategories);
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  const general = [
    { q: 'Where is Elenor Marketing Agency located?', a: `${site.address.street}, ${site.address.locality}, ${site.address.region}, ${site.address.countryName}.` },
    { q: 'How long has Elenor been operating?', a: `Since ${site.foundingYear}, with 100+ projects delivered for 50+ clients.` },
    { q: 'How does Elenor price its work?', a: 'Pricing is scoped per project based on your size, industry, and goals — we provide a clear quote after an initial discovery conversation rather than a one-size-fits-all rate card.' },
    { q: 'Can Elenor handle multiple services for one brand?', a: 'Yes. The advantage of an in-house team across nine services is a consistent brand experience from strategy to execution under one point of contact.' },
  ];
  const about = [
    { q: 'What industries does Elenor Marketing Agency work with?', a: 'We work across pharmaceuticals and healthcare, FMCG, real estate, automotive, hospitality, law firms, and beauty — among others, based on our active client list.' },
    { q: 'Where is Elenor Marketing Agency located?', a: `Elenor is based at ${site.address.street}, ${site.address.locality}, ${site.address.region}, ${site.address.countryName}.` },
    { q: 'How long has Elenor been operating?', a: `Since ${site.foundingYear}, with 100+ successful projects delivered for 50+ clients.` },
    { q: 'Does Elenor work with international and regional clients, not just Egypt?', a: 'Yes. While we are based in Cairo, we serve clients across Egypt and the wider region, including multinational brands.' },
  ];

  await db.insert(schema.faqs).values([
    ...general.map((f, i) => ({ question: f.q, answer: f.a, categoryId: catId.get('general'), sortOrder: i })),
    ...about.map((f, i) => ({ question: f.q, answer: f.a, categoryId: catId.get('about'), sortOrder: i })),
  ]);
  console.log(`✓ FAQs: ${general.length + about.length} seeded`);
}

async function seedTestimonials() {
  // Top-up: only insert seed testimonials whose company isn't already present,
  // so re-running never duplicates or overwrites admin edits.
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const existing = await db.select({ company: schema.testimonials.company }).from(schema.testimonials);
  const have = new Set(existing.map((r) => key(r.company)));
  const missing = testimonialData.filter((t) => !have.has(key(t.company)));
  if (missing.length === 0) return;
  await db.insert(schema.testimonials).values(
    missing.map((t, i) => ({
      quote: t.quote,
      author: t.author,
      role: t.role,
      company: t.company,
      sortOrder: existing.length + i,
    })),
  );
  console.log(`✓ Testimonials: ${missing.length} seeded`);
}

async function seedMenus() {
  const defs: { slug: string; name: string; items: { label: string; url: string }[] }[] = [
    {
      slug: 'header',
      name: 'Header navigation',
      items: [
        { label: 'About', url: '/about' },
        { label: 'Services', url: '/services' },
        { label: 'Work', url: '/work' },
        { label: 'Blog', url: '/blog' },
        { label: 'FAQ', url: '/faq' },
      ],
    },
    {
      slug: 'header-cta',
      name: 'Header call-to-action',
      items: [{ label: 'Start a project', url: '/contact' }],
    },
    {
      slug: 'footer-company',
      name: 'Footer — Company column',
      items: [
        { label: 'About', url: '/about' },
        { label: 'Work', url: '/work' },
        { label: 'Blog', url: '/blog' },
        { label: 'FAQ', url: '/faq' },
        { label: 'Contact', url: '/contact' },
      ],
    },
  ];
  for (const def of defs) {
    await db
      .insert(schema.menus)
      .values({ slug: def.slug, name: def.name })
      .onConflictDoNothing({ target: schema.menus.slug });
    const menu = await db.query.menus.findFirst({ where: eq(schema.menus.slug, def.slug) });
    if (!menu) continue;
    const items = await db
      .select({ id: schema.menuItems.id })
      .from(schema.menuItems)
      .where(eq(schema.menuItems.menuId, menu.id));
    if (items.length > 0) continue;
    await db.insert(schema.menuItems).values(
      def.items.map((it, i) => ({ menuId: menu.id, label: it.label, url: it.url, sortOrder: i })),
    );
  }
  console.log('✓ Menus seeded');
}

async function seedPages() {
  // Per-page SEO rows (defaults = the previously hardcoded metadata exports).
  const pageDefs: { slug: string; title: string; seoTitle: string; seoDescription: string }[] = [
    { slug: 'home', title: 'Homepage', seoTitle: 'Full-Service Branding, Marketing & Digital Agency in Cairo, Egypt', seoDescription: 'Elenor Marketing Agency is a Cairo-based full-service agency offering brand identity, social media, video production, web & app development, events, and printing for 50+ clients including Coca-Cola, Saint-Gobain, and Duravit.' },
    { slug: 'about', title: 'About', seoTitle: 'About — Cairo-Based Branding & Marketing Team', seoDescription: 'Meet the team behind Elenor Marketing Agency, led by CEO Emad Samir — a Cairo-based agency building tailored marketing strategies for startups and enterprise clients since 2021.' },
    { slug: 'services', title: 'Services', seoTitle: 'Services — Branding, Social, Video, Web & More', seoDescription: 'Explore Elenor Marketing Agency’s nine services: brand identity, social media, web & app development, video, AI & motion graphics, events, printing, giveaways, and interior design.' },
    { slug: 'work', title: 'Work', seoTitle: 'Our Work — Portfolio', seoDescription: 'Browse Elenor Marketing Agency’s portfolio — branding, social media, video, and web projects delivered for Coca-Cola, Saint-Gobain, Duravit, Zoetis, Emaar, and more.' },
    { slug: 'blog', title: 'Blog', seoTitle: 'Marketing & Branding Insights — Blog', seoDescription: 'Practical marketing, branding, and digital strategy insights from the Elenor Marketing Agency team — covering social media, SEO, AEO, branding, and industry trends.' },
    { slug: 'faq', title: 'FAQ', seoTitle: 'Frequently Asked Questions', seoDescription: 'Answers to common questions about Elenor Marketing Agency’s services, pricing approach, process, and location in Cairo, Egypt.' },
    { slug: 'contact', title: 'Contact', seoTitle: 'Contact — Cairo, Egypt', seoDescription: 'Get in touch with Elenor Marketing Agency — call, WhatsApp, email, or visit us at 28 Mohamed Abdel Hady Street, Nasr City, Cairo. We reply within one business day.' },
  ];
  await db.insert(schema.pages).values(pageDefs).onConflictDoNothing({
    target: schema.pages.slug,
  });
  const pageRows = await db.select().from(schema.pages);
  const pageId = new Map(pageRows.map((p) => [p.slug, p.id]));

  // Sections carry zod-schema defaults (which equal the current live copy).
  const sectionDefs: Record<string, { type: SectionType; enabled?: boolean }[]> = {
    home: [
      { type: 'hero' },
      { type: 'philosophy' },
      { type: 'services_showcase' },
      { type: 'stats' },
      { type: 'clients' },
      { type: 'blog_preview' },
      { type: 'cta' },
    ],
    about: [
      { type: 'about_hero' },
      { type: 'ceo_quote' },
      { type: 'story' },
      { type: 'brand_philosophy' },
      { type: 'values', enabled: false },
      { type: 'mission_vision', enabled: false },
      { type: 'timeline', enabled: false },
      { type: 'team', enabled: false },
      { type: 'about_faq' },
      { type: 'cta' },
    ],
  };

  for (const [slug, sections] of Object.entries(sectionDefs)) {
    const id = pageId.get(slug);
    if (!id) continue;
    const existing = await db
      .select({ id: schema.pageSections.id })
      .from(schema.pageSections)
      .where(eq(schema.pageSections.pageId, id));
    if (existing.length > 0) continue;

    await db.insert(schema.pageSections).values(
      sections.map((s, i) => {
        const data = sectionSchemas[s.type].parse({}) as Record<string, unknown>;
        // The stats section's live values come from site.ts.
        if (s.type === 'stats') data.items = siteStats.map((x) => ({ ...x }));
        return {
          pageId: id,
          type: s.type,
          data,
          sortOrder: i,
          isEnabled: s.enabled ?? true,
        };
      }),
    );
  }
  console.log('✓ Pages & sections seeded');
}

/* ---------------------------------- main ----------------------------------- */

async function main() {
  console.log('Seeding CMS database…');
  await seedAdminUser();
  const mediaByUrl = await seedMedia();
  await seedSettings();
  await seedServices();
  await seedWork(mediaByUrl);
  await seedPosts();
  await seedFaqs();
  await seedTestimonials();
  await seedMenus();
  await seedPages();
  console.log('Done.');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
