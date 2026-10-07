import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getService, getServiceSlugs } from '@/lib/data/services';
import { getServiceShowcaseImages, getServiceShowcaseVideo } from '@/lib/data/work';
import { getSiteSettings } from '@/lib/data/settings';
import { serviceSchema, faqSchema, breadcrumbSchema } from '@/lib/schema';
import { JsonLd } from '@/components/JsonLd';
import { FaqList } from '@/components/FaqList';
import { ServiceIcon } from '@/components/three/ServiceIcon';
import { ServicePhotoSlider } from '@/components/ServicePhotoSlider';
import { YouTubeEmbed } from '@/components/YouTubeEmbed';
import { Reveal } from '@/components/Reveal';
import { CTA } from '@/components/sections/CTA';
import { RichText } from '@/lib/richtext/render';

const VALID_SHAPES = ['box', 'torus', 'octa', 'sphere', 'badge'] as const;
type IconShape = (typeof VALID_SHAPES)[number];
const toShape = (icon: string | null): IconShape =>
  (VALID_SHAPES as readonly string[]).includes(icon ?? '') ? (icon as IconShape) : 'box';

export async function generateStaticParams() {
  const slugs = await getServiceSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const [s, site] = await Promise.all([getService(params.slug), getSiteSettings()]);
  if (!s) return {};
  return {
    title: s.seo.title ?? `${s.title} Agency in Cairo`,
    description: s.seo.description ?? s.metaDescription,
    alternates: { canonical: s.seo.canonicalUrl ?? `/services/${s.slug}` },
    openGraph: {
      title: `${s.name} | ${site.name}`,
      description: s.seo.description ?? s.metaDescription,
      ...(s.seo.ogImageUrl ? { images: [{ url: s.seo.ogImageUrl }] } : {}),
    },
    ...(s.seo.noIndex ? { robots: { index: false, follow: false } } : {}),
    ...(s.seo.keywords?.length ? { keywords: s.seo.keywords } : {}),
  };
}

export default async function ServiceDetail({ params }: { params: { slug: string } }) {
  const [s, site, showcaseImages, showcaseVideo] = await Promise.all([
    getService(params.slug),
    getSiteSettings(),
    getServiceShowcaseImages(params.slug).catch(() => []),
    getServiceShowcaseVideo(params.slug).catch(() => null),
  ]);
  if (!s) notFound();

  // Hero visual: the service's own curated CMS gallery takes priority when set,
  // so an editor can hand-pick exactly which images the slider shows. When the
  // service gallery is empty we fall back to real client work (case-study
  // galleries tagged with this service), and only then to the decorative 3D icon.
  const ownGallery = s.gallery.map((g) => ({ url: g.url, alt: g.alt, client: '' }));
  const sliderImages = ownGallery.length > 0 ? ownGallery : showcaseImages;

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: s.name, path: `/services/${s.slug}` },
  ];

  return (
    <>
      <JsonLd data={serviceSchema(s, site)} />
      {s.faq.length > 0 ? <JsonLd data={faqSchema(s.faq)} /> : null}
      <JsonLd data={breadcrumbSchema(crumbs, site.url)} />

      <section className="relative overflow-hidden border-b border-white/10 pb-16 pt-36 md:pt-44">
        <div className="container-x relative grid items-center gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-white/40">
              {crumbs.map((c, i) => (
                <span key={c.path} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden>/</span>}
                  <Link href={c.path} className="hover:text-white">{c.name}</Link>
                </span>
              ))}
            </nav>
            <p className="eyebrow mt-8">Service</p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">
              {s.name}
            </h1>
            {/* Direct-answer lede — the block AEO engines lift verbatim */}
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/70">
              {s.lede}
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/contact" className="btn-primary">Start a project →</Link>
              <Link href={`/work?service=${s.slug}`} className="btn-ghost">See related work</Link>
            </div>
          </div>
          {sliderImages.length > 0 ? (
            <ServicePhotoSlider images={sliderImages} serviceName={s.name} />
          ) : showcaseVideo ? (
            // A single client video (synced from a case study) stands in for the
            // decorative 3D icon when this service has one — e.g. AI & Motion
            // Graphics leads with its Coca-Cola motion piece.
            <div className="w-full overflow-hidden rounded-3xl glass p-2">
              <YouTubeEmbed url={showcaseVideo.url} title={`${s.name} — ${showcaseVideo.client}`} />
            </div>
          ) : (
            <ServiceIcon shape={toShape(s.icon)} accent={s.accent} />
          )}
        </div>
      </section>

      <section className="py-24">
        <div className="container-x grid gap-16 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">
              What’s included
            </h2>
            <ul className="mt-7 space-y-4">
              {s.included.map((item) => (
                <li key={item} className="flex gap-3 text-white/70">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-[2px] bg-brand-glow shadow-[0_0_8px] shadow-brand-glow" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">Our process</h2>
            <ol className="mt-7 space-y-4">
              {s.process.map((step, i) => (
                <li key={step} className="flex items-center gap-4 rounded-xl glass px-5 py-4">
                  <span className="font-display text-sm font-bold text-brand-glow">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-white/75">{step}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* Optional long-form body authored in the CMS */}
      {s.body ? (
        <section className="pb-24">
          <div className="container-x max-w-3xl">
            <RichText doc={s.body} />
          </div>
        </section>
      ) : null}

      {/* Optional CMS-managed gallery */}
      {s.gallery.length > 0 ? (
        <section className="pb-24">
          <div className="container-x">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {s.gallery.map((img) => (
                <img
                  key={img.url}
                  src={img.url}
                  alt={img.alt}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full rounded-2xl object-cover"
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Named client proof — specificity is what AI engines cite */}
      {s.proof.length > 0 ? (
        <section className="border-y border-white/10 bg-white/[0.02] py-16">
          <div className="container-x">
            <p className="eyebrow">Proof</p>
            <p className="mt-4 max-w-3xl font-display text-xl font-medium text-white/80 md:text-2xl">
              Delivered for{' '}
              {s.proof.map((c, i) => (
                <span key={c} className="text-brand-glow">
                  {c}
                  {i < s.proof.length - 1 ? ', ' : ''}
                </span>
              ))}
              {' '}— among the 50+ brands that trust Elenor.
            </p>
          </div>
        </section>
      ) : null}

      {s.faq.length > 0 ? (
        <section className="py-24">
          <div className="container-x max-w-3xl">
            <p className="eyebrow">Questions</p>
            <h2 className="mt-4 font-display text-3xl font-semibold md:text-4xl">
              Frequently asked
            </h2>
            <div className="mt-10">
              <FaqList items={s.faq} />
            </div>
            <p className="mt-8 text-sm text-white/40">
              More questions? See the full{' '}
              <Link href="/faq" className="text-brand-glow hover:underline">FAQ hub</Link>.
            </p>
          </div>
        </section>
      ) : null}

      <CTA />
    </>
  );
}
