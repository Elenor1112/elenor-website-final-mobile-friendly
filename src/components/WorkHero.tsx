import Link from 'next/link';
import { JsonLd } from './JsonLd';
import { WorkGearsAnimation } from './WorkGearsAnimation';
import { WORK_GEAR_LABELS } from '@/lib/workGears';
import { breadcrumbSchema } from '@/lib/schema';
import { getSiteSettings } from '@/lib/data/settings';

// Work hub header. Replaces the shared PageShell so this page can carry the
// gear cluster from the reference clip, while keeping everything PageShell
// contributes that is not visual: breadcrumb markup, breadcrumb schema, and a
// real H1.
//
// The clip's layout is a wide strip — "Our Work" set left of centre with the
// gear cluster to its right, on a flat dark ground. Measured on the 1920x500
// frame: the wordmark's ink spans x 401..904 (centre 26.7% across, baseline on
// the vertical middle) and the gear cluster spans x 1078..1631 (centre 70.5%).
// That is the two-column split reproduced below, which collapses to stacked on
// small screens where a 1920x500 strip cannot survive intact.
export async function WorkHero() {
  const site = await getSiteSettings();
  const crumbs = [{ name: 'Work', path: '/work' }];

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, ...crumbs], site.url)} />
      <section className="relative overflow-hidden border-b border-white/10 pb-16 pt-36 md:pt-44">
        {/* Same glow treatment as PageShell so this hero sits flush with every
            other inner page header. */}
        <div
          className="pointer-events-none absolute -top-40 right-0 h-[30rem] w-[30rem] rounded-full opacity-30 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #68cad6 0%, transparent 70%)' }}
          aria-hidden
        />
        <div className="container-x relative">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-white/40">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            {crumbs.map((c) => (
              <span key={c.path} className="flex items-center gap-2">
                <span aria-hidden>/</span>
                <Link href={c.path} className="hover:text-white">
                  {c.name}
                </Link>
              </span>
            ))}
          </nav>

          <div className="mt-8 grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-8">
            <div>
              <h1 className="text-balance font-display text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">
                Our Work.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70">
                A selection of campaigns, brand builds, and digital products we’ve delivered across
                pharma, FMCG, real estate, automotive, hospitality, and professional services —
                filterable by industry or service.
              </p>
            </div>

            {/* The cluster is decorative (aria-hidden on the animation itself),
                so the client names it shows are stated here for screen readers
                and crawlers rather than being lost with the artwork. */}
            <div className="relative">
              <WorkGearsAnimation />
              <p className="sr-only">
                Clients include {WORK_GEAR_LABELS.join(', ')}.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
