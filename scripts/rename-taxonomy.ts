/**
 * One-off taxonomy migration for the /work industry filters.
 *
 *   - CBRE (cbre-interior): Real Estate & Constructions → Institutions
 *   - MMEC (mmec-web):      Industrial                  → Real Estate & Constructions
 *   - Industry label:       Production                  → Media Production
 *
 * The seeder (scripts/seed.ts) never overwrites existing rows, so renames that
 * land after the initial import have to be applied directly. Idempotent: every
 * step is a no-op once applied, so re-running is safe.
 *
 * Usage: npx tsx scripts/rename-taxonomy.ts   (requires DATABASE_URL in .env.local)
 */
import { eq } from 'drizzle-orm';
import { createScriptDb } from './db';
import * as schema from '../src/db/schema';

const db = createScriptDb();

const OLD_INDUSTRY = 'Production';
const NEW_INDUSTRY = 'Media Production';

/** Case studies whose primary industry moves wholesale to a different one. */
const MOVES: { slug: string; from: string; to: string }[] = [
  { slug: 'cbre-interior', from: 'Real Estate & Constructions', to: 'Institutions' },
  { slug: 'mmec-web', from: 'Industrial', to: 'Real Estate & Constructions' },
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

const replace = (current: string[], from: string, to: string) =>
  current.includes(from) ? [...new Set(current.map((i) => (i === from ? to : i)))] : current;

const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/* -------------------------- 1 + 2. case studies ---------------------------- */

async function migrateCaseStudies() {
  let moved = 0;
  let renamed = 0;

  const rows = await db
    .select({
      id: schema.caseStudies.id,
      slug: schema.caseStudies.slug,
      industry: schema.caseStudies.industry,
      industries: schema.caseStudies.industries,
    })
    .from(schema.caseStudies);

  for (const row of rows) {
    const move = MOVES.find((m) => m.slug === row.slug);
    let industry = row.industry;
    let industries = row.industries ?? [];

    if (move) {
      // Backfill legacy rows that never had the array populated.
      if (industries.length === 0) industries = [row.industry].filter(Boolean);
      industry = move.to;
      industries = rebuild(industries, move.from, move.to);
    }

    // The label rename applies to every row, including any just moved.
    if (industry === OLD_INDUSTRY) industry = NEW_INDUSTRY;
    industries = replace(industries, OLD_INDUSTRY, NEW_INDUSTRY);

    if (industry === row.industry && same(industries, row.industries ?? [])) continue;

    await db
      .update(schema.caseStudies)
      .set({ industry, industries })
      .where(eq(schema.caseStudies.id, row.id));

    if (move) moved += 1;
    else renamed += 1;
  }

  console.log(`✓ Case studies: ${moved} moved, ${renamed} relabelled`);
}

/* ---------------------------- 3. roster clients ---------------------------- */

async function migrateRosterClients() {
  const rows = await db
    .select({ id: schema.rosterClients.id, industries: schema.rosterClients.industries })
    .from(schema.rosterClients);

  let updated = 0;
  for (const row of rows) {
    const current = row.industries ?? [];
    const next = replace(current, OLD_INDUSTRY, NEW_INDUSTRY);
    if (same(next, current)) continue;

    await db
      .update(schema.rosterClients)
      .set({ industries: next })
      .where(eq(schema.rosterClients.id, row.id));
    updated += 1;
  }

  console.log(`✓ Roster clients: ${updated} relabelled`);
}

/* ------------------------- 4. work settings filter ------------------------- */

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

  // Order matters — 'All' has to stay first in the filter row.
  const next = replace(current, OLD_INDUSTRY, NEW_INDUSTRY);
  if (same(next, current)) {
    console.log('✓ Work settings: already up to date');
    return;
  }

  await db
    .update(schema.settings)
    .set({ value: { ...value, industries: next } })
    .where(eq(schema.settings.key, 'work'));

  console.log('✓ Work settings: industry filter list relabelled');
}

/* ---------------------------------- main ----------------------------------- */

async function main() {
  console.log('Migrating /work taxonomy…');
  await migrateCaseStudies();
  await migrateRosterClients();
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
