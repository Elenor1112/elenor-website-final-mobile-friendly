import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getPost, getPostSlugs } from '@/lib/data/posts';
import { getServices } from '@/lib/data/services';
import { getSiteSettings } from '@/lib/data/settings';
import { blogPostingSchema, breadcrumbSchema } from '@/lib/schema';
import { JsonLd } from '@/components/JsonLd';
import { CTA } from '@/components/sections/CTA';
import { RichText } from '@/lib/richtext/render';

// Time fallback so scheduled posts go live within 5 minutes with no cron.
export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const p = await getPost(params.slug);
  if (!p) return {};
  return {
    title: p.seo.title ?? p.title,
    description: p.seo.description ?? p.dek,
    alternates: { canonical: p.seo.canonicalUrl ?? `/blog/${p.slug}` },
    openGraph: {
      type: 'article',
      title: p.seo.title ?? p.title,
      description: p.seo.description ?? p.dek,
      ...(p.seo.ogImageUrl
        ? { images: [{ url: p.seo.ogImageUrl }] }
        : p.coverImage
          ? { images: [{ url: p.coverImage.url }] }
          : {}),
    },
    ...(p.seo.noIndex ? { robots: { index: false, follow: false } } : {}),
    ...(p.seo.keywords?.length ? { keywords: p.seo.keywords } : {}),
  };
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default async function PostPage({ params }: { params: { slug: string } }) {
  const [p, site, services] = await Promise.all([
    getPost(params.slug),
    getSiteSettings(),
    getServices(),
  ]);
  if (!p) notFound();

  // Contextual internal links: 2–3 relevant services per post.
  const related = services
    .filter((s) => ['social-media', 'web-app-development', 'brand-identity'].includes(s.slug))
    .slice(0, 3);

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
    { name: p.title, path: `/blog/${p.slug}` },
  ];

  return (
    <>
      <JsonLd data={blogPostingSchema(p, site)} />
      <JsonLd data={breadcrumbSchema(crumbs, site.url)} />

      <article className="pb-24 pt-36 md:pt-44">
        <div className="container-x max-w-3xl">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-white/40">
            {crumbs.map((c, i) => (
              // min-w-0 on both the flex item and the link: `truncate` is
              // `overflow:hidden` + ellipsis, which can only take effect if the
              // element is allowed to shrink below its content width. A flex
              // child defaults to min-width:auto, so without this the long post
              // title pushes the crumb past the viewport instead of ellipsing.
              <span key={c.path} className="flex min-w-0 items-center gap-2">
                {i > 0 && <span aria-hidden>/</span>}
                <Link href={c.path} className="min-w-0 truncate hover:text-white">
                  {c.name}
                </Link>
              </span>
            ))}
          </nav>

          <span className="mt-8 inline-block text-xs uppercase tracking-[0.18em] text-brand-cyan">
            {p.category}
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            {p.title}
          </h1>
          <p className="mt-5 text-lg text-white/60">{p.dek}</p>
          <p className="mt-6 text-sm text-white/40">
            {p.author.name} · {fmt(p.date)} · {p.readMinutes} min read
          </p>

          {p.coverImage ? (
            // The intrinsic size is unknown here (CMS upload), so the box is
            // reserved with an aspect ratio: without it the article text
            // reflows when the file lands, which on a phone happens right
            // under the reader's eyes. next/image then serves it at the
            // rendered width instead of full resolution.
            <span className="relative mt-10 block aspect-[16/9] w-full overflow-hidden rounded-2xl">
              <Image
                src={p.coverImage.url}
                alt={p.coverImage.alt}
                fill
                sizes="(max-width: 767px) 100vw, 768px"
                priority
                className="object-cover"
              />
            </span>
          ) : null}

          <RichText doc={p.body} className="mt-12" />

          {/* Author E-E-A-T block */}
          <div className="mt-14 flex items-start gap-4 rounded-2xl glass p-6">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-cyan font-display text-lg font-bold text-white">
              {p.author.name.charAt(0)}
            </div>
            <div>
              <p className="font-display font-semibold">{p.author.name}</p>
              <p className="text-sm text-brand-glow">
                {p.author.title}
                {p.author.title ? ', ' : ''}
                {site.shortName}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Writing on marketing strategy, branding, and how Egyptian brands grow across
                search and AI answer engines.
              </p>
            </div>
          </div>

          {/* Related services module */}
          {related.length > 0 ? (
            <div className="mt-12">
              <h2 className="font-display text-xl font-semibold">Related services</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {related.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/services/${s.slug}`}
                    className="rounded-xl glass p-5 text-sm transition-colors hover:border-white/25"
                  >
                    <span className="font-display font-semibold text-brand-glow">{s.name}</span>
                    <span className="mt-1 block text-white/50">{s.short}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </article>

      <CTA />
    </>
  );
}
