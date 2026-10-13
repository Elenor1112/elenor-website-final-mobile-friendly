'use client';

// Reusable "choose an image" control for content forms. Shows the current
// image; opens a dialog with search + grid + inline upload; returns the
// selected media {id, url, alt} via onChange (null = cleared).

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ImageIcon, Loader2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { searchMedia, type MediaItem } from '@/server/actions/media';
import { uploadFile, IMAGE_ACCEPT } from './upload';
import { Button, Input, cn } from '../ui';

export type PickedMedia = { id: string; url: string; alt: string };

export function MediaPicker({
  value,
  onChange,
  label = 'Choose image',
}: {
  value: PickedMedia | null;
  onChange: (media: PickedMedia | null) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value.url}
          alt={value.alt}
          className="h-16 w-16 rounded-lg border border-white/10 object-cover"
        />
      ) : (
        <div className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-white/15 text-white/30">
          <ImageIcon className="h-5 w-5" />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {value ? 'Change' : label}
        </Button>
        {value ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="h-3.5 w-3.5" /> Remove
          </Button>
        ) : null}
      </div>
      {open ? (
        <PickerDialog
          onClose={() => setOpen(false)}
          onPick={(m) => {
            onChange({ id: m.id, url: m.url, alt: m.alt });
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

export function PickerDialog({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (m: MediaItem) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchMedia({ q: q || undefined, page, perPage: 24 });
        if (!cancelled) {
          setItems(res.items);
          setTotalPages(res.totalPages);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, q ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, page]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const item = await uploadFile(file, null);
      toast.success('Uploaded');
      onPick(item);
    } catch (err) {
      toast.error(`Upload failed${err instanceof Error ? ` — ${err.message}` : ''}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/10 bg-[#0e0f16] p-6 text-white shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title className="font-display text-lg font-semibold">Select image</Dialog.Title>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                Upload new
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
            </div>
          </div>

          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search media…"
            className="mt-4"
            aria-label="Search media"
          />

          <div className="mt-4 min-h-[200px] flex-1 overflow-y-auto">
            {loading ? (
              <div className="grid place-items-center py-16 text-white/40">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-16 text-center text-sm text-white/40">No images found.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {items.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onPick(m)}
                    className={cn(
                      'group overflow-hidden rounded-lg border border-white/10 transition hover:border-brand',
                    )}
                    title={m.filename}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt={m.alt}
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-white/50">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
