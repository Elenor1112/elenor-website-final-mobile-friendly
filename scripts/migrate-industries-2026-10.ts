/**
 * One-off taxonomy migration for the /work industry filters (Oct 2026).
 *
 *   - New industry:                 Facility Management
 *   - CBRE (cbre-interior):         Institutions → Facility Management
 *   - Marcyrl (marcyrl-printing):   Healthcare   → Pharmaceuticals
 *
 * The seeder (scripts/seed.ts) never overwrites existing rows, so changes that
 * land after the initial import have to be applied directly. Idempotent: every
 * step is a no-op once applied, so re-running is safe.
 *
 * Usage: npx tsx scripts/migrate-industries-2026-10.ts   (requires DATABASE_URL in .env.local)
 */
import { eq } from 'drizzle-orm';
import { createScriptDb } from './db';
import * as schema from '../src/db/schema';

const db = createScriptDb();

const NEW_INDUSTRY = 'Facility Management';
/** The new filter is slotted in right after this one. */
const INSERT_AFTER = 'Institutions';

/** Case studies whose primary industry moves wholesale to a different one. */
const MOVES: { slug: string; from: string; to: string }[] = [
  { slug: 'cbre-interior', from: 'Institutions', to: NEW_INDUSTRY },
  { slug: 'marcyrl-printing', from: 'Healthcare', to: 'Pharmaceuticals' },
];

/**
 * `industries` must always lead with the primary `industry` (see the transform
 * in src/lib/validation/content.ts). Drop the vacated label — this is a move,
 * not an extra filter — and dedupe.
 */
const rebuild = (current: string[], from: string, to: string) => [
  to,
  ...current.filter((i) => i !== from && i !== to),
];

const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/* ----------------------------- 1. case studies ----------------------------- */

async function migrateCaseStudies() {
  let moved = 0;

  for (const move of MOVES) {
    const [row] = await db
      .select({
        id: schema.caseStudies.id,
        industry: schema.caseStudies.industry,
        industries: schema.caseStudies.industries,
      })
      .from(schema.caseStudies)
      .where(eq(schema.caseStudies.slug, move.slug));

    if (!row) {
      console.log(`  – ${move.slug}: not found, skipped`);
      continue;
    }

    // Backfill legacy rows that never had the array populated.
    const current = row.industries?.length ? row.industries : [row.industry].filter(Boolean);
    const industries = rebuild(current, move.from, move.to);
    if (row.industry === move.to && same(industries, row.industries ?? [])) continue;

    await db
      .update(schema.caseStudies)
      .set({ industry: move.to, industries })
      .where(eq(schema.caseStudies.id, row.id));
    moved += 1;
  }

  console.log(`✓ Case studies: ${moved} moved`);
}

/* ------------------------- 2. work settings filter ------------------------- */

async function migrateWorkSettings() {
  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, 'work'));

  if (!row) {
    // No stored row — the schema default in src/lib/validation/settings.ts applies.
    console.log('✓ Work settings: no stored row (schema default applies)');
    return;
  }

  const value = (row.value ?? {}) as Record<string, unknown>;
  const current = Array.isArray(value.industries) ? (value.industries as string[]) : null;

  if (!current) {
    console.log('✓ Work settings: no industries list stored (schema default applies)');
    return;
  }

  if (current.includes(NEW_INDUSTRY)) {
    console.log('✓ Work settings: already up to date');
    return;
  }

  // Order matters — 'All' has to stay first in the filter row.
  const at = current.indexOf(INSERT_AFTER);
  const next =
    at === -1
      ? [...current, NEW_INDUSTRY]
      : [...current.slice(0, at + 1), NEW_INDUSTRY, ...current.slice(at + 1)];

  await db
    .update(schema.settings)
    .set({ value: { ...value, industries: next } })
    .where(eq(schema.settings.key, 'work'));

  console.log(`✓ Work settings: added "${NEW_INDUSTRY}" to the industry filter list`);
}

/* ---------------------------------- main ----------------------------------- */

async function main() {
  console.log('Migrating /work taxonomy…');
  await migrateCaseStudies();
  await migrateWorkSettings();
  console.log('Done.');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
