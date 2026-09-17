CREATE TYPE "public"."blog_status" AS ENUM('draft', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."bulk_item_status" AS ENUM('pending', 'ok', 'error', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."bulk_job_kind" AS ENUM('multi_pdf', 'zip', 'csv_zip');--> statement-breakpoint
CREATE TYPE "public"."bulk_job_status" AS ENUM('queued', 'processing', 'completed', 'completed_with_errors', 'failed');--> statement-breakpoint
CREATE TYPE "public"."content_module" AS ENUM('blog', 'boletin', 'board', 'training');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."distribution_type" AS ENUM('specific', 'general', 'all');--> statement-breakpoint
CREATE TYPE "public"."entity_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."financial_statement_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'document', 'video', 'archive', 'other');--> statement-breakpoint
CREATE TYPE "public"."popup_device" AS ENUM('all', 'desktop', 'tablet', 'mobile');--> statement-breakpoint
CREATE TYPE "public"."popup_frequency" AS ENUM('always', 'once_session', 'once_user', 'every_x_days');--> statement-breakpoint
CREATE TYPE "public"."popup_link_type" AS ENUM('internal', 'external', 'none');--> statement-breakpoint
CREATE TYPE "public"."popup_page_mode" AS ENUM('all_pages', 'specific_pages');--> statement-breakpoint
CREATE TYPE "public"."popup_status" AS ENUM('draft', 'scheduled', 'active', 'inactive', 'finished');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'editor');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"issuer" text,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "api_keys_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"portal_id" bigint NOT NULL,
	"name" text NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text,
	"action" varchar(64) NOT NULL,
	"module" varchar(48) NOT NULL,
	"entity_type" varchar(48),
	"entity_id" text,
	"summary" text NOT NULL,
	"metadata" jsonb,
	"ip" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banner_portals" (
	"banner_id" uuid NOT NULL,
	"portal_id" bigint NOT NULL,
	CONSTRAINT "banner_portals_banner_id_portal_id_pk" PRIMARY KEY("banner_id","portal_id")
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"internal_name" text NOT NULL,
	"distribution_type" "distribution_type" DEFAULT 'specific' NOT NULL,
	"title" text,
	"subtitle" text,
	"description" text,
	"image_media_id" uuid,
	"mobile_image_media_id" uuid,
	"button_text" text,
	"url" text,
	"link_type" "popup_link_type" DEFAULT 'none' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"status" "popup_status" DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "blog_post_portals" (
	"blog_post_id" uuid NOT NULL,
	"portal_id" bigint NOT NULL,
	CONSTRAINT "blog_post_portals_blog_post_id_portal_id_pk" PRIMARY KEY("blog_post_id","portal_id")
);
--> statement-breakpoint
CREATE TABLE "blog_post_tags" (
	"blog_post_id" uuid NOT NULL,
	"tag_id" bigint NOT NULL,
	CONSTRAINT "blog_post_tags_blog_post_id_tag_id_pk" PRIMARY KEY("blog_post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" varchar(200) NOT NULL,
	"excerpt" text,
	"content_html" text,
	"content_json" jsonb,
	"featured_media_id" uuid,
	"category_id" bigint,
	"author_id" text,
	"published_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"status" "blog_status" DEFAULT 'draft' NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"og_media_id" uuid,
	"distribution_type" "distribution_type" DEFAULT 'specific' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "board_publication_portals" (
	"board_publication_id" bigint NOT NULL,
	"portal_id" bigint NOT NULL,
	CONSTRAINT "board_publication_portals_board_publication_id_portal_id_pk" PRIMARY KEY("board_publication_id","portal_id")
);
--> statement-breakpoint
CREATE TABLE "board_publications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "board_publications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"description" text,
	"image_media_id" uuid,
	"published_date" timestamp with time zone,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"author_id" text,
	"distribution_type" "distribution_type" DEFAULT 'specific' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "boletin_portals" (
	"boletin_id" bigint NOT NULL,
	"portal_id" bigint NOT NULL,
	CONSTRAINT "boletin_portals_boletin_id_portal_id_pk" PRIMARY KEY("boletin_id","portal_id")
);
--> statement-breakpoint
CREATE TABLE "boletines" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "boletines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"description" text,
	"pdf_media_id" uuid,
	"cover_media_id" uuid,
	"category_id" bigint,
	"published_date" timestamp with time zone,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"author_id" text,
	"distribution_type" "distribution_type" DEFAULT 'specific' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bulk_job_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bulk_job_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"bulk_job_id" uuid NOT NULL,
	"source_filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"detected_document" varchar(32),
	"detected_year" integer,
	"full_name" text,
	"media_id" uuid,
	"certificate_id" bigint,
	"status" "bulk_item_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "bulk_job_kind" NOT NULL,
	"company_id" bigint NOT NULL,
	"tax_year" integer NOT NULL,
	"pattern_id" bigint,
	"status" "bulk_job_status" DEFAULT 'queued' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"succeeded" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"source_prefix" text,
	"csv_map" jsonb,
	"error_report_media_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"module" "content_module" NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(96) NOT NULL,
	"portal_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate_filename_patterns" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "certificate_filename_patterns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"regex" text NOT NULL,
	"document_group" text DEFAULT 'doc' NOT NULL,
	"year_group" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "certificates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"company_id" bigint NOT NULL,
	"tax_year" integer NOT NULL,
	"document_number" varchar(32) NOT NULL,
	"full_name" text,
	"pdf_media_id" uuid NOT NULL,
	"status" "entity_status" DEFAULT 'active' NOT NULL,
	"issued_date" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "companies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"tax_id" varchar(32) NOT NULL,
	"logo_media_id" uuid,
	"description" text,
	"status" "entity_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_stats" (
	"key" varchar(96) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_statement_files" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "financial_statement_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"financial_statement_id" bigint NOT NULL,
	"label" text NOT NULL,
	"media_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_statement_portals" (
	"financial_statement_id" bigint NOT NULL,
	"portal_id" bigint NOT NULL,
	CONSTRAINT "financial_statement_portals_financial_statement_id_portal_id_pk" PRIMARY KEY("financial_statement_id","portal_id")
);
--> statement-breakpoint
CREATE TABLE "financial_statements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "financial_statements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"company_id" bigint NOT NULL,
	"fiscal_year" integer NOT NULL,
	"title" text,
	"summary" text,
	"published_date" timestamp with time zone,
	"status" "financial_statement_status" DEFAULT 'draft' NOT NULL,
	"distribution_type" "distribution_type" DEFAULT 'specific' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"internal_name" text,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"thumbnail_key" text,
	"kind" "media_kind" DEFAULT 'other' NOT NULL,
	"width" integer,
	"height" integer,
	"checksum_sha256" varchar(64),
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "popup_pages" (
	"popup_id" uuid NOT NULL,
	"path" varchar(512) NOT NULL,
	CONSTRAINT "popup_pages_popup_id_path_pk" PRIMARY KEY("popup_id","path")
);
--> statement-breakpoint
CREATE TABLE "popup_portals" (
	"popup_id" uuid NOT NULL,
	"portal_id" bigint NOT NULL,
	CONSTRAINT "popup_portals_popup_id_portal_id_pk" PRIMARY KEY("popup_id","portal_id")
);
--> statement-breakpoint
CREATE TABLE "popups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"internal_name" text NOT NULL,
	"distribution_type" "distribution_type" DEFAULT 'specific' NOT NULL,
	"title" text,
	"subtitle" text,
	"description" text,
	"image_media_id" uuid,
	"mobile_image_media_id" uuid,
	"button_text" text,
	"url" text,
	"link_type" "popup_link_type" DEFAULT 'none' NOT NULL,
	"page_mode" "popup_page_mode" DEFAULT 'all_pages' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"status" "popup_status" DEFAULT 'draft' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"frequency" "popup_frequency" DEFAULT 'once_session' NOT NULL,
	"frequency_days" integer,
	"device" "popup_device" DEFAULT 'all' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "portals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "portals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"slug" varchar(64) NOT NULL,
	"url" text NOT NULL,
	"logo_media_id" uuid,
	"description" text,
	"status" "entity_status" DEFAULT 'active' NOT NULL,
	"deploy_hook_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"impersonated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(96) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" varchar(96) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_material_portals" (
	"training_material_id" bigint NOT NULL,
	"portal_id" bigint NOT NULL,
	CONSTRAINT "training_material_portals_training_material_id_portal_id_pk" PRIMARY KEY("training_material_id","portal_id")
);
--> statement-breakpoint
CREATE TABLE "training_materials" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "training_materials_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"description" text,
	"file_media_id" uuid,
	"image_media_id" uuid,
	"category_id" bigint,
	"published_date" timestamp with time zone,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"author_id" text,
	"distribution_type" "distribution_type" DEFAULT 'specific' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'editor' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banner_portals" ADD CONSTRAINT "banner_portals_banner_id_banners_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banner_portals" ADD CONSTRAINT "banner_portals_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_mobile_image_media_id_media_id_fk" FOREIGN KEY ("mobile_image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_portals" ADD CONSTRAINT "blog_post_portals_blog_post_id_blog_posts_id_fk" FOREIGN KEY ("blog_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_portals" ADD CONSTRAINT "blog_post_portals_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_blog_post_id_blog_posts_id_fk" FOREIGN KEY ("blog_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_featured_media_id_media_id_fk" FOREIGN KEY ("featured_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_og_media_id_media_id_fk" FOREIGN KEY ("og_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_publication_portals" ADD CONSTRAINT "board_publication_portals_board_publication_id_board_publications_id_fk" FOREIGN KEY ("board_publication_id") REFERENCES "public"."board_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_publication_portals" ADD CONSTRAINT "board_publication_portals_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_publications" ADD CONSTRAINT "board_publications_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_publications" ADD CONSTRAINT "board_publications_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boletin_portals" ADD CONSTRAINT "boletin_portals_boletin_id_boletines_id_fk" FOREIGN KEY ("boletin_id") REFERENCES "public"."boletines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boletin_portals" ADD CONSTRAINT "boletin_portals_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boletines" ADD CONSTRAINT "boletines_pdf_media_id_media_id_fk" FOREIGN KEY ("pdf_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boletines" ADD CONSTRAINT "boletines_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boletines" ADD CONSTRAINT "boletines_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boletines" ADD CONSTRAINT "boletines_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_job_items" ADD CONSTRAINT "bulk_job_items_bulk_job_id_bulk_jobs_id_fk" FOREIGN KEY ("bulk_job_id") REFERENCES "public"."bulk_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_job_items" ADD CONSTRAINT "bulk_job_items_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_job_items" ADD CONSTRAINT "bulk_job_items_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_jobs" ADD CONSTRAINT "bulk_jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_jobs" ADD CONSTRAINT "bulk_jobs_pattern_id_certificate_filename_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."certificate_filename_patterns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_jobs" ADD CONSTRAINT "bulk_jobs_error_report_media_id_media_id_fk" FOREIGN KEY ("error_report_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_jobs" ADD CONSTRAINT "bulk_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_pdf_media_id_media_id_fk" FOREIGN KEY ("pdf_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_logo_media_id_media_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement_files" ADD CONSTRAINT "financial_statement_files_financial_statement_id_financial_statements_id_fk" FOREIGN KEY ("financial_statement_id") REFERENCES "public"."financial_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement_files" ADD CONSTRAINT "financial_statement_files_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement_portals" ADD CONSTRAINT "financial_statement_portals_financial_statement_id_financial_statements_id_fk" FOREIGN KEY ("financial_statement_id") REFERENCES "public"."financial_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement_portals" ADD CONSTRAINT "financial_statement_portals_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statements" ADD CONSTRAINT "financial_statements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statements" ADD CONSTRAINT "financial_statements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "popup_pages" ADD CONSTRAINT "popup_pages_popup_id_popups_id_fk" FOREIGN KEY ("popup_id") REFERENCES "public"."popups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "popup_portals" ADD CONSTRAINT "popup_portals_popup_id_popups_id_fk" FOREIGN KEY ("popup_id") REFERENCES "public"."popups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "popup_portals" ADD CONSTRAINT "popup_portals_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "popups" ADD CONSTRAINT "popups_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "popups" ADD CONSTRAINT "popups_mobile_image_media_id_media_id_fk" FOREIGN KEY ("mobile_image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "popups" ADD CONSTRAINT "popups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portals" ADD CONSTRAINT "portals_logo_media_id_media_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_material_portals" ADD CONSTRAINT "training_material_portals_training_material_id_training_materials_id_fk" FOREIGN KEY ("training_material_id") REFERENCES "public"."training_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_material_portals" ADD CONSTRAINT "training_material_portals_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_materials" ADD CONSTRAINT "training_materials_file_media_id_media_id_fk" FOREIGN KEY ("file_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_materials" ADD CONSTRAINT "training_materials_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_materials" ADD CONSTRAINT "training_materials_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_materials" ADD CONSTRAINT "training_materials_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_uniq" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_portal_id_idx" ON "api_keys" USING btree ("portal_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_module_idx" ON "audit_logs" USING btree ("module");--> statement-breakpoint
CREATE INDEX "banner_portals_portal_idx" ON "banner_portals" USING btree ("portal_id","banner_id");--> statement-breakpoint
CREATE INDEX "banners_status_idx" ON "banners" USING btree ("status");--> statement-breakpoint
CREATE INDEX "banners_window_idx" ON "banners" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "banners_distribution_idx" ON "banners" USING btree ("distribution_type");--> statement-breakpoint
CREATE INDEX "banners_sort_idx" ON "banners" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "blog_post_portals_portal_idx" ON "blog_post_portals" USING btree ("portal_id","blog_post_id");--> statement-breakpoint
CREATE INDEX "blog_post_tags_tag_idx" ON "blog_post_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_uniq" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_posts_status_published_idx" ON "blog_posts" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "blog_posts_distribution_idx" ON "blog_posts" USING btree ("distribution_type");--> statement-breakpoint
CREATE INDEX "blog_posts_scheduled_idx" ON "blog_posts" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "blog_posts_category_idx" ON "blog_posts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "board_pub_portals_portal_idx" ON "board_publication_portals" USING btree ("portal_id","board_publication_id");--> statement-breakpoint
CREATE INDEX "board_pub_status_date_idx" ON "board_publications" USING btree ("status","published_date");--> statement-breakpoint
CREATE INDEX "board_pub_distribution_idx" ON "board_publications" USING btree ("distribution_type");--> statement-breakpoint
CREATE INDEX "boletin_portals_portal_idx" ON "boletin_portals" USING btree ("portal_id","boletin_id");--> statement-breakpoint
CREATE INDEX "boletines_status_date_idx" ON "boletines" USING btree ("status","published_date");--> statement-breakpoint
CREATE INDEX "boletines_distribution_idx" ON "boletines" USING btree ("distribution_type");--> statement-breakpoint
CREATE INDEX "boletines_category_idx" ON "boletines" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "bulk_job_items_job_status_idx" ON "bulk_job_items" USING btree ("bulk_job_id","status");--> statement-breakpoint
CREATE INDEX "bulk_jobs_status_idx" ON "bulk_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bulk_jobs_company_idx" ON "bulk_jobs" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_module_slug_portal_uniq" ON "categories" USING btree ("module","slug","portal_id");--> statement-breakpoint
CREATE INDEX "categories_module_idx" ON "categories" USING btree ("module");--> statement-breakpoint
CREATE INDEX "cert_patterns_enabled_idx" ON "certificate_filename_patterns" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_company_year_doc_uniq" ON "certificates" USING btree ("company_id","tax_year","document_number");--> statement-breakpoint
CREATE INDEX "certificates_company_year_idx" ON "certificates" USING btree ("company_id","tax_year");--> statement-breakpoint
CREATE INDEX "certificates_document_idx" ON "certificates" USING btree ("document_number");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_tax_id_uniq" ON "companies" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "financial_statement_files_statement_idx" ON "financial_statement_files" USING btree ("financial_statement_id");--> statement-breakpoint
CREATE INDEX "financial_statement_portals_portal_idx" ON "financial_statement_portals" USING btree ("portal_id","financial_statement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_statements_company_year_uniq" ON "financial_statements" USING btree ("company_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "financial_statements_company_year_idx" ON "financial_statements" USING btree ("company_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "financial_statements_status_idx" ON "financial_statements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "financial_statements_distribution_idx" ON "financial_statements" USING btree ("distribution_type");--> statement-breakpoint
CREATE UNIQUE INDEX "media_storage_key_uniq" ON "media" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "media_kind_idx" ON "media" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "media_uploaded_by_idx" ON "media" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "popup_portals_portal_idx" ON "popup_portals" USING btree ("portal_id","popup_id");--> statement-breakpoint
CREATE INDEX "popups_status_idx" ON "popups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "popups_window_idx" ON "popups" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "popups_distribution_idx" ON "popups" USING btree ("distribution_type");--> statement-breakpoint
CREATE UNIQUE INDEX "portals_slug_uniq" ON "portals" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "portals_status_idx" ON "portals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uniq" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_uniq" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "training_portals_portal_idx" ON "training_material_portals" USING btree ("portal_id","training_material_id");--> statement-breakpoint
CREATE INDEX "training_status_date_idx" ON "training_materials" USING btree ("status","published_date");--> statement-breakpoint
CREATE INDEX "training_distribution_idx" ON "training_materials" USING btree ("distribution_type");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uniq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");