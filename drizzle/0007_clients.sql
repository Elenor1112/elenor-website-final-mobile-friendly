-- Case-study clients with an uploadable logo. Written by hand: the drizzle
-- snapshots stop at 0003, so a generated migration would re-create tables.
CREATE TABLE IF NOT EXISTS "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clients" ADD CONSTRAINT "clients_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Existing case-study clients count as known clients.
INSERT INTO "clients" ("name")
SELECT DISTINCT trim("client") FROM "case_studies" WHERE trim("client") <> ''
ON CONFLICT ("name") DO NOTHING;
