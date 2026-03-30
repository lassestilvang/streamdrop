CREATE TABLE "user_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"raindrop_token" text,
	"collection_id" integer DEFAULT 0 NOT NULL,
	"processed_collection_id" integer,
	"search" text DEFAULT '' NOT NULL,
	"sort" text DEFAULT '-created' NOT NULL,
	"nested" boolean DEFAULT true NOT NULL,
	"max_articles" integer DEFAULT 20 NOT NULL,
	"max_minutes" integer DEFAULT 45 NOT NULL,
	"words_per_minute" integer DEFAULT 180 NOT NULL,
	"extraction_concurrency" integer DEFAULT 4 NOT NULL,
	"fetch_timeout_ms" integer DEFAULT 12000 NOT NULL,
	"max_html_bytes" integer DEFAULT 750000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "queue_runs" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_token_hash_idx" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_settings_collection_id_idx" ON "user_settings" USING btree ("collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
ALTER TABLE "queue_runs" ADD CONSTRAINT "queue_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "queue_runs_user_id_idx" ON "queue_runs" USING btree ("user_id");