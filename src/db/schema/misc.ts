import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './helpers';
import { media } from './media';
import { users } from './auth';

export const testimonials = pgTable('testimonials', {
  id: uuid('id').primaryKey().defaultRandom(),
  quote: text('quote').notNull(),
  author: text('author').notNull(),
  role: text('role').default('').notNull(),
  company: text('company').default('').notNull(),
  avatarId: uuid('avatar_id').references(() => media.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  ...timestamps,
});

export const redirects = pgTable('redirects', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromPath: text('from_path').notNull().unique(),
  toPath: text('to_path').notNull(),
  permanent: boolean('permanent').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamps.createdAt,
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // create | update | delete | publish | login | ...
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').default('').notNull(),
  entityLabel: text('entity_label').default('').notNull(),
  // Snapshot of the entity before the change, for simple undo/revisions.
  snapshot: text('snapshot'),
  createdAt: timestamps.createdAt,
});

// Fixed-window request counters shared by every server instance (chat, contact
// form). One row per key per window; old windows are pruned opportunistically.
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').default(1).notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const testimonialsRelations = relations(testimonials, ({ one }) => ({
  avatar: one(media, { fields: [testimonials.avatarId], references: [media.id] }),
}));
