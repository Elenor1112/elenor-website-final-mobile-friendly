import { getSiteSettings } from '@/lib/data/settings';
import { getServices } from '@/lib/data/services';
import { hours24 } from '@/lib/hours';

// Machine-readable summary for AI answer engines (emerging GEO standard).
export async function GET() {
  const [site, services] = await Promise.all([
    getSiteSettings(),
    getServices().catch(() => []),
  ]);

  const serviceLines = services
    .map((s) => `- [${s.name}](${site.url}/services/${s.slug}): ${s.short}`)
    .join('\n');

  const hours = hours24(site.hours.opens, site.hours.closes);
  const featured =site.featuredClients.slice(0, 5).join(', ');

  const body = `# ${site.name}
> A full-service marketing and brand agency in ${site.address.locality}, ${site.address.region}, ${site.address.countryName}, offering brand identity, social media management, video & motion production, event planning, printing & production, web & app development, innovative gifts, packaging, and interior design — serving clients including ${featured} since ${site.foundingYear}.

## Services
${serviceLines}

## Company
- [About](${site.url}/about): Led by CEO ${site.founder.name}; building tailored marketing strategies since ${site.foundingYear}.
- [Work](${site.url}/work): Case studies across pharma, FMCG, real estate, automotive, hospitality, and professional services.
- [Blog](${site.url}/blog): Marketing, branding, SEO, and AEO insights.
- [FAQ](${site.url}/faq): Common questions about services, process, and location.

## Contact
Phone: ${site.phoneDisplay} | Email: ${site.email}
Address: ${site.address.street}, ${site.address.locality}, ${site.address.region}, ${site.address.countryName}
Hours: ${site.hours.days[0]}–${site.hours.days[site.hours.days.length - 1]}, ${hours.opens}–${hours.closes}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
