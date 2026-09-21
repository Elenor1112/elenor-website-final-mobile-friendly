import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqList } from '@/components/FaqList';
import { AboutHero } from '@/components/about/AboutHero';
import { AboutContent } from '@/components/about/AboutContent';
import { CTA } from '@/components/sections/CTA';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbSchema, faqSchema } from '@/lib/schema';
import { getPage, getSection } from '@/lib/data/pages';
import { getFaqsByCategory } from '@/lib/data/faqs';
import { getSiteSettings } from '@/lib/data/settings';
import { hubPageMetadata } from '@/lib/data/seo';

export function generateMetadata(): Promise<Metadata> {
  return hubPageMetadata('about', {
    title: 'About — Cairo-Based Branding & Marketing Team',
    description:
      'Meet the team behind Elenor Marketing Agency, led by CEO Emad Samir — a Cairo-based agency building tailored marketing strategies for startups and enterprise clients since 2021.',
    canonical: '/about',
  });
}

export default async function AboutPage() {
  const [page, aboutFaq, site] = await Promise.all([
    getPage('about'),
    getFaqsByCategory('about'),
    getSiteSettings(),
  ]);

  const hero = getSection(page, 'about_hero');
  const quote = getSection(page, 'ceo_quote');
  const story = getSection(page, 'story');
  const philosophy = getSection(page, 'brand_philosophy');
  const timeline = getSection(page, 'timeline');
  const team = getSection(page, 'team');
  const faqHeading = getSection(page, 'about_faq');

  const enabled = (type: string) =>
    page?.sections.some((s) => s.type === type && s.isEnabled) ?? false;

  return (
    <>
      {aboutFaq.length > 0 ? <JsonLd data={faqSchema(aboutFaq)} /> : null}
      <JsonLd
        data={breadcrumbSchema(
          [{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }],
          site.url,
        )}
      />
      {/* Animated hero: the artwork carries the headline copy, so the CMS
          eyebrow/title/lede stay in the DOM for a11y + AEO but are hidden. */}
      <section className="relative overflow-hidden border-b border-white/10 pt-28 md:pt-32">
        <div className="container-x relative">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-2 text-xs text-white/40"
          >
            <Link href="/" className="hover:text-white">Home</Link>
            <span className="flex items-center gap-2">
              <span aria-hidden>/</span>
              <Link href="/about" className="hover:text-white">About</Link>
            </span>
          </nav>

          <p className="eyebrow sr-only">{hero.data.eyebrow}</p>
          {/* Screen-reader-only at every width: the AboutHero stage carries the
              heading visually on a phone too (see mobile.css, which scales the
              stage to 1.6 viewports so the composition fits rather than hiding
              it). This used to become the visible heading below md, back when
              the stage was collapsed there — making it visible again would put
              a second "About us" on screen underneath the wordmark. */}
          <h1 className="sr-only">{hero.data.title}</h1>
        </div>

        {/* Full-bleed: outside container-x so the stage spans the viewport. */}
        <div className="mt-6">
          <AboutHero title={hero.data.title} />
        </div>

        {/* The lede is the one piece of hero copy that is shown rather than
            read out: the artwork carries the headline, but the positioning
            statement has nowhere else to live. Styled to match the Services
            hub's lede (see ServicesAnimation.tsx) so the two hero sections
            read as siblings.

            container-x rather than a bespoke offset — .about-hero__stage
            translates itself by --about-container-x specifically to align to
            this utility, so the paragraph's left edge lands under the "A" of
            "About us" for free. */}
        {/* Pulled up into the stage's own footprint. The stage is a fixed
            1920x500 box, but the wordmark only occupies its upper portion, so
            laying the lede out after the stage left a growing band of dead
            space below the word — 28px at 390 but 285px at 1920 — where the
            Services hub keeps a constant 28px between its h1 and the same
            paragraph.

            That band is not a fixed length OR a fixed percentage; measured
            across 11 widths it is exactly linear in the viewport:

              band = 0.1875*vw - <wordmark font-size>     (max error 0.2px)

            0.1875 is 100/533.33, i.e. how far the word's baseline sits down
            the stage, and the stage's height is 100vw/3.84. The subtracted
            term is the font-size because the type is a FIXED px size that
            steps 45 -> 75px at md (see .about-hero__wordtext in globals.css)
            while the stage keeps scaling with vw — which is why the required
            trim climbs with width and then RESETS at 768px, and why neither a
            single percentage nor a stepped one tracks it. An earlier -11.6%
            was correct at 1440 and overlapped the word by 20px at 768.

            Subtracting 28px from that band leaves exactly the Services gap.

            Only the md: half is set here. Below md the stage is 1.6 viewports
            wide and the loupe and props occupy the lower portion that is dead
            space on desktop, so the trim stops at the composition's bottom
            rather than the word's — a different coefficient, derived and set in
            mobile.css next to the stage geometry it comes from. Leaving the
            un-prefixed utility here would out-specify it. */}
        <div className="container-x relative pb-16 md:mt-[calc(75px+28px-0.1875*100vw)] md:pb-20">
          {/* text-balance takes over line-breaking entirely, so any manual \n
              in the CMS copy is flattened to a space first — mixing the two
              would fight each other and produce uneven lines again. */}
          <p className="max-w-3xl text-balance text-left text-lg leading-relaxed text-white/70">
            {hero.data.lede.replace(/\n/g, ' ')}
          </p>
        </div>
      </section>

      {enabled('ceo_quote') || enabled('story') || enabled('brand_philosophy') ? (
        <AboutContent
          ceoEyebrow={quote.data.eyebrow}
          ceoQuote={quote.data.quote}
          ceoCite={quote.data.cite}
          ceoPortrait={quote.data.portrait}
          storyHeading={story.data.heading}
          storyParagraphs={story.data.paragraphs}
          philosophyHeading={philosophy.data.heading}
          vision={philosophy.data.vision}
          mission={philosophy.data.mission}
          values={philosophy.data.values}
          goals={philosophy.data.goals}
        />
      ) : null}

      {enabled('timeline') && timeline.data.items.length > 0 ? (
        <section className="border-t border-white/10 py-24">
          <div className="container-x max-w-3xl">
            <h2 className="font-display text-3xl font-semibold">{timeline.data.heading}</h2>
            <ol className="mt-10 space-y-6 border-l border-white/10 pl-6">
              {timeline.data.items.map((item) => (
                <li key={`${item.year}-${item.title}`}>
                  <p className="font-display text-sm font-bold text-brand-glow">{item.year}</p>
                  <p className="mt-1 font-display text-lg font-semibold">{item.title}</p>
                  {item.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-white/60">
                      {item.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {enabled('team') && team.data.members.length > 0 ? (
        <section className="border-t border-white/10 py-24">
          <div className="container-x">
            <h2 className="font-display text-3xl font-semibold">{team.data.heading}</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {team.data.members.map((m) => (
                <div key={m.name} className="rounded-2xl glass p-7">
                  <p className="font-display text-xl font-semibold">{m.name}</p>
                  <p className="mt-1 text-sm text-brand-glow">{m.jobTitle}</p>
                  {m.bio ? (
                    <p className="mt-3 text-sm leading-relaxed text-white/60">{m.bio}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {enabled('about_faq') && aboutFaq.length > 0 ? (
        <section className="border-t border-white/10 bg-white/[0.02] py-24">
          <div className="container-x max-w-3xl">
            <p className="eyebrow">{faqHeading.data.eyebrow}</p>
            <h2 className="mt-4 font-display text-3xl font-semibold md:text-4xl">
              {faqHeading.data.heading}
            </h2>
            <div className="mt-10">
              <FaqList items={aboutFaq} />
            </div>
          </div>
        </section>
      ) : null}

      <CTA />
    </>
  );
}
