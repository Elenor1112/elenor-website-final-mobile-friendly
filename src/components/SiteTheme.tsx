import Script from 'next/script';
import { getAnalyticsSettings, getThemeSettings } from '@/lib/data/settings';

function hexToTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const DEFAULTS: Record<string, string> = {
  brand: '#3ba8b5',
  brandGlow: '#68cad6',
  brandCyan: '#36e0d0',
  brandAmber: '#ffb547',
};

/** Injects CSS-variable overrides when the CMS theme differs from defaults. */
export async function ThemeStyle() {
  const theme = await getThemeSettings();
  const vars: string[] = [];
  const map: Record<string, string> = {
    brand: '--color-brand',
    brandGlow: '--color-brand-glow',
    brandCyan: '--color-brand-cyan',
    brandAmber: '--color-brand-amber',
  };
  for (const [key, cssVar] of Object.entries(map)) {
    const value = theme.colors[key as keyof typeof theme.colors];
    if (value && value.toLowerCase() !== DEFAULTS[key].toLowerCase()) {
      const triplet = hexToTriplet(value);
      if (triplet) vars.push(`${cssVar}: ${triplet};`);
    }
  }
  if (vars.length === 0) return null;
  return <style id="cms-theme">{`:root{${vars.join('')}}`}</style>;
}

/** Analytics / pixel scripts, only rendered when IDs are configured. */
// Settings values are validated to the vendors' ID formats on save; quoting
// them as JS string literals here keeps a bad value from becoming code.
function jsString(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export async function AnalyticsScripts() {
  const a = await getAnalyticsSettings();
  return (
    <>
      {a.gtmId ? (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${jsString(a.gtmId)});`}
        </Script>
      ) : null}
      {a.ga4Id && !a.gtmId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(a.ga4Id)}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${jsString(a.ga4Id)});`}
          </Script>
        </>
      ) : null}
      {a.metaPixelId ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${jsString(a.metaPixelId)});fbq('track','PageView');`}
        </Script>
      ) : null}
      {a.tiktokPixelId ? (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)}(window, document, 'ttq');ttq.load(${jsString(a.tiktokPixelId)});ttq.page();`}
        </Script>
      ) : null}
    </>
  );
}
