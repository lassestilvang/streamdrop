CREATE TABLE "queue_run_articles" (
	"run_id" text NOT NULL,
	"position" integer NOT NULL,
	"batch_index" integer NOT NULL,
	"raindrop_id" bigint NOT NULL,
	"source_url" text NOT NULL,
	"title" text NOT NULL,
	"source_created_at" timestamp with time zone,
	"word_count" integer NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"content_hash" text NOT NULL,
	CONSTRAINT "queue_run_articles_pk" PRIMARY KEY("run_id","position")
);
--> statement-breakpoint
CREATE TABLE "queue_run_batches" (
	"run_id" text NOT NULL,
	"batch_index" integer NOT NULL,
	"article_count" integer NOT NULL,
	"word_count" integer NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"html" text NOT NULL,
	CONSTRAINT "queue_run_batches_pk" PRIMARY KEY("run_id","batch_index")
);
--> statement-breakpoint
CREATE TABLE "queue_run_skips" (
	"run_id" text NOT NULL,
	"skip_index" integer NOT NULL,
	"source_url" text NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "queue_run_skips_pk" PRIMARY KEY("run_id","skip_index")
);
--> statement-breakpoint
CREATE TABLE "queue_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"config_hash" text NOT NULL,
	"source_signature" text NOT NULL,
	"config_json" jsonb NOT NULL,
	"result_json" jsonb NOT NULL,
	"fetched_count" integer NOT NULL,
	"extracted_count" integer NOT NULL,
	"skipped_count" integer NOT NULL,
	"batch_count" integer NOT NULL,
	"word_count" integer NOT NULL,
	"estimated_minutes" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "queue_run_articles" ADD CONSTRAINT "queue_run_articles_run_id_queue_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."queue_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_run_batches" ADD CONSTRAINT "queue_run_batches_run_id_queue_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."queue_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_run_skips" ADD CONSTRAINT "queue_run_skips_run_id_queue_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."queue_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "queue_run_articles_raindrop_id_idx" ON "queue_run_articles" USING btree ("raindrop_id");--> statement-breakpoint
CREATE INDEX "queue_run_articles_source_url_idx" ON "queue_run_articles" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "queue_runs_created_at_idx" ON "queue_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "queue_runs_config_hash_idx" ON "queue_runs" USING btree ("config_hash");--> statement-breakpoint
CREATE INDEX "queue_runs_source_signature_idx" ON "queue_runs" USING btree ("source_signature");