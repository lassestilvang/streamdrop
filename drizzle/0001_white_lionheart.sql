ALTER TABLE "queue_runs" ALTER COLUMN "generated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_runs" ALTER COLUMN "source_signature" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_runs" ALTER COLUMN "result_json" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_runs" ALTER COLUMN "fetched_count" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_runs" ALTER COLUMN "extracted_count" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_runs" ALTER COLUMN "skipped_count" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_runs" ALTER COLUMN "batch_count" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_runs" ALTER COLUMN "word_count" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_runs" ALTER COLUMN "estimated_minutes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_runs" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "queue_runs" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "queue_runs" ADD COLUMN "error_json" jsonb;--> statement-breakpoint
CREATE INDEX "queue_runs_status_idx" ON "queue_runs" USING btree ("status");