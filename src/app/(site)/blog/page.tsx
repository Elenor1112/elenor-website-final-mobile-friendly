import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { BlogAnimation } from '@/components/BlogAnimation';
import { JsonLd } from '@/components/JsonLd';
import { Reveal } from '@/components/Reveal';
import { breadcrumbSchema } from '@/lib/schema';
import { getPosts } from '@/lib/data/posts';
import { getSiteSettings } from '@/lib/data/settings';
import { hubPageMetadata } from '@/lib/data/seo';

// Time fallback so scheduled posts appear within 5 minutes with no cron.
export const revalidate = 300;

export function generateMetadata(): Promise<Metadata> {
  return hubPageMetadata('blog', {
    title: 'Marketing & Branding Insights — Blog',
    description:
      'Practical marketing, branding, and digital strategy insights from the Elenor Marketing Agency team — covering social media, SEO, AEO, branding, and industry trends.',
    canonical: '/blog',
  });
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default async function BlogPage() {
  const [posts, site] = await Promise.all([getPosts(), getSiteSettings()]);
  const [lead, ...rest] = posts;

  return (
    <>
      <JsonLd
        data={breadcrumbSchema(
          [
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
          ],
          site.url,
        )}
      />

      {/* Animated hero replaces PageShell here; the breadcrumb nav
          PageShell used to render is kept below so the page keeps its
          crawlable trail. */}
      <nav aria-label="Breadcrumb" className="container-x pt-32 md:pt-36">
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
          <Link href="/" className="hover:text-white">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/blog" className="hover:text-white">Blog</Link>
        </div>
      </nav>

      <BlogAnimation />

      <section className="border-b border-white/10 py-20">
        <div className="container-x">
          {lead ? (
            <Reveal>
              <Link
                href={`/blog/${lead.slug}`}
                className="group grid gap-8 overflow-hidden rounded-3xl glass p-8 transition-all duration-500 hover:border-white/25 md:grid-cols-2 md:p-12"
              >
                <div className="flex flex-col justify-center">
                  <span className="text-xs uppercase tracking-[0.18em] text-brand-cyan">
                    {lead.category} · Featured
                  </span>
                  <h2 className="mt-4 font-display text-3xl font-semibold leading-tight transition-colors group-hover:text-brand-glow md:text-4xl">
                    {lead.title}
                  </h2>
                  <p className="mt-4 text-white/60">{lead.dek}</p>
                  <p className="mt-6 text-xs text-white/40">
                    {lead.author.name} · {fmt(lead.date)} · {lead.readMinutes} min read
                  </p>
                </div>
                {lead.coverImage ? (
                  // Shown on phones too (it used to be md-only, leaving a
                  // text-only featured card). The aspect box reserves the space
                  // before the file loads, so there is no shift; order -1 lifts
                  // it above the copy, where a lead image belongs. next/image
                  // with `fill` so a CMS upload of unknown size is still served
                  // at the rendered width.
                  <span className="relative block overflow-hidden rounded-2xl max-md:order-[-1] max-md:mb-6 max-md:aspect-[16/10] max-md:w-full">
                    <Image
                      src={lead.coverImage.url}
                      alt={lead.coverImage.alt}
                      fill
                      sizes="(max-width: 767px) 100vw, 50vw"
                      loading="lazy"
                      className="object-cover"
                    />
                  </span>
                ) : (
                  <div className="hidden rounded-2xl bg-gradient-to-br from-brand/30 via-ink to-brand-cyan/20 md:block" />
                )}
              </Link>
            </Reveal>
          ) : (
            <p className="text-white/50">No articles published yet — check back soon.</p>
          )}

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((p, i) => (
              <Reveal key={p.slug} delay={(i % 3) * 80}>
                <Link
                  href={`/blog/${p.slug}`}
                  className="group flex h-full flex-col rounded-2xl glass p-7 transition-all duration-500 hover:-translate-y-1 hover:border-white/25"
                >
                  <span className="text-xs uppercase tracking-[0.18em] text-brand-cyan">
                    {p.category}
                  </span>
                  <h3 className="mt-4 font-display text-xl font-semibold leading-snug transition-colors group-hover:text-brand-glow">
                    {p.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-white/55">{p.dek}</p>
                  <p className="mt-6 text-xs text-white/40">
                    {p.author.name} · {fmt(p.date)} · {p.readMinutes} min
                  </p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
