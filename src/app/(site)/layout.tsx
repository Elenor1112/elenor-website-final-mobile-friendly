import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/data/settings';
import { getMenu } from '@/lib/data/navigation';
import { organizationSchema } from '@/lib/schema';
import { JsonLd } from '@/components/JsonLd';
import { SmoothScroll } from '@/components/SmoothScroll';
import { ScrollProgress } from '@/components/ScrollProgress';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { SiteBackground } from '@/components/SiteBackground';
import { AnalyticsScripts, ThemeStyle } from '@/components/SiteTheme';
import { DraftBanner } from '@/components/DraftBanner';
import { ChatWidgetLoader } from '@/components/chat/ChatWidgetLoader';
import { MobilePageTransition } from '@/components/MobilePageTransition';
import { MobileChrome } from '@/components/MobileChrome';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    title: {
      default: `${site.name} | Full-Service Branding & Digital Agency in Cairo, Egypt`,
      template: `%s | ${site.name}`,
    },
    description: site.description,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: site.name,
      title: `${site.name} — ${site.tagline}`,
      description: site.description,
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: site.name }],
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: site.name,
      description: site.description,
      images: ['/og-image.jpg'],
    },
    robots: { index: true, follow: true },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [site, headerLinks, headerCta] = await Promise.all([
    getSiteSettings(),
    getMenu('header'),
    getMenu('header-cta'),
  ]);

  return (
    <>
      {/* Noise overlay as a real, stable React node (was a body::after pseudo).
          Keeping it inside the React tree means extension-injected siblings on
          <body> don't shift the indices React tracks. */}
      <div className="noise-overlay" aria-hidden />
      {/* Shared fixed background (black base + baby-blue glow + scrim) for
          every route; content must stay above it, hence z-10 on <main>. */}
      <SiteBackground />
      <ThemeStyle />
      <AnalyticsScripts />
      <JsonLd data={organizationSchema(site)} />
      <SmoothScroll />
      <ScrollProgress />
      {/* Replays a short entrance on <main> when the route changes. The motion
          itself is defined in mobile.css, so this is inert on desktop. */}
      <MobilePageTransition />
      {/* Phone-only chrome (route loading bar). Mounted behind a runtime gate
          rather than hidden with CSS, so desktop never runs its listeners. */}
      <MobileChrome />
      <Nav
        links={
          headerLinks.length > 0
            ? headerLinks.map((l) => ({ href: l.url, label: l.label }))
            : undefined
        }
        cta={headerCta[0] ? { href: headerCta[0].url, label: headerCta[0].label } : undefined}
      />
      <main id="main" className="relative z-10">
        {children}
      </main>
      <Footer />
      <DraftBanner />
      <ChatWidgetLoader />
    </>
  );
}
