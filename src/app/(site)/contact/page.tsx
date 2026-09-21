import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { ContactForm } from '@/components/ContactForm';
import { getSiteSettings, getContactSettings } from '@/lib/data/settings';
import { getServices } from '@/lib/data/services';
import { hubPageMetadata } from '@/lib/data/seo';

export function generateMetadata(): Promise<Metadata> {
  return hubPageMetadata('contact', {
    title: 'Contact — Cairo, Egypt',
    description:
      'Get in touch with Elenor Marketing Agency — call, WhatsApp, email, or visit us at 28 Mohamed Abdel Hady Street, Nasr City, Cairo. We reply within one business day.',
    canonical: '/contact',
  });
}

export default async function ContactPage() {
  const [site, contact, services] = await Promise.all([
    getSiteSettings(),
    getContactSettings(),
    getServices(),
  ]);

  const mapsQuery = encodeURIComponent(
    `${site.address.street}, ${site.address.locality}, ${site.address.region}, ${site.address.countryName}`,
  );
  const mapSrc = contact.mapEmbedSrc || `https://www.google.com/maps?q=${mapsQuery}&output=embed`;

  return (
    <>
      <PageShell
        eyebrow="Get in touch"
        title="Let’s build something."
        lede="Tell us about your business and what you’re trying to achieve — we’ll get back to you within one business day. Call, WhatsApp, email, or send the form below."
        crumbs={[{ name: 'Contact', path: '/contact' }]}
      />

      <section className="py-20">
        <div className="container-x grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl glass p-8 md:p-10">
            <h2 className="font-display text-2xl font-semibold">Start a project</h2>
            <p className="mt-2 text-sm text-white/50">All fields marked * are required.</p>
            <div className="mt-8">
              <ContactForm
                services={services.map((s) => ({ slug: s.slug, name: s.name }))}
                budgets={contact.budgets}
              />
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-3xl glass p-8">
              <h2 className="font-display text-xl font-semibold">Reach us directly</h2>
              <div className="mt-6 space-y-4 text-sm">
                <a href={`tel:${site.phone}`} className="max-md:-my-2.5 max-md:min-h-[44px] max-md:py-2.5 flex items-center justify-between text-white/70 hover:text-white">
                  <span>Phone</span>
                  <span className="text-white">{site.phoneDisplay}</span>
                </a>
                <a href={site.whatsapp} target="_blank" rel="noopener noreferrer" className="max-md:-my-2.5 max-md:min-h-[44px] max-md:py-2.5 flex items-center justify-between text-white/70 hover:text-white">
                  <span>WhatsApp</span>
                  <span className="text-brand-cyan">Message us →</span>
                </a>
                <a href={`mailto:${site.email}`} className="max-md:-my-2.5 max-md:min-h-[44px] max-md:py-2.5 flex items-center justify-between text-white/70 hover:text-white">
                  <span>Email</span>
                  <span className="text-white">{site.email}</span>
                </a>
                <div className="flex items-start justify-between gap-6 text-white/70">
                  <span>Address</span>
                  <span className="text-right text-white">
                    {site.address.street}
                    <br />
                    {site.address.locality}, {site.address.region}
                  </span>
                </div>
                <div className="flex items-center justify-between text-white/70">
                  <span>Hours</span>
                  <span className="text-white">
                    {site.hours.days[0]}–{site.hours.days[site.hours.days.length - 1]},{' '}
                    {site.hours.opens}–{site.hours.closes}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl glass">
              <iframe
                title={`${site.name} location`}
                src={mapSrc}
                className="h-64 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a
                href="https://maps.app.goo.gl/TDaUUAgHdS1AMpnk8"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in Google Maps"
                className="absolute inset-0"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
