# Elenor Marketing Agency — CMS-Powered Marketing Site

A cinematic, 3D scroll-driven marketing site built on semantic, server-rendered
HTML engineered for top-tier SEO / GEO / AEO — now backed by a **custom
database CMS with an admin dashboard at `/admin`**. Every piece of content
(pages, services, portfolio, blog, FAQ, navigation, settings, theme colors) is
editable by a non-technical user, and edits go live instantly — no rebuilds.

## Stack

**Public site**
- **Next.js 14** (App Router, RSC, SSG + tag-based revalidation)
- **React Three Fiber + drei**, **GSAP + ScrollTrigger**, **Lenis**, **Framer Motion**
- **Tailwind CSS** (brand palette resolves through CSS variables → themeable from the CMS)

**CMS**
- **Postgres** (Neon serverless in production, any Postgres locally) + **Drizzle ORM**
- **Custom session auth** (bcryptjs, httpOnly cookies, hashed session tokens) with roles:
  `SUPER_ADMIN` (everything) and `EDITOR` (content, media, inbox)
- **Tiptap** rich text (stored as JSON, rendered server-side)
- **Vercel Blob** for media uploads (client-side WebP compression, drag & drop)
- **zod** validation shared by admin forms and server actions

## First-time setup

1. **Install & environment**
   ```bash
   npm install
   cp .env.example .env.local   # then fill in the values
   ```
   - `DATABASE_URL` — free Postgres from https://neon.tech (or any local Postgres;
     e.g. `docker run -d --name elenor-cms-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=elenor -p 5433:5432 postgres:16-alpine`
     → `postgresql://postgres:postgres@localhost:5433/elenor`)
   - `BLOB_READ_WRITE_TOKEN` — Vercel dashboard → Storage → Blob (needed for uploads only)
   - `CRON_SECRET`, `PREVIEW_SECRET` — any long random strings
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` — the first Super Admin

2. **Create tables and seed all original content**
   ```bash
   npm run db:migrate   # applies drizzle/ SQL migrations
   npm run db:seed      # media registry, services, case studies + galleries,
                        # posts, FAQs, testimonials, menus, pages, settings, admin user
   ```
   The seed is idempotent — re-running never overwrites edits made in the admin.

3. **Run**
   ```bash
   npm run dev          # http://localhost:3000  ·  admin: /admin/login
   ```

### Deploying to Vercel
Set the same env vars in the Vercel project, add a Blob store, and deploy.
`vercel.json` schedules a daily cron (`/api/cron/publish-due`) that flips due
scheduled posts to published (they already appear on the site on time without
it — the cron just keeps statuses tidy). `generateStaticParams` reads the DB
at build time; if the DB is unreachable the build still succeeds and pages
render on demand.

## How content flows

- Public pages read through `src/lib/data/*` — cached with `unstable_cache`
  tags per collection/entity. Admin server actions (`src/server/actions/*`)
  validate with zod, write with Drizzle, then `revalidateTag`/`revalidatePath`
  so changes appear on the next request. Blog routes also carry
  `revalidate = 300` so *scheduled* posts go live within 5 minutes untouched.
- Draft preview: every editor links “Preview draft ↗” (`/api/preview`), which
  enables Next draft mode — uncached, draft-inclusive reads with an exit banner.
- JSON-LD (`MarketingAgency`, `Service`, `FAQPage`, `BreadcrumbList`,
  `BlogPosting`, `CreativeWork`), `sitemap.xml`, `robots.txt`, and `llms.txt`
  are all generated from the database (`src/lib/schema.ts` + route files).

## Admin map (`/admin`)

| Area | What it manages |
|---|---|
| Dashboard | Counts, drafts, recent edits, inbox highlights |
| Pages | Home & About sections (reorder, show/hide, edit copy, animation toggles) + per-page SEO for every hub page |
| Services | Full CRUD, drag reorder, publish toggle, FAQ per service, gallery, SEO |
| Work | Case studies: galleries per service, metrics, testimonial, featured, SEO |
| Blog | Rich-text posts, categories, tags, draft/publish/**schedule**, reading time, SEO |
| FAQ | Categories + questions, drag order, enable/disable (FAQPage schema auto-updates) |
| Testimonials | Quotes shown in the home reel |
| Media | Drag-drop uploads (auto-WebP), folders, alt/captions, replace, usage-checked delete |
| Inbox | Contact-form messages: status, notes, search, CSV export |
| Navigation | Header links, header button, footer Company column |
| Settings | Company/NAP/social (drives schema + llms.txt), contact form options, analytics IDs (GA4/GTM/Meta/TikTok), portfolio filters, brand colors |
| Users | Super Admin only: accounts, roles, password resets, session revocation |

## Scripts

- `npm run db:generate` — regenerate SQL migrations after schema changes (`src/db/schema/*`)
- `npm run db:migrate` / `npm run db:seed` / `npm run db:studio`
- `npm run admin:create` — create/reset a Super Admin from env vars

## Before production launch

- [ ] Confirm NAP (Nasr City vs Ard El-Golf), hours, founding year vs Google Business Profile (edit in Settings → Company).
- [ ] Replace the seeded placeholder blog bodies (all six posts) in the admin.
- [ ] Replace placeholder testimonial copy with approved client quotes.
- [ ] Add real `/public/og-image.jpg` + `/public/logo.png` (referenced by metadata & schema) and a favicon set.
- [ ] Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` to enable email notifications for new contact messages (sent to requests@elenor-marketing.com via the mailbox's SMTP server; leads already persist to the inbox regardless).
- [ ] Note: Vercel Hobby is licensed for non-commercial use — plan for Pro if Vercel flags the project.

# elenor-website-final-mobile-friendly
