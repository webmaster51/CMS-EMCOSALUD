DROP INDEX "financial_statements_company_year_uniq";--> statement-breakpoint
ALTER TABLE "certificates" ALTER COLUMN "pdf_media_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "bulk_jobs" ADD COLUMN "description" text;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_statements_company_year_uniq" ON "financial_statements" USING btree ("company_id","fiscal_year") WHERE "financial_statements"."deleted_at" is null;