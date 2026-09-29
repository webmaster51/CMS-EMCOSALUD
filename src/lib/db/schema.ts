/**
 * Esquema de base de datos — CMS EMCO SALUD (Drizzle ORM / PostgreSQL 16).
 *
 * Secciones:
 *   1. Enums
 *   2. Autenticación (tablas de Better Auth + API keys)
 *   3. Entidades núcleo (portales, empresas, multimedia, categorías, etiquetas)
 *   4. Contenidos multiportal (boletines, publicaciones, blog, capacitaciones, popups)
 *      + sus tablas puente hacia `portals`
 *   5. Empresas / certificados / carga masiva
 *   6. Auditoría, jobs y configuración
 *   7. Relations
 *
 * Convención: columnas snake_case, PK `id`, timestamps con zona horaria.
 * Regla multiportal (ver plan §5): ninguna tabla de contenido tiene `portal_id`
 * directo; la pertenencia se expresa con `distribution_type` + tabla puente.
 */
import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { isNull } from 'drizzle-orm';

/* ────────────────────────────────────────────────────────────
 * 1. ENUMS
 * ──────────────────────────────────────────────────────────── */

export const userRole = pgEnum('user_role', [
  'superadmin', 
  'editor', 
  'document_manager', 
  'content_manager'
]);
export const userStatus = pgEnum('user_status', ['active', 'suspended']);
export const entityStatus = pgEnum('entity_status', ['active', 'inactive']);

export const contentModule = pgEnum('content_module', ['blog', 'boletin', 'board', 'training']);
export const mediaKind = pgEnum('media_kind', [
  'image',
  'document',
  'video',
  'archive',
  'other',
]);

export const distributionType = pgEnum('distribution_type', ['specific', 'general', 'all']);

/** Estados genéricos de contenido (boletines, publicaciones, capacitaciones). */
export const contentStatus = pgEnum('content_status', ['draft', 'published', 'archived']);
/** Blog: incluye programado. */
export const blogStatus = pgEnum('blog_status', [
  'draft',
  'scheduled',
  'published',
  'archived',
]);
/** Popups: ciclo de vida completo. */
export const popupStatus = pgEnum('popup_status', [
  'draft',
  'scheduled',
  'active',
  'inactive',
  'finished',
]);
export const popupPageMode = pgEnum('popup_page_mode', ['all_pages', 'specific_pages']);
export const popupLinkType = pgEnum('popup_link_type', ['internal', 'external', 'none']);
export const popupFrequency = pgEnum('popup_frequency', [
  'always',
  'once_session',
  'once_user',
  'every_x_days',
]);
export const popupDevice = pgEnum('popup_device', ['all', 'desktop', 'tablet', 'mobile']);

/** Estados de un juego de estados financieros (se publica una vez al año). */
export const financialStatementStatus = pgEnum('financial_statement_status', [
  'draft',
  'published',
  'archived',
]);

export const bulkJobKind = pgEnum('bulk_job_kind', ['multi_pdf', 'zip', 'csv_zip']);
export const bulkJobStatus = pgEnum('bulk_job_status', [
  'queued',
  'processing',
  'completed',
  'completed_with_errors',
  'failed',
]);
export const bulkItemStatus = pgEnum('bulk_item_status', ['pending', 'ok', 'error', 'skipped']);

/* ────────────────────────────────────────────────────────────
 * 2. AUTENTICACIÓN
 *    Tablas requeridas por Better Auth (core + plugin admin).
 *    Los nombres de propiedad coinciden con lo que espera Better Auth;
 *    las columnas se mapean a snake_case.
 * ──────────────────────────────────────────────────────────── */

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    // Plugin admin de Better Auth:
    role: userRole('role').notNull().default('editor'),
    banned: boolean('banned').notNull().default(false),
    banReason: text('ban_reason'),
    banExpires: timestamp('ban_expires', { withTimezone: true }),
    // Campos propios del CMS:
    status: userStatus('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_uniq').on(t.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    impersonatedBy: text('impersonated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sessions_token_uniq').on(t.token),
    index('sessions_user_id_idx').on(t.userId),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    /** Requerido por Better Auth ≥ 1.7 (emisor OIDC; vacío para credenciales). */
    issuer: text('issuer'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
);

/** Contador de rate limiting persistente de Better Auth. */
export const rateLimits = pgTable('rate_limits', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

/* ────────────────────────────────────────────────────────────
 * 3. ENTIDADES NÚCLEO
 * ──────────────────────────────────────────────────────────── */

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Nombre único dentro del bucket (regenerado, no confiable el original). */
    filename: text('filename').notNull(),
    originalName: text('original_name').notNull(),
    internalName: text('internal_name'),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storageKey: text('storage_key').notNull(),
    /** Miniatura webp para imágenes (opcional). */
    thumbnailKey: text('thumbnail_key'),
    kind: mediaKind('kind').notNull().default('other'),
    width: integer('width'),
    height: integer('height'),
    checksumSha256: varchar('checksum_sha256', { length: 64 }),
    uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('media_storage_key_uniq').on(t.storageKey),
    index('media_kind_idx').on(t.kind),
    index('media_uploaded_by_idx').on(t.uploadedBy),
  ],
);

export const portals = pgTable(
  'portals',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    url: text('url').notNull(),
    logoMediaId: uuid('logo_media_id').references(() => media.id, { onDelete: 'set null' }),
    description: text('description'),
    status: entityStatus('status').notNull().default('active'),
    /** URL del deploy hook para reconstruir el sitio al publicar contenido. */
    deployHookUrl: text('deploy_hook_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('portals_slug_uniq').on(t.slug),
    index('portals_status_idx').on(t.status),
  ],
);

export const companies = pgTable(
  'companies',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    /** NIT / identificación tributaria. */
    taxId: varchar('tax_id', { length: 32 }).notNull(),
    logoMediaId: uuid('logo_media_id').references(() => media.id, { onDelete: 'set null' }),
    description: text('description'),
    status: entityStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('companies_tax_id_uniq').on(t.taxId)],
);

export const categories = pgTable(
  'categories',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    module: contentModule('module').notNull(),
    name: text('name').notNull(),
    slug: varchar('slug', { length: 96 }).notNull(),
    /** NULL = categoría transversal a todos los portales de ese módulo. */
    portalId: bigint('portal_id', { mode: 'number' }).references(() => portals.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('categories_module_slug_portal_uniq').on(t.module, t.slug, t.portalId),
    index('categories_module_idx').on(t.module),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    slug: varchar('slug', { length: 96 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tags_slug_uniq').on(t.slug)],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    portalId: bigint('portal_id', { mode: 'number' })
      .notNull()
      .references(() => portals.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Hash SHA-256 de la clave; el valor en claro solo se muestra al crearla. */
    keyHash: varchar('key_hash', { length: 64 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 12 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('api_keys_key_hash_uniq').on(t.keyHash),
    index('api_keys_portal_id_idx').on(t.portalId),
  ],
);

/* ────────────────────────────────────────────────────────────
 * 4. CONTENIDOS MULTIPORTAL
 * ──────────────────────────────────────────────────────────── */

/* ---- Boletines ---- */
export const boletines = pgTable(
  'boletines',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    title: text('title').notNull(),
    description: text('description'),
    pdfMediaId: uuid('pdf_media_id').references(() => media.id, { onDelete: 'restrict' }),
    coverMediaId: uuid('cover_media_id').references(() => media.id, { onDelete: 'set null' }),
    categoryId: bigint('category_id', { mode: 'number' }).references(() => categories.id, {
      onDelete: 'set null',
    }),
    publishedDate: timestamp('published_date', { withTimezone: true }),
    status: contentStatus('status').notNull().default('draft'),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    distributionType: distributionType('distribution_type').notNull().default('specific'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('boletines_status_date_idx').on(t.status, t.publishedDate),
    index('boletines_distribution_idx').on(t.distributionType),
    index('boletines_category_idx').on(t.categoryId),
  ],
);

export const boletinPortals = pgTable(
  'boletin_portals',
  {
    boletinId: bigint('boletin_id', { mode: 'number' })
      .notNull()
      .references(() => boletines.id, { onDelete: 'cascade' }),
    portalId: bigint('portal_id', { mode: 'number' })
      .notNull()
      .references(() => portals.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.boletinId, t.portalId] }),
    index('boletin_portals_portal_idx').on(t.portalId, t.boletinId),
  ],
);

/* ---- Publicaciones de cartelera ---- */
export const boardPublications = pgTable(
  'board_publications',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    title: text('title').notNull(),
    description: text('description'),
    imageMediaId: uuid('image_media_id').references(() => media.id, { onDelete: 'restrict' }),
    publishedDate: timestamp('published_date', { withTimezone: true }),
    status: contentStatus('status').notNull().default('draft'),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    distributionType: distributionType('distribution_type').notNull().default('specific'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('board_pub_status_date_idx').on(t.status, t.publishedDate),
    index('board_pub_distribution_idx').on(t.distributionType),
  ],
);

export const boardPublicationPortals = pgTable(
  'board_publication_portals',
  {
    boardPublicationId: bigint('board_publication_id', { mode: 'number' })
      .notNull()
      .references(() => boardPublications.id, { onDelete: 'cascade' }),
    portalId: bigint('portal_id', { mode: 'number' })
      .notNull()
      .references(() => portals.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.boardPublicationId, t.portalId] }),
    index('board_pub_portals_portal_idx').on(t.portalId, t.boardPublicationId),
  ],
);

/* ---- Blog ---- */
export const blogPosts = pgTable(
  'blog_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    excerpt: text('excerpt'),
    contentHtml: text('content_html'),
    contentJson: jsonb('content_json'),
    featuredMediaId: uuid('featured_media_id').references(() => media.id, {
      onDelete: 'set null',
    }),
    categoryId: bigint('category_id', { mode: 'number' }).references(() => categories.id, {
      onDelete: 'set null',
    }),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    status: blogStatus('status').notNull().default('draft'),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    ogMediaId: uuid('og_media_id').references(() => media.id, { onDelete: 'set null' }),
    distributionType: distributionType('distribution_type').notNull().default('specific'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('blog_posts_slug_uniq')
      .on(t.slug)
      .where(isNull(t.deletedAt)), // <--- Esto permite repetir el slug si el anterior fue borrado lógicamente
    index('blog_posts_status_published_idx').on(t.status, t.publishedAt),
    index('blog_posts_distribution_idx').on(t.distributionType),
    index('blog_posts_scheduled_idx').on(t.scheduledAt),
    index('blog_posts_category_idx').on(t.categoryId),
  ],
);

export const blogPostPortals = pgTable(
  'blog_post_portals',
  {
    blogPostId: uuid('blog_post_id')
      .notNull()
      .references(() => blogPosts.id, { onDelete: 'cascade' }),
    portalId: bigint('portal_id', { mode: 'number' })
      .notNull()
      .references(() => portals.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.blogPostId, t.portalId] }),
    index('blog_post_portals_portal_idx').on(t.portalId, t.blogPostId),
  ],
);

export const blogPostTags = pgTable(
  'blog_post_tags',
  {
    blogPostId: uuid('blog_post_id')
      .notNull()
      .references(() => blogPosts.id, { onDelete: 'cascade' }),
    tagId: bigint('tag_id', { mode: 'number' })
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.blogPostId, t.tagId] }),
    index('blog_post_tags_tag_idx').on(t.tagId),
  ],
);

/* ---- Capacitaciones ---- */
export const trainingMaterials = pgTable(
  'training_materials',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    title: text('title').notNull(),
    description: text('description'),
    fileMediaId: uuid('file_media_id').references(() => media.id, { onDelete: 'restrict' }),
    imageMediaId: uuid('image_media_id').references(() => media.id, { onDelete: 'set null' }),
    categoryId: bigint('category_id', { mode: 'number' }).references(() => categories.id, {
      onDelete: 'set null',
    }),
    publishedDate: timestamp('published_date', { withTimezone: true }),
    status: contentStatus('status').notNull().default('draft'),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    distributionType: distributionType('distribution_type').notNull().default('specific'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('training_status_date_idx').on(t.status, t.publishedDate),
    index('training_distribution_idx').on(t.distributionType),
  ],
);

export const trainingMaterialPortals = pgTable(
  'training_material_portals',
  {
    trainingMaterialId: bigint('training_material_id', { mode: 'number' })
      .notNull()
      .references(() => trainingMaterials.id, { onDelete: 'cascade' }),
    portalId: bigint('portal_id', { mode: 'number' })
      .notNull()
      .references(() => portals.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.trainingMaterialId, t.portalId] }),
    index('training_portals_portal_idx').on(t.portalId, t.trainingMaterialId),
  ],
);

/* ---- Popups ---- */
export const popups = pgTable(
  'popups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    internalName: text('internal_name').notNull(),
    distributionType: distributionType('distribution_type').notNull().default('specific'),
    title: text('title'),
    subtitle: text('subtitle'),
    description: text('description'),
    imageMediaId: uuid('image_media_id').references(() => media.id, { onDelete: 'set null' }),
    mobileImageMediaId: uuid('mobile_image_media_id').references(() => media.id, {
      onDelete: 'set null',
    }),
    buttonText: text('button_text'),
    url: text('url'),
    linkType: popupLinkType('link_type').notNull().default('none'),
    pageMode: popupPageMode('page_mode').notNull().default('all_pages'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    status: popupStatus('status').notNull().default('draft'),
    priority: integer('priority').notNull().default(0),
    frequency: popupFrequency('frequency').notNull().default('once_session'),
    frequencyDays: integer('frequency_days'),
    device: popupDevice('device').notNull().default('all'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('popups_status_idx').on(t.status),
    index('popups_window_idx').on(t.startsAt, t.endsAt),
    index('popups_distribution_idx').on(t.distributionType),
  ],
);

export const popupPortals = pgTable(
  'popup_portals',
  {
    popupId: uuid('popup_id')
      .notNull()
      .references(() => popups.id, { onDelete: 'cascade' }),
    portalId: bigint('portal_id', { mode: 'number' })
      .notNull()
      .references(() => portals.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.popupId, t.portalId] }),
    index('popup_portals_portal_idx').on(t.portalId, t.popupId),
  ],
);

export const popupPages = pgTable(
  'popup_pages',
  {
    popupId: uuid('popup_id')
      .notNull()
      .references(() => popups.id, { onDelete: 'cascade' }),
    /** Ruta relativa del sitio: '/', '/noticias', '/servicios/medicina-general'. */
    path: varchar('path', { length: 512 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.popupId, t.path] })],
);

/* ---- Banners (hero / slider de la parte superior de las páginas) ---- */
export const banners = pgTable(
  'banners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    internalName: text('internal_name').notNull(),
    distributionType: distributionType('distribution_type').notNull().default('specific'),
    title: text('title'),
    subtitle: text('subtitle'),
    description: text('description'),
    imageMediaId: uuid('image_media_id').references(() => media.id, { onDelete: 'set null' }),
    mobileImageMediaId: uuid('mobile_image_media_id').references(() => media.id, {
      onDelete: 'set null',
    }),
    buttonText: text('button_text'),
    url: text('url'),
    linkType: popupLinkType('link_type').notNull().default('none'),
    /** Orden dentro del carrusel de la portada (menor primero). */
    sortOrder: integer('sort_order').notNull().default(0),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    status: popupStatus('status').notNull().default('draft'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('banners_status_idx').on(t.status),
    index('banners_window_idx').on(t.startsAt, t.endsAt),
    index('banners_distribution_idx').on(t.distributionType),
    index('banners_sort_idx').on(t.sortOrder),
  ],
);

export const bannerPortals = pgTable(
  'banner_portals',
  {
    bannerId: uuid('banner_id')
      .notNull()
      .references(() => banners.id, { onDelete: 'cascade' }),
    portalId: bigint('portal_id', { mode: 'number' })
      .notNull()
      .references(() => portals.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.bannerId, t.portalId] }),
    index('banner_portals_portal_idx').on(t.portalId, t.bannerId),
  ],
);

/* ────────────────────────────────────────────────────────────
 /* ────────────────────────────────────────────────────────────
 * 5. EMPRESAS / CERTIFICADOS / CARGA MASIVA
 * ──────────────────────────────────────────────────────────── */
export const certificates = pgTable('certificates', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  companyId: integer('company_id').notNull(),
  taxYear: integer('tax_year').notNull(),
  documentNumber: varchar('document_number', { length: 32 }).notNull(),
  fullName: text('full_name'),
  description: text('description'),
  pdfMediaId: uuid('pdf_media_id') // <-- CAMBIAR A UUID AQUÍ
    .notNull()
    .references(() => media.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  issuedDate: timestamp('issued_date'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const certificateFilenamePatterns = pgTable('certificate_filename_patterns', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 120 }).notNull(),
  regex: text('regex').notNull(),
  documentGroup: varchar('document_group', { length: 40 }).notNull(),
  nameGroup: varchar('name_group', { length: 40 }), // <-- AÑADIR ESTA LÍNEA
  yearGroup: varchar('year_group', { length: 40 }),
  isDefault: boolean('is_default').default(false).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
});

export const bulkJobs = pgTable(
  'bulk_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: bulkJobKind('kind').notNull(),
    companyId: bigint('company_id', { mode: 'number' })
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    taxYear: integer('tax_year').notNull(),
    
    /** Descripción o periodo opcional para la carga masiva. */
    description: text('description'),

    patternId: bigint('pattern_id', { mode: 'number' }).references(
      () => certificateFilenamePatterns.id,
      { onDelete: 'set null' },
    ),
    status: bulkJobStatus('status').notNull().default('queued'),
    total: integer('total').notNull().default(0),
    processed: integer('processed').notNull().default(0),
    succeeded: integer('succeeded').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    /** Prefijo en storage donde se subieron los archivos de origen. */
    sourcePrefix: text('source_prefix'),
    /** Mapa nombre_archivo → { document, fullName, year } de la planilla CSV/Excel. */
    csvMap: jsonb('csv_map'),
    errorReportMediaId: uuid('error_report_media_id').references(() => media.id, {
      onDelete: 'set null',
    }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('bulk_jobs_status_idx').on(t.status),
    index('bulk_jobs_company_idx').on(t.companyId),
  ],
);

export const bulkJobItems = pgTable(
  'bulk_job_items',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    bulkJobId: uuid('bulk_job_id')
      .notNull()
      .references(() => bulkJobs.id, { onDelete: 'cascade' }),
    sourceFilename: text('source_filename').notNull(),
    /** Objeto ya subido al storage (se reutiliza como PDF del certificado). */
    storageKey: text('storage_key').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
    detectedDocument: varchar('detected_document', { length: 32 }),
    detectedYear: integer('detected_year'),
    fullName: text('full_name'),
    mediaId: uuid('media_id').references(() => media.id, { onDelete: 'set null' }),
    certificateId: bigint('certificate_id', { mode: 'number' }).references(
      () => certificates.id,
      { onDelete: 'set null' },
    ),
    status: bulkItemStatus('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('bulk_job_items_job_status_idx').on(t.bulkJobId, t.status)],
);

/* ---- Estados financieros (se publican una vez al año, por empresa) ---- */
export const financialStatements = pgTable(
  'financial_statements',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    companyId: bigint('company_id', { mode: 'number' })
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    fiscalYear: integer('fiscal_year').notNull(),
    title: text('title'),
    summary: text('summary'),
    publishedDate: timestamp('published_date', { withTimezone: true }),
    status: financialStatementStatus('status').notNull().default('draft'),
    distributionType: distributionType('distribution_type').notNull().default('specific'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // 👈 ESTO ES LO ÚNICO QUE EVITA EL CONFLICTO CON EL SOFT DELETE:
    uniqueIndex('financial_statements_company_year_uniq')
      .on(t.companyId, t.fiscalYear)
      .where(isNull(t.deletedAt)),
      
    index('financial_statements_company_year_idx').on(t.companyId, t.fiscalYear),
    index('financial_statements_status_idx').on(t.status),
    index('financial_statements_distribution_idx').on(t.distributionType),
  ],
);

export const financialStatementFiles = pgTable(
  'financial_statement_files',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    financialStatementId: bigint('financial_statement_id', { mode: 'number' })
      .notNull()
      .references(() => financialStatements.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('financial_statement_files_statement_idx').on(t.financialStatementId)],
);

export const financialStatementPortals = pgTable(
  'financial_statement_portals',
  {
    financialStatementId: bigint('financial_statement_id', { mode: 'number' })
      .notNull()
      .references(() => financialStatements.id, { onDelete: 'cascade' }),
    portalId: bigint('portal_id', { mode: 'number' })
      .notNull()
      .references(() => portals.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.financialStatementId, t.portalId] }),
    index('financial_statement_portals_portal_idx').on(t.portalId, t.financialStatementId),
  ],
);

/* ────────────────────────────────────────────────────────────
 * 6. AUDITORÍA, JOBS, CONFIGURACIÓN
 * ──────────────────────────────────────────────────────────── */

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 64 }).notNull(),
    module: varchar('module', { length: 48 }).notNull(),
    entityType: varchar('entity_type', { length: 48 }),
    entityId: text('entity_id'),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata'),
    ip: varchar('ip', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_created_idx').on(t.createdAt),
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    index('audit_logs_user_idx').on(t.userId),
    index('audit_logs_module_idx').on(t.module),
  ],
);

/** Caché de conteos del dashboard (recalculado por job). */
export const dashboardStats = pgTable('dashboard_stats', {
  key: varchar('key', { length: 96 }).primaryKey(),
  value: jsonb('value').notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable('settings', {
  key: varchar('key', { length: 96 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ────────────────────────────────────────────────────────────
 * 7. RELATIONS
 * ──────────────────────────────────────────────────────────── */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  uploadedMedia: many(media),
  auditLogs: many(auditLogs),
}));

export const portalsRelations = relations(portals, ({ one, many }) => ({
  logo: one(media, { fields: [portals.logoMediaId], references: [media.id] }),
  apiKeys: many(apiKeys),
  boletinPortals: many(boletinPortals),
  boardPublicationPortals: many(boardPublicationPortals),
  blogPostPortals: many(blogPostPortals),
  trainingMaterialPortals: many(trainingMaterialPortals),
  popupPortals: many(popupPortals),
  bannerPortals: many(bannerPortals),
  financialStatementPortals: many(financialStatementPortals),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  logo: one(media, { fields: [companies.logoMediaId], references: [media.id] }),
  certificates: many(certificates),
  bulkJobs: many(bulkJobs),
  financialStatements: many(financialStatements),
}));

export const boletinesRelations = relations(boletines, ({ one, many }) => ({
  pdf: one(media, { fields: [boletines.pdfMediaId], references: [media.id] }),
  cover: one(media, { fields: [boletines.coverMediaId], references: [media.id] }),
  category: one(categories, {
    fields: [boletines.categoryId],
    references: [categories.id],
  }),
  author: one(users, { fields: [boletines.authorId], references: [users.id] }),
  portals: many(boletinPortals),
}));

export const boletinPortalsRelations = relations(boletinPortals, ({ one }) => ({
  boletin: one(boletines, {
    fields: [boletinPortals.boletinId],
    references: [boletines.id],
  }),
  portal: one(portals, { fields: [boletinPortals.portalId], references: [portals.id] }),
}));

export const boardPublicationsRelations = relations(boardPublications, ({ one, many }) => ({
  image: one(media, { fields: [boardPublications.imageMediaId], references: [media.id] }),
  author: one(users, { fields: [boardPublications.authorId], references: [users.id] }),
  portals: many(boardPublicationPortals),
}));

export const boardPublicationPortalsRelations = relations(
  boardPublicationPortals,
  ({ one }) => ({
    boardPublication: one(boardPublications, {
      fields: [boardPublicationPortals.boardPublicationId],
      references: [boardPublications.id],
    }),
    portal: one(portals, {
      fields: [boardPublicationPortals.portalId],
      references: [portals.id],
    }),
  }),
);

export const blogPostsRelations = relations(blogPosts, ({ one, many }) => ({
  featuredImage: one(media, {
    fields: [blogPosts.featuredMediaId],
    references: [media.id],
  }),
  ogImage: one(media, { fields: [blogPosts.ogMediaId], references: [media.id] }),
  category: one(categories, {
    fields: [blogPosts.categoryId],
    references: [categories.id],
  }),
  author: one(users, { fields: [blogPosts.authorId], references: [users.id] }),
  portals: many(blogPostPortals),
  tags: many(blogPostTags),
}));

export const blogPostPortalsRelations = relations(blogPostPortals, ({ one }) => ({
  blogPost: one(blogPosts, {
    fields: [blogPostPortals.blogPostId],
    references: [blogPosts.id],
  }),
  portal: one(portals, { fields: [blogPostPortals.portalId], references: [portals.id] }),
}));

export const blogPostTagsRelations = relations(blogPostTags, ({ one }) => ({
  blogPost: one(blogPosts, {
    fields: [blogPostTags.blogPostId],
    references: [blogPosts.id],
  }),
  tag: one(tags, { fields: [blogPostTags.tagId], references: [tags.id] }),
}));

export const trainingMaterialsRelations = relations(trainingMaterials, ({ one, many }) => ({
  file: one(media, { fields: [trainingMaterials.fileMediaId], references: [media.id] }),
  image: one(media, { fields: [trainingMaterials.imageMediaId], references: [media.id] }),
  category: one(categories, {
    fields: [trainingMaterials.categoryId],
    references: [categories.id],
  }),
  author: one(users, { fields: [trainingMaterials.authorId], references: [users.id] }),
  portals: many(trainingMaterialPortals),
}));

export const trainingMaterialPortalsRelations = relations(
  trainingMaterialPortals,
  ({ one }) => ({
    trainingMaterial: one(trainingMaterials, {
      fields: [trainingMaterialPortals.trainingMaterialId],
      references: [trainingMaterials.id],
    }),
    portal: one(portals, {
      fields: [trainingMaterialPortals.portalId],
      references: [portals.id],
    }),
  }),
);

export const popupsRelations = relations(popups, ({ one, many }) => ({
  image: one(media, { fields: [popups.imageMediaId], references: [media.id] }),
  mobileImage: one(media, {
    fields: [popups.mobileImageMediaId],
    references: [media.id],
  }),
  author: one(users, { fields: [popups.createdBy], references: [users.id] }),
  portals: many(popupPortals),
  pages: many(popupPages),
}));

export const popupPortalsRelations = relations(popupPortals, ({ one }) => ({
  popup: one(popups, { fields: [popupPortals.popupId], references: [popups.id] }),
  portal: one(portals, { fields: [popupPortals.portalId], references: [portals.id] }),
}));

export const popupPagesRelations = relations(popupPages, ({ one }) => ({
  popup: one(popups, { fields: [popupPages.popupId], references: [popups.id] }),
}));

export const bannersRelations = relations(banners, ({ one, many }) => ({
  image: one(media, { fields: [banners.imageMediaId], references: [media.id] }),
  mobileImage: one(media, {
    fields: [banners.mobileImageMediaId],
    references: [media.id],
  }),
  author: one(users, { fields: [banners.createdBy], references: [users.id] }),
  portals: many(bannerPortals),
}));

export const bannerPortalsRelations = relations(bannerPortals, ({ one }) => ({
  banner: one(banners, { fields: [bannerPortals.bannerId], references: [banners.id] }),
  portal: one(portals, { fields: [bannerPortals.portalId], references: [portals.id] }),
}));

export const financialStatementsRelations = relations(
  financialStatements,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [financialStatements.companyId],
      references: [companies.id],
    }),
    author: one(users, {
      fields: [financialStatements.createdBy],
      references: [users.id],
    }),
    files: many(financialStatementFiles),
    portals: many(financialStatementPortals),
  }),
);

export const financialStatementFilesRelations = relations(
  financialStatementFiles,
  ({ one }) => ({
    statement: one(financialStatements, {
      fields: [financialStatementFiles.financialStatementId],
      references: [financialStatements.id],
    }),
    media: one(media, {
      fields: [financialStatementFiles.mediaId],
      references: [media.id],
    }),
  }),
);

export const financialStatementPortalsRelations = relations(
  financialStatementPortals,
  ({ one }) => ({
    statement: one(financialStatements, {
      fields: [financialStatementPortals.financialStatementId],
      references: [financialStatements.id],
    }),
    portal: one(portals, {
      fields: [financialStatementPortals.portalId],
      references: [portals.id],
    }),
  }),
);

export const certificatesRelations = relations(certificates, ({ one }) => ({
  company: one(companies, {
    fields: [certificates.companyId],
    references: [companies.id],
  }),
  pdf: one(media, { fields: [certificates.pdfMediaId], references: [media.id] }),
}));

export const bulkJobsRelations = relations(bulkJobs, ({ one, many }) => ({
  company: one(companies, { fields: [bulkJobs.companyId], references: [companies.id] }),
  pattern: one(certificateFilenamePatterns, {
    fields: [bulkJobs.patternId],
    references: [certificateFilenamePatterns.id],
  }),
  errorReport: one(media, {
    fields: [bulkJobs.errorReportMediaId],
    references: [media.id],
  }),
  items: many(bulkJobItems),
}));

export const bulkJobItemsRelations = relations(bulkJobItems, ({ one }) => ({
  job: one(bulkJobs, { fields: [bulkJobItems.bulkJobId], references: [bulkJobs.id] }),
  certificate: one(certificates, {
    fields: [bulkJobItems.certificateId],
    references: [certificates.id],
  }),
}));

/* ────────────────────────────────────────────────────────────
 * Tipos inferidos de conveniencia
 * ──────────────────────────────────────────────────────────── */

export type User = typeof users.$inferSelect;
export type Portal = typeof portals.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Boletin = typeof boletines.$inferSelect;
export type BoardPublication = typeof boardPublications.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type TrainingMaterial = typeof trainingMaterials.$inferSelect;
export type Popup = typeof popups.$inferSelect;
export type Banner = typeof banners.$inferSelect;
export type FinancialStatement = typeof financialStatements.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type BulkJob = typeof bulkJobs.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

export type DistributionType = (typeof distributionType.enumValues)[number];

/** Marca temporal SQL reutilizable para migraciones manuales. */
export const nowSql = sql`now()`;
