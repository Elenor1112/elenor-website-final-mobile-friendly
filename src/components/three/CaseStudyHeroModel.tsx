// Hero-side brand logo slot on a case-study page, sitting beside the title.
//
// Server component: uses the logo uploaded for this client in the admin
// (case-study editor → Client logo), else the bundled static file via
// `getClientLogo`, so no client-side rendering is needed. Case studies with no matching logo
// still reserve the space so the hero keeps the same two-column rhythm
// across the whole /work section.

import { getClientLogo } from '@/lib/data/client-logos';
import { getClientLogos } from '@/lib/data/work';

export async function CaseStudyHeroModel({ client }: { client: string }) {
  const uploaded = await getClientLogos()
    .then((m) => m[client.trim().toLowerCase()])
    .catch(() => undefined);
  const logo = uploaded ? { url: uploaded, lightMark: false } : getClientLogo(client);

  if (!logo) {
    // Reserved slot: same responsive box the logo occupies, so a client
    // gaining a logo later changes nothing about the surrounding layout.
    // Hidden below lg, where the hero is a single column and an empty box
    // is just a gap.
    return (
      <div
        aria-hidden
        className="hidden h-[420px] w-full rounded-3xl border border-dashed border-white/10 bg-white/[0.02] lg:block"
      />
    );
  }

  return (
    <div
      className={`flex h-[320px] w-full items-center justify-center rounded-3xl md:h-[380px] lg:h-[420px] ${
        logo.lightMark ? 'bg-white/[0.08]' : 'bg-white/[0.02]'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.url}
        alt={`${client} logo`}
        className="max-h-[55%] max-w-[65%] object-contain"
      />
    </div>
  );
}
