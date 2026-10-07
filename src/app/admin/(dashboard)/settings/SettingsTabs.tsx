'use client';

// Settings screen: one tab per settings group; each tab saves its own group.

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { saveSettings } from '@/server/actions/settings';
import type {
  AnalyticsSettings,
  ContactSettings,
  SettingsKey,
  SiteSettings,
  ThemeSettings,
  WorkSettings,
} from '@/lib/validation/settings';
import { StringListEditor } from '@/components/admin/StringListEditor';
import { Button, Card, Field, Input, Textarea, cn } from '@/components/admin/ui';

const TABS = [
  { key: 'site', label: 'Company & site' },
  { key: 'theme', label: 'Theme' },
  { key: 'contact', label: 'Contact form' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'work', label: 'Portfolio' },
] as const;

export function SettingsTabs(props: {
  site: SiteSettings;
  theme: ThemeSettings;
  analytics: AnalyticsSettings;
  contact: ContactSettings;
  work: WorkSettings;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('site');

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm transition',
              tab === t.key
                ? 'border-brand bg-brand/15 text-brand-glow'
                : 'border-white/15 text-white/60 hover:border-white/40',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'site' ? <SiteTab initial={props.site} /> : null}
      {tab === 'theme' ? <ThemeTab initial={props.theme} /> : null}
      {tab === 'contact' ? <ContactTab initial={props.contact} /> : null}
      {tab === 'analytics' ? <AnalyticsTab initial={props.analytics} /> : null}
      {tab === 'work' ? <WorkTab initial={props.work} /> : null}
    </div>
  );
}

function useSave<T>(key: SettingsKey, value: T) {
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      const res = await saveSettings(key, value);
      if (res.ok) toast.success('Settings saved — live on the site now');
      else toast.error(res.error ?? 'Save failed');
    });
  return { pending, save };
}

function SaveRow({ pending, save }: { pending: boolean; save: () => void }) {
  return (
    <div className="flex justify-end">
      <Button onClick={save} disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}

/* ----------------------------------- site ----------------------------------- */

function SiteTab({ initial }: { initial: SiteSettings }) {
  const [v, setV] = useState(initial);
  const { pending, save } = useSave('site', v);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h2 className="font-display font-semibold">Company</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name">
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Field>
          <Field label="Short name">
            <Input value={v.shortName} onChange={(e) => setV({ ...v, shortName: e.target.value })} />
          </Field>
        </div>
        <Field label="Tagline">
          <Input value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} />
        </Field>
        <Field label="Description" hint="used in metadata, schema markup, and llms.txt">
          <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={3} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website URL">
            <Input value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} />
          </Field>
          <Field label="Founding year">
            <Input
              type="number"
              value={v.foundingYear}
              onChange={(e) => setV({ ...v, foundingYear: Number(e.target.value) || v.foundingYear })}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Founder name">
            <Input value={v.founder.name} onChange={(e) => setV({ ...v, founder: { ...v.founder, name: e.target.value } })} />
          </Field>
          <Field label="Founder title">
            <Input value={v.founder.jobTitle} onChange={(e) => setV({ ...v, founder: { ...v.founder, jobTitle: e.target.value } })} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display font-semibold">Contact details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </Field>
          <Field label="Phone (E.164)" hint="+20120…">
            <Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          </Field>
          <Field label="Phone (display)">
            <Input value={v.phoneDisplay} onChange={(e) => setV({ ...v, phoneDisplay: e.target.value })} />
          </Field>
          <Field label="WhatsApp link">
            <Input value={v.whatsapp} onChange={(e) => setV({ ...v, whatsapp: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Street">
            <Input value={v.address.street} onChange={(e) => setV({ ...v, address: { ...v.address, street: e.target.value } })} />
          </Field>
          <Field label="District / locality">
            <Input value={v.address.locality} onChange={(e) => setV({ ...v, address: { ...v.address, locality: e.target.value } })} />
          </Field>
          <Field label="City / region">
            <Input value={v.address.region} onChange={(e) => setV({ ...v, address: { ...v.address, region: e.target.value } })} />
          </Field>
          <Field label="Country name">
            <Input value={v.address.countryName} onChange={(e) => setV({ ...v, address: { ...v.address, countryName: e.target.value } })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Working days" hint="comma-separated">
            <Input
              value={v.hours.days.join(', ')}
              onChange={(e) =>
                setV({ ...v, hours: { ...v.hours, days: e.target.value.split(',').map((d) => d.trim()).filter(Boolean) } })
              }
            />
          </Field>
          <Field label="Opens">
            <Input value={v.hours.opens} onChange={(e) => setV({ ...v, hours: { ...v.hours, opens: e.target.value } })} />
          </Field>
          <Field label="Closes">
            <Input value={v.hours.closes} onChange={(e) => setV({ ...v, hours: { ...v.hours, closes: e.target.value } })} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display font-semibold">Social profiles</h2>
        {(['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'] as const).map((key) => (
          <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
            <Input value={v.social[key]} onChange={(e) => setV({ ...v, social: { ...v.social, [key]: e.target.value } })} />
          </Field>
        ))}
      </Card>

      <Card>
        <h2 className="mb-1 font-display font-semibold">Featured clients</h2>
        <p className="mb-4 text-xs text-white/40">Names used in llms.txt and AI indexing. The home “Trusted by” reel shows one logo per testimonial (Testimonials page).</p>
        <StringListEditor value={v.featuredClients} onChange={(featuredClients) => setV({ ...v, featuredClients })} placeholder="Coca-Cola" />
      </Card>

      <SaveRow pending={pending} save={save} />
    </div>
  );
}

/* ---------------------------------- theme ----------------------------------- */

function ThemeTab({ initial }: { initial: ThemeSettings }) {
  const [v, setV] = useState(initial);
  const { pending, save } = useSave('theme', v);

  const colorField = (key: keyof ThemeSettings['colors'], label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={v.colors[key]}
          onChange={(e) => setV({ ...v, colors: { ...v.colors, [key]: e.target.value } })}
          className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
          aria-label={`${label} color`}
        />
        <Input
          value={v.colors[key]}
          onChange={(e) => setV({ ...v, colors: { ...v.colors, [key]: e.target.value } })}
          className="max-w-[130px]"
        />
      </div>
    </Field>
  );

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h2 className="font-display font-semibold">Brand colors</h2>
        <p className="text-xs text-white/40">
          Applied instantly across buttons, accents, and highlights on the public site.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {colorField('brand', 'Brand', 'primary buttons')}
          {colorField('brandGlow', 'Brand glow', 'links & highlights')}
          {colorField('brandCyan', 'Cyan accent')}
          {colorField('brandAmber', 'Amber accent')}
        </div>
      </Card>
      <Card>
        <h2 className="font-display font-semibold">Logo & favicon</h2>
        <p className="mt-2 text-sm text-white/45">
          The logo file ships with the site build (src/assets). To replace it, upload the new
          logo to the media library and ask your developer to swap the reference — or keep this
          for a future release.
        </p>
      </Card>
      <SaveRow pending={pending} save={save} />
    </div>
  );
}

/* --------------------------------- contact ---------------------------------- */

function ContactTab({ initial }: { initial: ContactSettings }) {
  const [v, setV] = useState(initial);
  const { pending, save } = useSave('contact', v);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 font-display font-semibold">Budget options</h2>
        <p className="mb-4 text-xs text-white/40">Choices in the contact form’s monthly budget dropdown.</p>
        <StringListEditor value={v.budgets} onChange={(budgets) => setV({ ...v, budgets })} placeholder="EGP 25k–75k" />
      </Card>
      <Card className="space-y-4">
        <h2 className="font-display font-semibold">Map</h2>
        <Field label="Custom Google Maps embed URL" hint="leave empty to auto-generate from your address">
          <Input value={v.mapEmbedSrc} onChange={(e) => setV({ ...v, mapEmbedSrc: e.target.value })} placeholder="https://www.google.com/maps/embed?…" />
        </Field>
      </Card>
      <SaveRow pending={pending} save={save} />
    </div>
  );
}

/* -------------------------------- analytics --------------------------------- */

function AnalyticsTab({ initial }: { initial: AnalyticsSettings }) {
  const [v, setV] = useState(initial);
  const { pending, save } = useSave('analytics', v);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h2 className="font-display font-semibold">Tracking IDs</h2>
        <p className="text-xs text-white/40">Scripts load only when an ID is filled in. GTM supersedes GA4 when both are set.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Google Tag Manager" hint="GTM-XXXXXXX">
            <Input value={v.gtmId} onChange={(e) => setV({ ...v, gtmId: e.target.value.trim() })} />
          </Field>
          <Field label="Google Analytics 4" hint="G-XXXXXXXXXX">
            <Input value={v.ga4Id} onChange={(e) => setV({ ...v, ga4Id: e.target.value.trim() })} />
          </Field>
          <Field label="Meta (Facebook) Pixel">
            <Input value={v.metaPixelId} onChange={(e) => setV({ ...v, metaPixelId: e.target.value.trim() })} />
          </Field>
          <Field label="TikTok Pixel">
            <Input value={v.tiktokPixelId} onChange={(e) => setV({ ...v, tiktokPixelId: e.target.value.trim() })} />
          </Field>
        </div>
      </Card>
      <SaveRow pending={pending} save={save} />
    </div>
  );
}

/* ----------------------------------- work ----------------------------------- */

function WorkTab({ initial }: { initial: WorkSettings }) {
  const [v, setV] = useState(initial);
  const { pending, save } = useSave('work', v);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 font-display font-semibold">Industry filters</h2>
        <p className="mb-4 text-xs text-white/40">
          Filter chips on the Work page, in this order. Keep “All” first.
        </p>
        <StringListEditor value={v.industries} onChange={(industries) => setV({ ...v, industries })} placeholder="Healthcare" />
      </Card>
      <SaveRow pending={pending} save={save} />
    </div>
  );
}
