CREATE TABLE "api_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"api_name" text NOT NULL,
	"status" text NOT NULL,
	"duration_ms" integer,
	"found" integer DEFAULT 0,
	"inserted" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"summary" text,
	"source" text,
	"discovered_at" timestamp DEFAULT now(),
	"deadline" timestamp,
	"prize_pool" text,
	"status" text DEFAULT 'new',
	"score" jsonb,
	"deep_dive_result" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "projects_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE INDEX "idx_api_logs_api_name" ON "api_logs" USING btree ("api_name");--> statement-breakpoint
CREATE INDEX "idx_api_logs_created_at" ON "api_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_projects_discovered_at" ON "projects" USING btree ("discovered_at");