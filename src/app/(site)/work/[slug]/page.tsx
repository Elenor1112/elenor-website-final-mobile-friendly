import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCaseStudy, getCaseStudySlugs, heroModelOf } from '@/lib/data/work';
import { getSiteSettings } from '@/lib/data/settings';
import { breadcrumbSchema, creativeWorkSchema } from '@/lib/schema';
import { JsonLd } from '@/components/JsonLd';
import { Reveal } from '@/components/Reveal';
import { CaseStudyGallery } from '@/components/CaseStudyGallery';
import { CaseStudyHeroModel } from '@/components/three/CaseStudyHeroModel';
import { CTA } from '@/components/sections/CTA';
import { RichText } from '@/lib/richtext/render';

export async function generateStaticParams() {
  const slugs = await getCaseStudySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const result = await getCaseStudy(params.slug);
  if (!result) return {};
  const c = result.caseStudy;
  return {
    title: c.seo.title ?? `${c.client} — Case Study`,
    description:
      c.seo.description ??
      `${c.client} (${c.industry}): ${c.result} — by Elenor Marketing Agency.`,
    alternates: { canonical: c.seo.canonicalUrl ?? `/work/${c.slug}` },
    ...(c.seo.noIndex ? { robots: { index: false, follow: false } } : {}),
    ...(c.seo.ogImageUrl ? { openGraph: { images: [{ url: c.seo.ogImageUrl }] } } : {}),
  };
}

export default async function CaseStudyPage({ params }: { params: { slug: string } }) {
  const [result, site] = await Promise.all([getCaseStudy(params.slug), getSiteSettings()]);
  if (!result) notFound();
  const { caseStudy: c, galleries } = result;

  // The first model across the galleries is promoted to the hero, so it is
  // filtered out of the tabs below to avoid showing the same model twice.
  const heroModel = heroModelOf(galleries);

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Work', path: '/work' },
    { name: c.client, path: `/work/${c.slug}` },
  ];

  return (
    <>
      <JsonLd data={creativeWorkSchema(c, site)} />
      <JsonLd data={breadcrumbSchema(crumbs, site.url)} />

      <section className="relative overflow-hidden border-b border-white/10 pb-16 pt-36 md:pt-44">
        <div className="container-x relative">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-white/40">
            {crumbs.map((cr, i) => (
              <span key={cr.path} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden>/</span>}
                <Link href={cr.path} className="hover:text-white">{cr.name}</Link>
              </span>
            ))}
          </nav>

          {/* Title block left, 3D model right. Single column until lg so the
              headline keeps full width on phones and tablets. */}
          <div className="mt-8 grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div>
              <p className="eyebrow">{c.industry} · Case study</p>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight md:text-6xl">
                {c.client}
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70">{c.result}</p>
              {c.technologies.length > 0 && (
                <div className="mt-7 flex flex-wrap gap-2">
                  {c.technologies.map((t) => (
                    <span key={t} className="rounded-full border border-brand-cyan/30 px-3 py-1 text-xs text-brand-cyan">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <CaseStudyHeroModel client={c.client} />
          </div>
        </div>
      </section>

      {c.description ? (
        <section className="border-b border-white/10 py-16">
          <div className="container-x max-w-3xl">
            <RichText doc={c.description} />
          </div>
        </section>
      ) : null}

      {c.metrics.length > 0 ? (
        <section className="border-b border-white/10 bg-white/[0.02] py-16">
          <div className="container-x grid grid-cols-2 gap-8 max-md:grid-cols-1 max-md:gap-6 md:grid-cols-4">
            {c.metrics.map((m) => (
              <div key={m.label}>
                <p className="font-display text-4xl font-bold text-gradient">{m.value}</p>
                <p className="mt-2 text-sm text-white/55">{m.label}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {galleries.length > 0 ? (
        <section className="py-24">
          <div className="container-x">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold text-brand-glow">Our work</h2>
              <div className="mt-8">
                <CaseStudyGallery
                  caseStudy={{
                    clientName: c.client,
                    services: galleries.map((g) => ({
                      id: g.serviceSlug ?? g.id,
                      label: g.label,
                      items: g.items.filter((i) => i !== heroModel),
                      videoUrls: g.videoUrls,
                    })),
                  }}
                />
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {c.testimonial?.quote ? (
        <section className="border-t border-white/10 py-20">
          <div className="container-x max-w-3xl">
            <blockquote className="font-display text-2xl font-medium leading-relaxed text-white/85">
              “{c.testimonial.quote}”
            </blockquote>
            <cite className="mt-5 block not-italic text-sm text-white/50">
              — {c.testimonial.author}
              {c.testimonial.role ? `, ${c.testimonial.role}` : ''}
            </cite>
          </div>
        </section>
      ) : null}

      <CTA />
    </>
  );
}
