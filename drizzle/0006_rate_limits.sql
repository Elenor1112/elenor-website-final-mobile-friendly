-- Fixed-window request counters shared across serverless instances (chat
-- assistant, contact form). Written by hand: the drizzle snapshots stop at
-- 0003, so a generated migration would re-create tables from 0004/0005.
CREATE TABLE IF NOT EXISTS "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
