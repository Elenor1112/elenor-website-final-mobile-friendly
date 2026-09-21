import type { MetadataRoute } from 'next';
import { getSiteSettings } from '@/lib/data/settings';

/**
 * Web app manifest — what makes the site installable to a phone home screen.
 *
 * `display: 'standalone'` is the part that changes how it feels: launched from
 * the home screen the page runs without browser chrome, so the sticky header
 * and the safe-area padding in mobile.css become the whole top of the screen.
 *
 * Served from the App Router (not a static file) so the name and colours track
 * the CMS site settings, like the rest of the metadata here.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await getSiteSettings();

  return {
    name: `${site.name} — ${site.tagline}`,
    short_name: site.name,
    description: site.description,
    start_url: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Matches --bg so the splash screen and status bar continue the page
    // rather than flashing white on launch.
    background_color: '#05060a',
    theme_color: '#05060a',
    categories: ['business', 'design'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android crops to its own shape; the maskable art is inset so the
      // wordmark survives a circular mask.
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
