import Link from 'next/link';
import { JsonLd } from './JsonLd';
import { breadcrumbSchema } from '@/lib/schema';
import { getSiteSettings } from '@/lib/data/settings';

type Crumb = { name: string; path: string };

// Standard inner-page header: breadcrumbs (with schema), eyebrow, H1, and the
// direct-answer lede that AEO engines lift. Top padding clears the fixed nav.
export async function PageShell({
  eyebrow,
  title,
  lede,
  crumbs,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  crumbs: Crumb[];
  children?: React.ReactNode;
}) {
  const site = await getSiteSettings();
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, ...crumbs], site.url)} />
      <section className="relative overflow-hidden border-b border-white/10 pb-16 pt-36 max-md:pb-10 max-md:pt-28 md:pt-44">
        <div
          className="pointer-events-none absolute -top-40 right-0 h-[30rem] w-[30rem] rounded-full opacity-30 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #68cad6 0%, transparent 70%)' }}
          aria-hidden
        />
        <div className="container-x relative">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-white/40 max-md:-my-2.5">
            <Link href="/" className="hover:text-white max-md:inline-flex max-md:min-h-[44px] max-md:items-center">Home</Link>
            {crumbs.map((c) => (
              <span key={c.path} className="flex items-center gap-2">
                <span aria-hidden>/</span>
                <Link href={c.path} className="hover:text-white max-md:inline-flex max-md:min-h-[44px] max-md:items-center">{c.name}</Link>
              </span>
            ))}
          </nav>

          <p className="eyebrow mt-8">{eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-balance font-display text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">
            {title}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70">
            {lede}
          </p>
          {children}
        </div>
      </section>
    </>
  );
}
