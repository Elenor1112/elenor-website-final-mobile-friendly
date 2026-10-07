import Link from 'next/link';
import Image from 'next/image';
import { getSiteSettings } from '@/lib/data/settings';
import { getServices } from '@/lib/data/services';
import { getMenu } from '@/lib/data/navigation';import elenorLogo from '@/assets/elenor final logo-01.png';

export async function Footer() {
  const [site, services, companyLinks] = await Promise.all([
    getSiteSettings(),
    getServices(),
    getMenu('footer-company'),
  ]);

  const socials = [
    { label: 'LinkedIn', href: site.social.linkedin, Icon: LinkedInIcon },
    { label: 'Instagram', href: site.social.instagram, Icon: InstagramIcon },
    { label: 'Facebook', href: site.social.facebook, Icon: FacebookIcon },
    { label: 'YouTube', href: site.social.youtube, Icon: YouTubeIcon },
    { label: 'Google Maps', href: 'https://maps.app.goo.gl/TDaUUAgHdS1AMpnk8', Icon: MapPinIcon },
  ].filter((s) => s.href);

  return (
    <footer className="relative z-10 border-t border-white/10 pb-10 pt-20 max-md:pt-14 max-md:[padding-bottom:max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col items-start text-left">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Elenor — home">
              <Image src={elenorLogo} alt="Elenor" className="h-24 w-auto" />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/55">
              {site.tagline}. A full-service marketing and brand agency in{' '}
              {site.address.locality}, {site.address.region}, since {site.foundingYear}.
            </p>
            <div className="mt-6 flex gap-4 text-white/60 max-md:-ml-3 max-md:gap-1">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  className="transition-colors hover:text-white max-md:grid max-md:h-11 max-md:w-11 max-md:place-items-center"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                >
                  <Icon className="h-5 w-5" />
                  <span className="sr-only">{label}</span>
                </a>
              ))}
            </div>
          </div>

          <FooterCol title="Services">
            {services.slice(0, 6).map((s) => (
              <FooterLink key={s.slug} href={`/services/${s.slug}`}>
                {s.name}
              </FooterLink>
            ))}
            <FooterLink href="/services">All services</FooterLink>
          </FooterCol>

          <FooterCol title="Company">
            {companyLinks.map((l) => (
              <FooterLink key={l.url} href={l.url}>
                {l.label}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="Get in touch">
            <a
              href={`tel:${site.phone}`}
              className="block text-sm text-white/55 hover:text-white max-md:-my-3 max-md:flex max-md:min-h-[44px] max-md:items-center max-md:py-3"
            >
              {site.phoneDisplay}
            </a>
            <a
              href={`mailto:${site.email}`}
              className="block text-sm text-white/55 hover:text-white max-md:-my-3 max-md:flex max-md:min-h-[44px] max-md:items-center max-md:py-3"
            >
              {site.email}
            </a>
            <p className="text-sm leading-relaxed text-white/55">
              {site.address.street}
              <br />
              {site.address.locality}, {site.address.region}, {site.address.countryName}
            </p>
            <p className="text-sm text-white/40">
              {site.hours.days[0]}–{site.hours.days[site.hours.days.length - 1]},{' '}
              {site.hours.opens}–{site.hours.closes}
            </p>
          </FooterCol>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/35 md:flex-row">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p>Built for speed, accessibility, and AI discoverability.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
        {title}
      </h3>
      <div className="mt-5 flex flex-col gap-3 max-md:mt-3 max-md:gap-0">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    // max-md:py-3 / -my-3: on a phone the row is a 44px tap target, while the
    // negative margin pulls the surrounding gap back so the column's visual
    // rhythm is unchanged. Desktop keeps the bare 20px line.
    <Link
      href={href}
      className="text-sm text-white/55 transition-colors hover:text-white max-md:-my-3 max-md:flex max-md:min-h-[44px] max-md:items-center max-md:py-3"
    >
      {children}
    </Link>
  );
}

// Brand glyphs (single-path, currentColor). lucide-react dropped brand icons,
// so these are inlined from the official brand marks.
type IconProps = { className?: string };

function LinkedInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function MapPinIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function YouTubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
