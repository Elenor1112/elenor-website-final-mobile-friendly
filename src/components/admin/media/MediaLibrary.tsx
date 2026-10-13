'use client';

// Full media library screen: drag-drop upload, folders, search, pagination,
// per-file editing (alt/caption/folder), replace, and safe delete.

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { FolderPlus, Loader2, Pencil, Trash2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';
import {
  createFolder,
  deleteFolder,
  deleteMedia,
  listFolders,
  mediaUsage,
  renameFolder,
  searchMedia,
  updateMedia,
  replaceMedia,
  type MediaItem,
} from '@/server/actions/media';
import { uploadFile, IMAGE_ACCEPT } from './upload';
import { Button, Card, Field, Input, PageHeader, Select, Textarea, cn } from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';

type Folder = { id: string; name: string; parentId: string | null };

const fmtSize = (bytes: number | null) =>
  bytes == null ? '—' : bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

export function MediaLibrary() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null | undefined>(undefined); // undefined = all
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await searchMedia({ q: q || undefined, folderId: activeFolder, page });
      setItems(res.items);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch {
      toast.error('Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [q, activeFolder, page]);

  useEffect(() => {
    const t = setTimeout(refresh, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [refresh, q]);

  useEffect(() => {
    listFolders().then(setFolders).catch(() => undefined);
  }, []);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        await uploadFile(file, typeof activeFolder === 'string' ? activeFolder : null);
        toast.success(`Uploaded ${file.name}`);
      } catch (err) {
        toast.error(
          `Upload failed: ${file.name}${err instanceof Error ? ` — ${err.message}` : ''}`,
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
    refresh();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const addFolder = async () => {
    const name = prompt('Folder name');
    if (!name?.trim()) return;
    const res = await createFolder(name, null);
    if (res.ok) {
      setFolders(await listFolders());
      toast.success('Folder created');
    }
  };

  return (
    <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
      <PageHeader
        title="Media library"
        description={`${total} file${total === 1 ? '' : 's'} — drag & drop anywhere to upload`}
        actions={
          <>
            <Button variant="secondary" onClick={addFolder}>
              <FolderPlus className="h-4 w-4" /> New folder
            </Button>
            <Button onClick={() => fileInput.current?.click()} disabled={uploading > 0}>
              {uploading > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {uploading > 0 ? `Uploading (${uploading})…` : 'Upload'}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </>
        }
      />

      {/* Folder chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FolderChip label="All files" active={activeFolder === undefined} onClick={() => { setActiveFolder(undefined); setPage(1); }} />
        <FolderChip label="Unfiled" active={activeFolder === null} onClick={() => { setActiveFolder(null); setPage(1); }} />
        {folders.filter((f) => !f.parentId).map((f) => (
          <FolderChip
            key={f.id}
            label={f.name}
            active={activeFolder === f.id}
            onClick={() => { setActiveFolder(f.id); setPage(1); }}
            onRename={async () => {
              const name = prompt('Rename folder', f.name);
              if (!name?.trim()) return;
              await renameFolder(f.id, name);
              setFolders(await listFolders());
            }}
            onDelete={async () => {
              await deleteFolder(f.id);
              setFolders(await listFolders());
              if (activeFolder === f.id) setActiveFolder(undefined);
              toast.success('Folder deleted (files moved to Unfiled)');
            }}
          />
        ))}
      </div>

      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(1); }}
        placeholder="Search by filename or alt text…"
        className="mb-5 max-w-sm"
        aria-label="Search media"
      />

      {dragOver ? (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-brand/10 backdrop-blur-sm">
          <p className="rounded-2xl border-2 border-dashed border-brand bg-[#0a0b10] px-10 py-8 font-display text-xl">
            Drop images to upload
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="grid place-items-center py-24 text-white/40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="py-16 text-center text-white/40">
          No media found. Drag & drop images anywhere on this page to upload.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setEditing(m)}
              className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left transition hover:border-white/30"
            >
              <div className="relative aspect-square bg-[#0e0f16]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                <span className="absolute right-2 top-2 rounded-md bg-black/60 p-1 opacity-0 transition group-hover:opacity-100">
                  <Pencil className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="p-2">
                <p className="truncate text-xs text-white/70">{m.filename}</p>
                <p className="text-[10px] text-white/35">
                  {m.width && m.height ? `${m.width}×${m.height} · ` : ''}
                  {fmtSize(m.sizeBytes)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between text-sm text-white/50">
          <span>Page {page} of {totalPages}</span>
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

      {editing ? (
        <EditDialog
          item={editing}
          folders={folders}
          onClose={() => setEditing(null)}
          onChanged={() => { setEditing(null); refresh(); }}
        />
      ) : null}
    </div>
  );
}

function FolderChip({
  label,
  active,
  onClick,
  onRename,
  onDelete,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition',
        active ? 'border-brand bg-brand/15 text-brand-glow' : 'border-white/15 text-white/60 hover:border-white/40',
      )}
    >
      <button type="button" onClick={onClick}>{label}</button>
      {active && onRename ? (
        <button type="button" onClick={onRename} aria-label={`Rename ${label}`} className="opacity-60 hover:opacity-100">
          <Pencil className="h-3 w-3" />
        </button>
      ) : null}
      {active && onDelete ? (
        <ConfirmDialog
          title={`Delete folder “${label}”?`}
          description="Files inside are not deleted — they move to Unfiled."
          onConfirm={onDelete}
        >
          <button type="button" aria-label={`Delete ${label}`} className="opacity-60 hover:opacity-100">
            <X className="h-3 w-3" />
          </button>
        </ConfirmDialog>
      ) : null}
    </span>
  );
}

function EditDialog({
  item,
  folders,
  onClose,
  onChanged,
}: {
  item: MediaItem;
  folders: Folder[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption);
  const [folderId, setFolderId] = useState<string>(item.folderId ?? '');
  const [usage, setUsage] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  const replaceInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mediaUsage(item.id).then(setUsage).catch(() => setUsage([]));
  }, [item.id]);

  const save = () =>
    startTransition(async () => {
      const res = await updateMedia({ id: item.id, alt, caption, folderId: folderId || null });
      if (res.ok) {
        toast.success('Saved');
        onChanged();
      } else toast.error('Save failed');
    });

  const remove = () =>
    startTransition(async () => {
      const res = await deleteMedia(item.id);
      if (res.ok) {
        toast.success('Deleted');
        onChanged();
      } else toast.error(res.error ?? 'Delete failed');
    });

  const replace = async (file: File) => {
    try {
      const { uploadFile } = await import('./upload');
      // Upload the new file, then point this row at it (old blob is removed).
      const uploaded = await uploadFile(file, item.folderId);
      await replaceMedia({
        id: item.id,
        url: uploaded.url,
        filename: uploaded.filename,
        mimeType: uploaded.mimeType ?? file.type,
        sizeBytes: uploaded.sizeBytes ?? file.size,
        width: uploaded.width,
        height: uploaded.height,
        folderId: item.folderId,
      });
      // The interim row created by uploadFile is now redundant.
      await deleteMedia(uploaded.id);
      toast.success('File replaced — all usages updated');
      onChanged();
    } catch {
      toast.error('Replace failed');
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-[#0e0f16] p-6 text-white shadow-2xl">
          <Dialog.Title className="font-display text-lg font-semibold">Edit media</Dialog.Title>
          <div className="mt-5 grid gap-6 md:grid-cols-[240px_1fr]">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.alt} className="w-full rounded-xl border border-white/10 object-contain" />
              <p className="mt-2 break-all text-xs text-white/40">{item.filename}</p>
              <p className="text-xs text-white/35">
                {item.width && item.height ? `${item.width}×${item.height} · ` : ''}
                {fmtSize(item.sizeBytes)} · {item.storage === 'local' ? 'site asset' : 'uploaded'}
              </p>
            </div>
            <div className="space-y-4">
              <Field label="Alt text" hint="describes the image for SEO & screen readers">
                <Textarea value={alt} onChange={(e) => setAlt(e.target.value)} rows={2} />
              </Field>
              <Field label="Caption">
                <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
              </Field>
              <Field label="Folder">
                <Select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                  <option value="">Unfiled</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </Select>
              </Field>
              <div>
                <p className="text-xs font-medium text-white/60">Used in</p>
                {usage === null ? (
                  <p className="mt-1 text-xs text-white/35">Checking…</p>
                ) : usage.length === 0 ? (
                  <p className="mt-1 text-xs text-white/35">Not referenced anywhere — safe to delete.</p>
                ) : (
                  <ul className="mt-1 list-disc pl-4 text-xs text-white/50">
                    {usage.slice(0, 6).map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                    {usage.length > 6 ? <li>…and {usage.length - 6} more</li> : null}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <ConfirmDialog
                title="Delete this file?"
                description={
                  usage && usage.length > 0
                    ? `It is used in ${usage.length} place(s) — those spots will lose the image.`
                    : 'The file will be permanently removed.'
                }
                onConfirm={remove}
              >
                <Button variant="danger" size="sm" disabled={pending}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </ConfirmDialog>
              {item.storage === 'blob' ? (
                <>
                  <Button variant="secondary" size="sm" onClick={() => replaceInput.current?.click()}>
                    Replace file
                  </Button>
                  <input
                    ref={replaceInput}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && replace(e.target.files[0])}
                  />
                </>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={save} disabled={pending}>
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
