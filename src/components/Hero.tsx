'use client';

import Link from 'next/link';
import { ImageAutoSlider } from '@/components/ui/image-auto-slider';
import { showcaseImages } from '@/components/ui/image-auto-slider.demo';
import { BrandOrbit } from '@/components/BrandOrbit';
import { HeroHeadline } from '@/components/HeroHeadline';
import type { SectionData } from '@/lib/validation/sections';

export function Hero({ data }: { data: SectionData<'hero'> }) {
  const { animation } = data;
  return (
    <section className="relative min-h-[170vh] max-md:min-h-0">
      {/* Background (black base + baby-blue glow + scrim) is site-wide —
          see SiteBackground in the (site) layout. */}

      {/* Real, indexable DOM content sits on top of the background.
          z-20 (above the showcase strip's z-10) because the strip is pulled up
          by a negative margin and comes later in the DOM — at an equal z-index
          it would paint over the CTA row. The bottom padding reserves the space
          that negative pull consumes, so on short viewports the buttons and
          scroll hint stay clear of the strip instead of being crowded by it. */}
      {/* pt clears the FIXED site nav (~168px tall), which is out of flow and
          would otherwise sit on top of the eyebrow. */}
      <div className="relative z-20 flex min-h-screen items-center pb-24 pt-44 max-md:min-h-[100svh] max-md:pb-14 max-md:pt-28 md:pb-32">
        <div className="container-x">
          {/* [data-hero-rest] elements stay hidden while the headline reveal
              plays and fade up once it settles (see HeroHeadline). */}
          <p className="eyebrow" data-hero-rest>
            <span className="inline-block h-2 w-2 rounded-[2px] bg-brand-cyan shadow-[0_0_10px] shadow-brand-cyan" />
            {data.eyebrow}
          </p>

          {/* Headline animation and the copy block sit side by side from `md`
              up, sharing one flex row so there is no vertical gap between
              them — the copy's top edge lines up with the headline's rather
              than trailing beneath it. Below `md` the lockup is
              width-governed and narrow, so the row collapses back to a
              stacked column. */}
          <div className="mt-6 flex flex-col gap-8 md:mt-4 md:flex-row md:items-center md:gap-10">
            <HeroHeadline line1={data.headlineLine1} line2={data.headlineLine2} />

            <div className="md:flex-1">
              <p className="text-lg leading-relaxed text-white/70 max-md:text-base" lang="en" data-hero-rest>
                {data.sub}
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4 max-md:mt-7 max-md:gap-3" data-hero-rest>
                <Link href={data.primaryCta.href} className="btn-primary pointer-events-auto">
                  {data.primaryCta.label}
                  <span aria-hidden>→</span>
                </Link>
                <Link href={data.secondaryCta.href} className="btn-ghost pointer-events-auto">
                  {data.secondaryCta.label}
                </Link>
              </div>
            </div>
          </div>

          <p
            className="mt-16 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/40 max-md:mt-10 max-md:tracking-[0.2em]"
            data-hero-rest
          >
            <span className="inline-block h-8 w-px animate-pulse-glow bg-white/30" />
            {data.scrollHint}
          </p>
        </div>
      </div>

      {/* Showcase strip — an auto-scrolling band of work photos bridging the
          two hero statements. */}
      {animation.showcaseStripEnabled ? (
        <div className="relative z-10 -mt-12 max-md:mt-2 md:-mt-24">
          <ImageAutoSlider images={showcaseImages} />
        </div>
      ) : null}

      {/* Second hero panel — Elenor mark orbited by client brands. */}
      {animation.orbitEnabled ? (
        <div className="relative z-10 flex min-h-[80vh] items-center justify-center max-md:min-h-[62svh]">
          <BrandOrbit />
        </div>
      ) : null}
    </section>
  );
}
