'use client';

import { Reveal } from '@/components/Reveal';
import {
  ScrollReelTestimonials,
  type Testimonial,
} from '@/components/ui/scroll-reel-testimonials';
import type { SectionData } from '@/lib/validation/sections';

// Client proof section: heading + scroll-reel testimonials. The reel shows one
// logo per testimonial, kept in step with the featured quote.
export function Clients({
  data,
  testimonials,
}: {
  data: SectionData<'clients'>;
  testimonials: Testimonial[];
}) {
  return (
    <section className="relative z-10 border-y border-white/10 bg-white/[0.02] py-24">
      <div className="container-x">
        <Reveal>
          <p className="eyebrow">{data.eyebrow}</p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold md:text-4xl">
            {data.heading}
          </h2>
        </Reveal>

        <Reveal delay={120} className="mt-14">
          <ScrollReelTestimonials testimonials={testimonials} />
        </Reveal>
      </div>
    </section>
  );
}
