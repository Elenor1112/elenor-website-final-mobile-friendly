import type { Metadata } from 'next';
import { WorkHero } from '@/components/WorkHero';
import { WorkGallery } from '@/components/WorkGallery';
import { CTA } from '@/components/sections/CTA';
import { getCaseStudies, getRosterClients } from '@/lib/data/work';
import { getClientLogo } from '@/lib/data/client-logos';
import { getServices } from '@/lib/data/services';
import { getWorkSettings } from '@/lib/data/settings';
import { hubPageMetadata } from '@/lib/data/seo';

export function generateMetadata(): Promise<Metadata> {
  return hubPageMetadata('work', {
    title: 'Our Work — Portfolio',
    description:
      'Browse Elenor Marketing Agency’s portfolio — branding, social media, video, and web projects delivered for Coca-Cola, Saint-Gobain, Duravit, Zoetis, Emaar, and more.',
    canonical: '/work',
  });
}

export default async function WorkPage({
  searchParams,
}: {
  searchParams: { service?: string };
}) {
  const [caseStudies, roster, workSettings, allServices] = await Promise.all([
    getCaseStudies(),
    getRosterClients(),
    getWorkSettings(),
    getServices(),
  ]);

  // Only offer service filters that at least one case study is tagged with.
  // Case studies store service *names*; the URL (?service=) carries the slug.
  const tagged = new Set(caseStudies.flatMap((c) => c.services));
  const serviceOptions = allServices
    .filter((s) => tagged.has(s.name))
    .map((s) => ({ slug: s.slug, name: s.name }));
  const initialService = serviceOptions.some((s) => s.slug === searchParams.service)
    ? searchParams.service!
    : null;

  return (
    <>
      <WorkHero />
      <section className="py-20">
        <div className="container-x">
          <WorkGallery
            caseStudies={caseStudies.map((c) => ({
              slug: c.slug,
              client: c.client,
              logo: getClientLogo(c.client),
              industry: c.industry,
              industries: c.industries,
              services: c.services,
              result: c.result,
            }))}
            clientRoster={roster}
            industries={workSettings.industries}
            services={serviceOptions}
            initialService={initialService}
          />
        </div>
      </section>
      <CTA />
    </>
  );
}
