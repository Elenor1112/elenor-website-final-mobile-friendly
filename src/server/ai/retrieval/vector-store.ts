import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import type { ChunkMetadata, KnowledgeSourceType } from '@/db/schema';

/**
 * The only module in the codebase that knows how embeddings are physically
 * stored. Everything else talks to `searchSimilar` / `upsertChunks` and is
 * unaffected by whether pgvector is installed — swapping in a dedicated vector
 * database later means reimplementing this file alone.
 */

export type StoredChunk = {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  slug: string;
  content: string;
  embedding: number[];
  metadata: ChunkMetadata;
  contentHash: string;
};

export type SearchHit = {
  id: string;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  slug: string;
  content: string;
  metadata: ChunkMetadata;
  /** Cosine similarity in [0,1]; higher is more relevant. */
  score: number;
};

/**
 * Literal form for the embedding column. The two backends do NOT share a
 * syntax: pgvector parses `[1,2,3]`, while a Postgres `real[]` requires brace
 * form `{1,2,3}` and rejects brackets with
 * `malformed array literal … Missing "]" after array dimensions`.
 */
function toVectorLiteral(embedding: number[], usePgVector: boolean): string {
  const values = embedding.join(',');
  return usePgVector ? `[${values}]` : `{${values}}`;
}

let pgvectorAvailable: boolean | null = null;

/**
 * Detects the storage mode once per process by asking Postgres directly, so a
 * mismatch between env config and the actual database can't silently produce
 * wrong SQL.
 */
export async function hasPgVector(): Promise<boolean> {
  if (pgvectorAvailable !== null) return pgvectorAvailable;
  try {
    const rows = await db.execute<{ present: boolean }>(
      sql`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS present`,
    );
    const row = Array.isArray(rows) ? rows[0] : (rows as { rows?: unknown[] }).rows?.[0];
    pgvectorAvailable = Boolean((row as { present?: boolean } | undefined)?.present);
  } catch {
    pgvectorAvailable = false;
  }
  return pgvectorAvailable;
}

/** Test seam — lets suites exercise both code paths in one process. */
export function __resetVectorModeCache(): void {
  pgvectorAvailable = null;
  storedDimensions = undefined;
}

let storedDimensions: number | null | undefined;

/**
 * The declared width of the embedding column, or null on the `real[]` fallback
 * (which is unconstrained). Used to fail fast on a dimension mismatch instead
 * of letting Postgres reject every insert with an opaque error.
 */
export async function getStoredDimensions(): Promise<number | null> {
  if (storedDimensions !== undefined) return storedDimensions;
  try {
    const result = await db.execute(sql`
      SELECT format_type(a.atttypid, a.atttypmod) AS type
      FROM pg_attribute a
      WHERE a.attrelid = 'knowledge_chunks'::regclass
        AND a.attname = 'embedding'
        AND NOT a.attisdropped
    `);
    const row = rowsOf<{ type: string }>(result)[0];
    const match = row?.type?.match(/^vector\((\d+)\)$/);
    storedDimensions = match ? Number(match[1]) : null;
  } catch {
    storedDimensions = null;
  }
  return storedDimensions;
}

/**
 * Throws when the configured embedding size cannot fit the column. Called by
 * the indexer before it spends money embedding documents that cannot be stored.
 */
export async function assertDimensionsMatch(configured: number): Promise<void> {
  const stored = await getStoredDimensions();
  if (stored !== null && stored !== configured) {
    throw new Error(
      `Embedding dimension mismatch: knowledge_chunks.embedding is vector(${stored}) but ` +
        `AI_EMBEDDING_DIMENSIONS is ${configured}. Either set AI_EMBEDDING_DIMENSIONS=${stored}, ` +
        `or resize the column and reindex:\n` +
        `  ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE vector(${configured});\n` +
        `  npm run ai:index -- --force`,
    );
  }
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

/**
 * Cosine-similarity search.
 *
 * pgvector path: `<=>` is cosine *distance*, so similarity is `1 - distance`,
 * and the HNSW index makes this an approximate nearest-neighbour scan.
 * Fallback path: the same arithmetic expressed over `real[]`, computed exactly
 * with a sequential scan — acceptable for a marketing-site corpus.
 */
export async function searchSimilar(
  embedding: number[],
  options: { limit: number; minScore: number },
): Promise<SearchHit[]> {
  const limit = Math.max(1, Math.floor(options.limit));
  const usePgVector = await hasPgVector();
  const literal = toVectorLiteral(embedding, usePgVector);

  const scoreExpr = usePgVector
    ? sql`1 - (embedding <=> ${literal}::vector)`
    : // Manual cosine over two float arrays: dot / (||a|| * ||b||).
      sql`(
        SELECT COALESCE(
          SUM(a.val * b.val) / NULLIF(SQRT(SUM(a.val * a.val)) * SQRT(SUM(b.val * b.val)), 0),
          0
        )
        FROM unnest(embedding) WITH ORDINALITY AS a(val, ord)
        JOIN unnest(${literal}::real[]) WITH ORDINALITY AS b(val, ord)
          ON a.ord = b.ord
      )`;

  // The score is computed in an inner query and filtered in the outer one.
  // Repeating `scoreExpr` in both SELECT and WHERE would evaluate it twice per
  // row — on the array fallback that means running the correlated subquery
  // twice for every chunk in the table.
  const result = await db.execute(sql`
    SELECT id, source_type, source_id, title, slug, content, metadata, score
    FROM (
      SELECT id, source_type, source_id, title, slug, content, metadata,
             ${scoreExpr} AS score
      FROM knowledge_chunks
    ) scored
    WHERE score >= ${options.minScore}
    ORDER BY score DESC
    LIMIT ${limit}
  `);

  return rowsOf<{
    id: string;
    source_type: KnowledgeSourceType;
    source_id: string;
    title: string;
    slug: string;
    content: string;
    metadata: ChunkMetadata;
    score: number | string;
  }>(result).map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    metadata:
      typeof row.metadata === 'string'
        ? (JSON.parse(row.metadata) as ChunkMetadata)
        : row.metadata,
    score: Number(row.score),
  }));
}

/**
 * Replaces every chunk for a source document atomically.
 *
 * Delete-then-insert (rather than a diffing upsert) keeps chunk indices
 * contiguous when a document shrinks, and matches the spec's
 * "delete previous embeddings, regenerate" requirement.
 */
export async function replaceChunksForSource(
  sourceType: KnowledgeSourceType,
  sourceId: string,
  chunks: StoredChunk[],
): Promise<void> {
  // Resolved once, outside the loop — the mode cannot change mid-transaction.
  const usePgVector = await hasPgVector();

  const statements = [
    sql`DELETE FROM knowledge_chunks WHERE source_type = ${sourceType} AND source_id = ${sourceId}`,
    ...chunks.map((chunk) => {
      const literal = toVectorLiteral(chunk.embedding, usePgVector);
      const cast = usePgVector ? sql`${literal}::vector` : sql`${literal}::real[]`;
      return sql`
        INSERT INTO knowledge_chunks
          (source_type, source_id, title, slug, content, embedding, metadata, content_hash, updated_at)
        VALUES (
          ${chunk.sourceType}, ${chunk.sourceId}, ${chunk.title}, ${chunk.slug},
          ${chunk.content}, ${cast}, ${JSON.stringify(chunk.metadata)}::jsonb,
          ${chunk.contentHash}, now()
        )
      `;
    }),
  ];

  // The neon-http driver has no interactive transactions; its batch() runs
  // the statements as one atomic HTTP transaction instead. node-postgres
  // (local Postgres) has no batch(), so it takes the transaction path.
  if ((db as Partial<typeof db>).batch) {
    const [first, ...rest] = statements.map((statement) => db.execute(statement));
    await db.batch([first, ...rest]);
  } else {
    await db.transaction(async (tx) => {
      for (const statement of statements) await tx.execute(statement);
    });
  }
}

/**
 * Keyword search over the same chunks, used when no embedding provider is
 * configured (`AI_RETRIEVAL_MODE=keyword`).
 *
 * Postgres full-text ranking rather than cosine similarity: `websearch_to_tsquery`
 * parses the visitor's phrasing, `ts_rank_cd` scores by term density and
 * proximity, and the title is weighted above the body so a question naming a
 * service surfaces that service's chunks first.
 *
 * This is a real fallback, not a stub — for a corpus this size (tens of
 * documents, one language) lexical matching retrieves competitively. What it
 * cannot do is match paraphrases with no shared vocabulary ("how much do you
 * charge" → "pricing"), which is exactly what embeddings buy you.
 */
export async function searchKeyword(
  query: string,
  options: { limit: number },
): Promise<SearchHit[]> {
  const limit = Math.max(1, Math.floor(options.limit));
  const cleaned = query.trim().slice(0, 500);
  if (!cleaned) return [];

  // `websearch_to_tsquery` ANDs every term, so "ecommerce websites" matches
  // nothing unless one chunk contains both. Questions are conversational, not
  // search queries, so terms are OR-ed instead and ranking decides relevance:
  // a chunk matching more terms scores higher, but matching one still counts.
  //
  // Stop words are dropped by the dictionary, and each term gets a `:*` prefix
  // match so "ecommerce" also hits "e-commerce"/"commerce" stems.
  const terms = cleaned
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 2)
    .slice(0, 12);

  if (terms.length === 0) return [];
  const tsquery = terms.map((term) => `${term}:*`).join(' | ');

  const result = await db.execute(sql`
    SELECT id, source_type, source_id, title, slug, content, metadata, score
    FROM (
      SELECT id, source_type, source_id, title, slug, content, metadata,
             ts_rank_cd(
               setweight(to_tsvector('english', title), 'A') ||
               setweight(to_tsvector('english', content), 'B'),
               to_tsquery('english', ${tsquery})
             ) AS score
      FROM knowledge_chunks
      WHERE (
        setweight(to_tsvector('english', title), 'A') ||
        setweight(to_tsvector('english', content), 'B')
      ) @@ to_tsquery('english', ${tsquery})
    ) ranked
    WHERE score > 0
    ORDER BY score DESC
    LIMIT ${limit}
  `);

  const rows = rowsOf<{
    id: string;
    source_type: KnowledgeSourceType;
    source_id: string;
    title: string;
    slug: string;
    content: string;
    metadata: ChunkMetadata;
    score: number | string;
  }>(result);

  // ts_rank_cd is unbounded and typically small (0–1 for short queries).
  // Normalise against the top hit so downstream score handling — logging,
  // the admin retrieval trace — stays on a comparable 0–1 scale.
  const top = Math.max(...rows.map((row) => Number(row.score)), 0);
  return rows.map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    metadata:
      typeof row.metadata === 'string'
        ? (JSON.parse(row.metadata) as ChunkMetadata)
        : row.metadata,
    score: top > 0 ? Number(row.score) / top : 0,
  }));
}

/** Removes a document from the index (unpublish or delete). */
export async function deleteChunksForSource(
  sourceType: KnowledgeSourceType,
  sourceId: string,
): Promise<void> {
  await db.execute(
    sql`DELETE FROM knowledge_chunks WHERE source_type = ${sourceType} AND source_id = ${sourceId}`,
  );
}

/** Current content hash per source — lets the indexer skip unchanged docs. */
export async function getIndexedHashes(): Promise<Map<string, string>> {
  const result = await db.execute(sql`
    SELECT source_type, source_id, MIN(content_hash) AS content_hash
    FROM knowledge_chunks
    GROUP BY source_type, source_id
  `);
  const map = new Map<string, string>();
  for (const row of rowsOf<{
    source_type: string;
    source_id: string;
    content_hash: string;
  }>(result)) {
    map.set(`${row.source_type}:${row.source_id}`, row.content_hash);
  }
  return map;
}

export type IndexStats = {
  totalChunks: number;
  bySource: { sourceType: string; documents: number; chunks: number; lastIndexed: string | null }[];
  lastIndexedAt: string | null;
  usingPgVector: boolean;
};

/** Powers the admin knowledge dashboard. */
export async function getIndexStats(): Promise<IndexStats> {
  const result = await db.execute(sql`
    SELECT source_type,
           COUNT(DISTINCT source_id) AS documents,
           COUNT(*) AS chunks,
           MAX(updated_at) AS last_indexed
    FROM knowledge_chunks
    GROUP BY source_type
    ORDER BY source_type
  `);

  const bySource = rowsOf<{
    source_type: string;
    documents: number | string;
    chunks: number | string;
    last_indexed: string | Date | null;
  }>(result).map((row) => ({
    sourceType: row.source_type,
    documents: Number(row.documents),
    chunks: Number(row.chunks),
    lastIndexed: row.last_indexed ? new Date(row.last_indexed).toISOString() : null,
  }));

  const lastIndexedAt = bySource
    .map((s) => s.lastIndexed)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1) ?? null;

  return {
    totalChunks: bySource.reduce((sum, s) => sum + s.chunks, 0),
    bySource,
    lastIndexedAt,
    usingPgVector: await hasPgVector(),
  };
}
