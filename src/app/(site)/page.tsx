import type { Metadata } from 'next';
import { Hero } from '@/components/Hero';
import { IntroAnimation } from '@/components/IntroAnimation';
import { Stats } from '@/components/sections/Stats';
import { Philosophy } from '@/components/sections/Philosophy';
import { ServicesShowcase } from '@/components/sections/ServicesShowcase';
import { Clients } from '@/components/sections/Clients';
import { BlogPreview } from '@/components/sections/BlogPreview';
import { CTA } from '@/components/sections/CTA';
import { getPage, getSection } from '@/lib/data/pages';
import { getServices } from '@/lib/data/services';
import { getCaseStudies } from '@/lib/data/work';
import { getPosts } from '@/lib/data/posts';
import { getTestimonials } from '@/lib/data/testimonials';
import { parseSectionData } from '@/lib/validation/sections';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage('home').catch(() => null);
  return {
    title:
      page?.seo.title ?? 'Full-Service Branding, Marketing & Digital Agency in Cairo, Egypt',
    description: page?.seo.description ?? undefined,
    alternates: { canonical: page?.seo.canonicalUrl ?? '/' },
    ...(page?.seo.noIndex ? { robots: { index: false, follow: false } } : {}),
    ...(page?.seo.ogImageUrl
      ? { openGraph: { images: [{ url: page.seo.ogImageUrl }] } }
      : {}),
  };
}

export default async function HomePage() {
  const [page, services, caseStudies, posts, testimonials] = await Promise.all([
    getPage('home'),
    getServices(),
    getCaseStudies(),
    getPosts(),
    getTestimonials(),
  ]);

  const hero = getSection(page, 'hero');

  const showcaseFilters = services.map((s) => ({
    name: s.name,
    slug: s.slug,
    tagline: s.short,
  }));
  const showcaseCards = caseStudies.map((c) => ({
    slug: c.slug,
    client: c.client,
    categories: c.categories,
    result: c.result,
    coverImageUrl: c.coverImage?.url ?? null,
  }));

  // Sections render in the order stored in the CMS; disabled sections are
  // already filtered out by the data layer.
  const sections = (page?.sections ?? []).map((section) => {
    switch (section.type) {
      case 'hero':
        return <Hero key={section.id} data={parseSectionData('hero', section.data)} />;
      case 'philosophy':
        return (
          <Philosophy key={section.id} data={parseSectionData('philosophy', section.data)} />
        );
      case 'services_showcase': {
        const data = parseSectionData('services_showcase', section.data);
        return (
          <ServicesShowcase
            key={section.id}
            eyebrow={data.eyebrow}
            heading={data.heading}
            filters={showcaseFilters}
            cards={showcaseCards}
          />
        );
      }
      case 'stats':
        return <Stats key={section.id} data={parseSectionData('stats', section.data)} />;
      case 'clients':
        return (
          <Clients
            key={section.id}
            data={parseSectionData('clients', section.data)}
            testimonials={testimonials}
          />
        );
      case 'blog_preview':
        return (
          <BlogPreview
            key={section.id}
            data={parseSectionData('blog_preview', section.data)}
            posts={posts}
          />
        );
      case 'cta':
        return <CTA key={section.id} />;
      default:
        return null;
    }
  });

  return (
    <>
      {/* First in the tree so its overlay + pre-paint skip <script> land at
          the top of the streamed HTML, ahead of the page content. */}
      {hero.data.animation.introEnabled ? <IntroAnimation /> : null}
      {sections}
    </>
  );
}
