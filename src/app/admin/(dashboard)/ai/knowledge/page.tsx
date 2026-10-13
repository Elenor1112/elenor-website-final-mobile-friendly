import type { Metadata } from 'next';
import { getAiConfig, isEmbeddingConfigured } from '@/server/ai/config';
import { collectKnowledgeDocuments } from '@/server/ai/indexing/sources';
import { getIndexedHashes, getIndexStats } from '@/server/ai/retrieval/vector-store';
import { can, requireUser } from '@/server/auth/rbac';
import { Card, PageHeader } from '@/components/admin/ui';
import { RebuildButton } from './RebuildButton';

export const metadata: Metadata = { title: 'AI Knowledge' };
export const dynamic = 'force-dynamic';

const SOURCE_LABELS: Record<string, string> = {
  page: 'Pages',
  service: 'Services',
  'case-study': 'Case studies',
  post: 'Blog posts',
  faq: 'FAQ',
  testimonial: 'Testimonials',
  settings: 'Company info',
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function KnowledgeDashboardPage() {
  const user = await requireUser();

  // Compare what *should* be indexed against what is, so gaps are visible.
  const [stats, documents, hashes] = await Promise.all([
    getIndexStats().catch(() => null),
    collectKnowledgeDocuments().catch(() => []),
    getIndexedHashes().catch(() => new Map<string, string>()),
  ]);

  const missing = documents.filter(
    (doc) => !hashes.has(`${doc.sourceType}:${doc.sourceId}`),
  );

  let embeddingLabel = 'not configured';
  try {
    const config = getAiConfig();
    embeddingLabel = `${config.embedding.provider} · ${config.embedding.model} · ${config.embedding.dimensions}d`;
  } catch {
    // Fall through to the default label.
  }

  const healthy = missing.length === 0 && (stats?.totalChunks ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Knowledge base"
        description="What Elenor AI knows. Content re-indexes automatically whenever you publish an edit."
        actions={can(user, 'settings:write') ? <RebuildButton /> : undefined}
      />

      {!isEmbeddingConfigured() && (
        <div className="mb-6 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5">
          <h2 className="font-display font-semibold text-amber-100">No embedding provider</h2>
          <p className="mt-1 text-sm text-amber-100/70">
            Set <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">AI_EMBEDDING_PROVIDER</code>{' '}
            and the matching API key to build the index.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="font-display text-3xl font-bold">{documents.length}</p>
          <p className="mt-1 text-sm text-white/50">Indexable documents</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="font-display text-3xl font-bold">{stats?.totalChunks ?? 0}</p>
          <p className="mt-1 text-sm text-white/50">Stored chunks</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="font-display text-3xl font-bold">{timeAgo(stats?.lastIndexedAt ?? null)}</p>
          <p className="mt-1 text-sm text-white/50">Last indexed</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p
            className={`font-display text-3xl font-bold ${healthy ? 'text-emerald-300' : 'text-amber-300'}`}
          >
            {healthy ? 'Healthy' : 'Attention'}
          </p>
          <p className="mt-1 text-sm text-white/50">Index health</p>
        </div>
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold">Indexed sources</h2>
          <span className="text-xs text-white/40">
            {embeddingLabel} · {stats?.usingPgVector ? 'pgvector (HNSW)' : 'array fallback'}
          </span>
        </div>

        {!stats || stats.bySource.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">
            Nothing indexed yet. Use “Rebuild knowledge” to build the index for the first time.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/40">
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium">Documents</th>
                  <th className="pb-2 font-medium">Chunks</th>
                  <th className="pb-2 font-medium">Last indexed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.bySource.map((row) => (
                  <tr key={row.sourceType}>
                    <td className="py-2.5 text-white/70">
                      {SOURCE_LABELS[row.sourceType] ?? row.sourceType}
                    </td>
                    <td className="py-2.5">{row.documents}</td>
                    <td className="py-2.5">{row.chunks}</td>
                    <td className="py-2.5 text-white/50">{timeAgo(row.lastIndexed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="font-display font-semibold">Missing from the index</h2>
        <p className="mt-1 text-xs text-white/40">
          Published content the assistant cannot currently see.
        </p>
        {missing.length === 0 ? (
          <p className="mt-4 text-sm text-emerald-300/80">
            Every published document is indexed.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {missing.slice(0, 25).map((doc) => (
              <li
                key={`${doc.sourceType}:${doc.sourceId}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-amber-200/80">{doc.title}</span>
                <span className="shrink-0 text-xs text-white/35">
                  {SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}
                </span>
              </li>
            ))}
            {missing.length > 25 ? (
              <li className="text-xs text-white/40">…and {missing.length - 25} more.</li>
            ) : null}
          </ul>
        )}
      </Card>
    </div>
  );
}
