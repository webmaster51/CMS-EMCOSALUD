ALTER TYPE "public"."user_role" ADD VALUE 'document_manager';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'content_manager';--> statement-breakpoint
DROP INDEX "blog_posts_slug_uniq";--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_uniq" ON "blog_posts" USING btree ("slug") WHERE "blog_posts"."deleted_at" is null;