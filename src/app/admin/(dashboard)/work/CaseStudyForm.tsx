'use client';

// Case-study editor: identity, categories, metrics, testimonial, named
// galleries (one per service delivered), and SEO. Autosaves like ServiceForm.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { saveCaseStudy } from '@/server/actions/work';
import type { CaseStudyInput } from '@/lib/validation/content';
import type { RichTextDoc } from '@/db/schema';
import { Button, Card, Field, Input, PageHeader, Select, Switch, Textarea } from '@/components/admin/ui';
import { StringListEditor } from '@/components/admin/StringListEditor';
import { MediaPicker, type PickedMedia } from '@/components/admin/media/MediaPicker';
import {
  GalleryEditor,
  GalleryVideoEditor,
  type GalleryItemValue,
} from '@/components/admin/GalleryEditor';
import { SeoFieldset, type SeoValue, emptySeo } from '@/components/admin/SeoFieldset';
import { useAutosave, SaveStatusLabel } from '@/components/admin/useAutosave';

const RichTextEditor = dynamic(
  () => import('@/components/admin/RichTextEditor').then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="min-h-[200px] animate-pulse rounded-xl bg-white/[0.03]" /> },
);

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export type GalleryValue = {
  label: string;
  serviceSlug: string | null;
  /** Images and 3D models, in display order. */
  items: GalleryItemValue[];
  videoUrls: string[];
};

export type CaseStudyFormValue = {
  id?: string;
  slug: string;
  client: string;
  /** Logo of the client record (created automatically for new names). */
  clientLogo: PickedMedia | null;
  industry: string;
  /** Extra industries this study also filters under, beyond the primary. */
  industries: string[];
  services: string[];
  categories: string[];
  technologies: string[];
  result: string;
  description: RichTextDoc | null;
  metrics: { label: string; value: string }[];
  testimonial: { quote: string; author: string; role: string };
  coverImage: PickedMedia | null;
  featured: boolean;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  galleries: GalleryValue[];
  seo: SeoValue;
};

export const emptyCaseStudy: CaseStudyFormValue = {
  slug: '',
  client: '',
  clientLogo: null,
  industry: '',
  industries: [],
  services: [],
  categories: [],
  technologies: [],
  result: '',
  description: null,
  metrics: [],
  testimonial: { quote: '', author: '', role: '' },
  coverImage: null,
  featured: false,
  status: 'draft',
  galleries: [],
  seo: emptySeo,
};

function toInput(v: CaseStudyFormValue): CaseStudyInput {
  return {
    id: v.id,
    slug: v.slug,
    client: v.client,
    clientLogoId: v.clientLogo?.id ?? null,
    industry: v.industry,
    industries: v.industries.filter(Boolean),
    services: v.services.filter(Boolean),
    categories: (v.categories.length > 0 ? v.categories : v.services).filter(Boolean),
    technologies: v.technologies.filter(Boolean),
    result: v.result,
    description: v.description,
    metrics: v.metrics.filter((m) => m.label && m.value),
    testimonial: v.testimonial.quote ? v.testimonial : null,
    coverImageId: v.coverImage?.id ?? null,
    featured: v.featured,
    status: v.status,
    galleries: v.galleries
      .filter((g) => g.label)
      .map((g) => ({
        label: g.label,
        serviceSlug: g.serviceSlug ?? slugify(g.label),
        // Drop half-configured rows (a 3D item whose file hasn't uploaded yet,
        // an image item with no media) so autosave doesn't fail validation
        // while the editor is still filling one in.
        items: g.items
          .filter((i) => (i.type === 'model' ? i.model : i.image))
          .map((i) => ({
            type: i.type,
            mediaId: i.image?.id ?? null,
            modelMediaId: i.model?.id ?? null,
            environmentPreset: i.environmentPreset,
            autoRotate: i.autoRotate,
            enableHoverRotation: i.enableHoverRotation,
            enableMouseParallax: i.enableMouseParallax,
            modelXOffset: i.modelXOffset,
            modelYOffset: i.modelYOffset,
          })),
        videoUrls: g.videoUrls,
      })),
    seo: {
      seoTitle: v.seo.seoTitle,
      seoDescription: v.seo.seoDescription,
      ogImageId: v.seo.ogImage?.id ?? null,
      canonicalUrl: v.seo.canonicalUrl,
      noIndex: v.seo.noIndex,
      seoKeywords: v.seo.seoKeywords,
    },
  };
}

export function CaseStudyForm({
  initial,
  serviceNames,
  industries,
  clients = [],
}: {
  initial: CaseStudyFormValue;
  serviceNames: string[];
  industries: string[];
  /** Known clients — a name not in this list becomes a new client on save. */
  clients?: { name: string; logo: PickedMedia | null }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const isNew = !initial.id;
  const findClient = (name: string) => {
    const key = name.trim().toLowerCase();
    return key ? clients.find((c) => c.name.trim().toLowerCase() === key) : undefined;
  };
  const isNewClient = value.client.trim() !== '' && !findClient(value.client);

  const doSave = useMemo(
    () => async () => {
      const res = await saveCaseStudy(toInput(value));
      if (!res.ok) {
        toast.error(res.error);
        return false;
      }
      if (isNew) {
        toast.success('Case study created');
        router.replace(`/admin/work/${res.id}`);
      }
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, isNew],
  );

  const { status, notify, flush } = useAutosave(doSave);

  const set = <K extends keyof CaseStudyFormValue>(key: K, v: CaseStudyFormValue[K]) => {
    setValue((cur) => ({ ...cur, [key]: v }));
    if (!isNew) notify();
  };

  const toggleIndustry = (name: string) => {
    const industries = value.industries.includes(name)
      ? value.industries.filter((i) => i !== name)
      : [...value.industries, name];
    setValue((cur) => ({ ...cur, industries }));
    if (!isNew) notify();
  };

  const toggleService = (name: string) => {
    const has = value.services.includes(name);
    const services = has ? value.services.filter((s) => s !== name) : [...value.services, name];
    let galleries = value.galleries;
    if (!has && !galleries.some((g) => g.label === name)) {
      galleries = [...galleries, { label: name, serviceSlug: slugify(name), items: [], videoUrls: [] }];
    }
    setValue((cur) => ({ ...cur, services, categories: services, galleries }));
    if (!isNew) notify();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isNew ? 'New case study' : `Edit: ${value.client || value.slug}`}
        actions={
          <div className="flex items-center gap-3">
            <SaveStatusLabel status={status} />
            {!isNew ? (
              value.status === 'published' ? (
                <a href={`/work/${value.slug}`} target="_blank" rel="noreferrer" className="text-xs text-brand-glow hover:underline">
                  View on site ↗
                </a>
              ) : (
                <a
                  href={`/api/preview?path=${encodeURIComponent(`/work/${value.slug}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-amber hover:underline"
                >
                  Preview draft ↗
                </a>
              )
            ) : null}
            <Button onClick={() => flush()}>{isNew ? 'Create case study' : 'Save'}</Button>
          </div>
        }
      />

      <div className="space-y-6">
        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Client name"
              hint={isNewClient ? 'New client — will be added on save' : undefined}
            >
              <Input
                value={value.client}
                list="case-study-clients"
                onChange={(e) => {
                  const client = e.target.value;
                  // Picking a known client brings its logo along.
                  const known = findClient(client);
                  setValue((cur) => ({
                    ...cur,
                    client,
                    clientLogo: known ? known.logo : findClient(cur.client) ? null : cur.clientLogo,
                    slug: isNew && (!cur.slug || cur.slug === slugify(cur.client)) ? slugify(client) : cur.slug,
                  }));
                  if (!isNew) notify();
                }}
                placeholder="Coca-Cola"
              />
              <datalist id="case-study-clients">
                {clients.map((c) => (
                  <option key={c.name} value={c.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Slug" hint="URL: /work/[slug]">
              <Input value={value.slug} onChange={(e) => set('slug', slugify(e.target.value))} />
            </Field>
          </div>
          <Field label="Client logo" hint="shown beside the client name on /work">
            <MediaPicker
              value={value.clientLogo}
              onChange={(m) => set('clientLogo', m)}
              label="Upload client logo"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Industry" hint="shown on the card badge">
              <Select
                value={value.industry}
                onChange={(e) => {
                  const next = e.target.value;
                  setValue((v) => ({
                    ...v,
                    industry: next,
                    // The primary is implicit — never list it as an extra too.
                    industries: v.industries.filter((i) => i !== next),
                  }));
                  if (!isNew) notify();
                }}
              >
                <option value="">Select…</option>
                {industries
                  .filter((i) => i !== 'All')
                  .map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={value.status} onChange={(e) => set('status', e.target.value as CaseStudyFormValue['status'])}>
                <option value="draft">Draft (hidden)</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
          </div>
          <Field
            label="Also appears under"
            hint="optional — extra industry filters on /work, beyond the primary above"
          >
            <div className="flex flex-wrap gap-2">
              {industries
                .filter((i) => i !== 'All' && i !== value.industry)
                .map((name) => {
                  const active = value.industries.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleIndustry(name)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        active
                          ? 'border-brand bg-brand/15 text-brand-glow'
                          : 'border-white/15 text-white/60 hover:border-white/40'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
            </div>
          </Field>
          <Field label="Result / summary" hint="the one-liner shown on cards and at the top of the page">
            <Textarea value={value.result} onChange={(e) => set('result', e.target.value)} rows={2} />
          </Field>
          <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
            <div>
              <p className="text-sm">Featured project</p>
              <p className="text-xs text-white/40">Highlighted with a star; available for future featured slots.</p>
            </div>
            <Switch checked={value.featured} onCheckedChange={(v) => set('featured', v)} aria-label="Featured" />
          </div>
          <Field label="Cover image" hint="shown on the home showcase card">
            <MediaPicker value={value.coverImage} onChange={(m) => set('coverImage', m)} />
          </Field>
        </Card>

        <Card>
          <h2 className="mb-1 font-display font-semibold">Services delivered</h2>
          <p className="mb-4 text-xs text-white/40">
            Also drives the home-showcase filter categories. Adding a service creates a matching gallery below.
          </p>
          <div className="flex flex-wrap gap-2">
            {serviceNames.map((name) => {
              const active = value.services.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleService(name)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    active
                      ? 'border-brand bg-brand/15 text-brand-glow'
                      : 'border-white/15 text-white/60 hover:border-white/40'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-display font-semibold">Galleries</h2>
          <div className="space-y-6">
            {value.galleries.map((g, i) => (
              <div key={`${g.label}-${i}`} className="rounded-xl border border-white/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Input
                    value={g.label}
                    onChange={(e) =>
                      set(
                        'galleries',
                        value.galleries.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                      )
                    }
                    className="max-w-xs"
                    aria-label="Gallery label"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => set('galleries', value.galleries.filter((_, j) => j !== i))}
                  >
                    Remove gallery
                  </Button>
                </div>
                <GalleryEditor
                  value={g.items}
                  onChange={(items) =>
                    set(
                      'galleries',
                      value.galleries.map((x, j) => (j === i ? { ...x, items } : x)),
                    )
                  }
                />
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="mb-2 text-xs text-white/40">
                    Videos — pasted YouTube links (unlisted works fine), shown before the images on this tab.
                  </p>
                  <GalleryVideoEditor
                    value={g.videoUrls}
                    onChange={(videoUrls) =>
                      set(
                        'galleries',
                        value.galleries.map((x, j) => (j === i ? { ...x, videoUrls } : x)),
                      )
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                set('galleries', [...value.galleries, { label: 'New gallery', serviceSlug: null, items: [], videoUrls: [] }])
              }
            >
              Add gallery
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-display font-semibold">Description</h2>
          <p className="mb-4 text-xs text-white/40">Optional long-form write-up shown under the header.</p>
          <RichTextEditor value={value.description} onChange={(doc) => set('description', doc)} placeholder="Tell the project story…" />
        </Card>

        <Card>
          <h2 className="mb-4 font-display font-semibold">Metrics</h2>
          <div className="space-y-3">
            {value.metrics.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={m.value}
                  onChange={(e) => set('metrics', value.metrics.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  placeholder="+120%"
                  className="max-w-[120px]"
                />
                <Input
                  value={m.label}
                  onChange={(e) => set('metrics', value.metrics.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  placeholder="Engagement growth"
                />
                <Button variant="ghost" size="sm" onClick={() => set('metrics', value.metrics.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => set('metrics', [...value.metrics, { label: '', value: '' }])}>
              Add metric
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-display font-semibold">Technologies</h2>
          <StringListEditor value={value.technologies} onChange={(v) => set('technologies', v)} placeholder="Next.js" />
        </Card>

        <Card className="space-y-4">
          <h2 className="font-display font-semibold">Client testimonial</h2>
          <Field label="Quote" hint="leave empty to hide the testimonial block">
            <Textarea
              value={value.testimonial.quote}
              onChange={(e) => set('testimonial', { ...value.testimonial, quote: e.target.value })}
              rows={3}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Author">
              <Input
                value={value.testimonial.author}
                onChange={(e) => set('testimonial', { ...value.testimonial, author: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <Input
                value={value.testimonial.role}
                onChange={(e) => set('testimonial', { ...value.testimonial, role: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <SeoFieldset
          value={value.seo}
          onChange={(v) => set('seo', v)}
          defaultTitle={value.client ? `${value.client} — Case Study` : undefined}
          defaultDescription={value.result || undefined}
        />

        <div className="flex justify-end">
          <Button onClick={() => flush()}>{isNew ? 'Create case study' : 'Save changes'}</Button>
        </div>
      </div>
    </div>
  );
}
