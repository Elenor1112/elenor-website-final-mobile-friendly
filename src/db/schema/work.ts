import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { contentStatusEnum, galleryItemTypeEnum, modelEnvironmentEnum } from './enums';
import {
  timestamps,
  type MetricItem,
  type RichTextDoc,
  type TestimonialData,
} from './helpers';
import { seoColumns } from './seo';
import { media } from './media';

export const caseStudies = pgTable(
  'case_studies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    client: text('client').notNull(),
    // Primary industry — shown on the card badge and used as the detail-page label.
    industry: text('industry').default('').notNull(),
    // Every industry this study should surface under in the /work filter. Always
    // contains `industry`; extra entries let one study appear in several filters
    // (e.g. Coca-Cola under both FMCG and Industrial).
    industries: text('industries').array().default([]).notNull(),
    // Service display names as shown on cards; categories mirror the showcase
    // filter values (existing site convention).
    services: text('services').array().default([]).notNull(),
    categories: text('categories').array().default([]).notNull(),
    technologies: text('technologies').array().default([]).notNull(),
    result: text('result').default('').notNull(),
    description: jsonb('description').$type<RichTextDoc | null>(),
    metrics: jsonb('metrics').$type<MetricItem[]>().default([]).notNull(),
    testimonial: jsonb('testimonial').$type<TestimonialData>(),
    coverImageId: uuid('cover_image_id').references(() => media.id, { onDelete: 'set null' }),
    featured: boolean('featured').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    status: contentStatusEnum('status').default('published').notNull(),
    ...seoColumns,
    ...timestamps,
  },
  (t) => ({
    statusOrderIdx: index('case_studies_status_order_idx').on(t.status, t.sortOrder),
    featuredIdx: index('case_studies_featured_idx').on(t.featured),
  }),
);

export const caseStudyGalleries = pgTable('case_study_galleries', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseStudyId: uuid('case_study_id')
    .notNull()
    .references(() => caseStudies.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  serviceSlug: text('service_slug'),
  sortOrder: integer('sort_order').default(0).notNull(),
  // YouTube video URLs (unlisted uploads) shown alongside this gallery's
  // images — avoids self-hosting heavy video files through Blob storage.
  videoUrls: text('video_urls').array().default([]).notNull(),
});

// One item in a gallery — either a still image (the original behaviour) or an
// interactive 3D model. The viewer settings live here rather than on `media`
// because they describe *this placement* of the asset: the same model can sit
// in two galleries with different presets, framing and rotation.
export const caseStudyGalleryImages = pgTable(
  'case_study_gallery_images',
  {
    // Surrogate key. Replaced the old composite (gallery_id, media_id) PK so a
    // gallery can hold the same asset twice and model rows can carry settings.
    id: uuid('id').primaryKey().defaultRandom(),
    galleryId: uuid('gallery_id')
      .notNull()
      .references(() => caseStudyGalleries.id, { onDelete: 'cascade' }),
    // The image, or — for model rows — the optional poster shown until the
    // model finishes loading. Nullable since a model needs no poster.
    mediaId: uuid('media_id').references(() => media.id, { onDelete: 'cascade' }),
    type: galleryItemTypeEnum('type').default('image').notNull(),
    // Model rows only: the .glb/.gltf/.fbx/.obj asset in the media library.
    modelMediaId: uuid('model_media_id').references(() => media.id, { onDelete: 'set null' }),
    environmentPreset: modelEnvironmentEnum('environment_preset').default('forest').notNull(),
    autoRotate: boolean('auto_rotate').default(false).notNull(),
    enableHoverRotation: boolean('enable_hover_rotation').default(true).notNull(),
    enableMouseParallax: boolean('enable_mouse_parallax').default(true).notNull(),
    // Framing nudges passed straight to ModelViewer, in world units.
    modelXOffset: doublePrecision('model_x_offset').default(0).notNull(),
    modelYOffset: doublePrecision('model_y_offset').default(0).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => ({
    galleryOrderIdx: index('case_study_gallery_images_gallery_order_idx').on(
      t.galleryId,
      t.sortOrder,
    ),
  }),
);

// Clients that appear in the /work roster grid without a case-study page.
export const rosterClients = pgTable('roster_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  industries: text('industries').array().default([]).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

// Case-study clients, auto-created the first time a case study names them.
// Holds the logo uploaded from the case-study editor (shown on /work cards).
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  logoId: uuid('logo_id').references(() => media.id, { onDelete: 'set null' }),
  ...timestamps,
});

export const clientsRelations = relations(clients, ({ one }) => ({
  logo: one(media, { fields: [clients.logoId], references: [media.id] }),
}));

export const caseStudiesRelations =relations(caseStudies, ({ one, many }) => ({
  coverImage: one(media, { fields: [caseStudies.coverImageId], references: [media.id] }),
  ogImage: one(media, { fields: [caseStudies.ogImageId], references: [media.id] }),
  galleries: many(caseStudyGalleries),
}));

export const caseStudyGalleriesRelations = relations(caseStudyGalleries, ({ one, many }) => ({
  caseStudy: one(caseStudies, {
    fields: [caseStudyGalleries.caseStudyId],
    references: [caseStudies.id],
  }),
  images: many(caseStudyGalleryImages),
}));

export const caseStudyGalleryImagesRelations = relations(caseStudyGalleryImages, ({ one }) => ({
  gallery: one(caseStudyGalleries, {
    fields: [caseStudyGalleryImages.galleryId],
    references: [caseStudyGalleries.id],
  }),
  // Named relations: two FKs point at `media`, so Drizzle needs them disambiguated.
  media: one(media, {
    fields: [caseStudyGalleryImages.mediaId],
    references: [media.id],
    relationName: 'gallery_item_image',
  }),
  modelMedia: one(media, {
    fields: [caseStudyGalleryImages.modelMediaId],
    references: [media.id],
    relationName: 'gallery_item_model',
  }),
}));
