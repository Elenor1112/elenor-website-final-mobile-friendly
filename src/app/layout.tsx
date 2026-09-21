import type { Metadata, Viewport } from 'next';
import { Sora, Inter, Glory } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { getSiteSettings } from '@/lib/data/settings';

const display = Sora({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
// Used by the About page content (see AboutContent).
const glory = Glory({ subsets: ['latin'], variable: '--font-glory', display: 'swap' });

// ── Hero lockup faces (see HeroHeadline) ─────────────────────────────────────
// The script words ("Where" / "Meets") are set in Early Bird and the technical
// words ("INNOVATION" / "QUALITY.") in Gilroy Light. Both are loaded locally and
// consumed through the --font-hero-* indirection declared in globals.css.
//
// display: 'block' rather than 'swap' on purpose. The headline is a measured
// lockup: HeroHeadline fits each word onto an ink box read off the video, so a
// fallback face rendering first would lay out at the wrong metrics and the
// words would visibly jump when the real face swapped in. Blocking keeps the
// first painted frame correct — and the write-on animation waits for the intro
// overlay anyway, so the block window costs nothing visible.
const heroScript = localFont({
  src: '../assets/fonts/EarlyBird.otf',
  variable: '--font-hero-script-face',
  display: 'block',
});
const heroTechno = localFont({
  src: '../assets/fonts/Gilroy-Light.otf',
  weight: '300',
  variable: '--font-hero-techno-face',
  display: 'block',
});

// Bare shell shared by the public site and the admin dashboard. All marketing
// chrome (Nav/Footer/SmoothScroll/JSON-LD) lives in (site)/layout.tsx so the
// admin doesn't inherit it.
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    metadataBase: new URL(site.url),
    title: { default: site.name, template: `%s | ${site.name}` },
    // Home-screen install. `appleWebApp` is what lets iOS launch the site
    // without Safari's chrome; `black-translucent` puts the page under the
    // status bar, which is why the nav carries safe-area padding in
    // mobile.css. Metadata only — nothing here renders on desktop.
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: site.name,
      statusBarStyle: 'black-translucent',
    },
    icons: {
      icon: [
        { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#05060a',
  width: 'device-width',
  initialScale: 1,
  // Lets the page paint under a notch/home indicator and, more importantly,
  // makes env(safe-area-inset-*) resolve to real values — without it those
  // read 0 and the mobile nav/footer padding would collapse. No effect on a
  // desktop viewport, which has no insets.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (translate, grammar, dark-mode)
    // inject attributes/nodes into <html>/<body> before React hydrates. Without
    // this, that mutation corrupts reconciliation and surfaces as the
    // "removeChild ... not a child of this node" crash.
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${glory.variable} ${heroScript.variable} ${heroTechno.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
