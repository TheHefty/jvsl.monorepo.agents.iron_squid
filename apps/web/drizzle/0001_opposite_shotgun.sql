DROP INDEX "draws_run_idx";--> statement-breakpoint
DROP INDEX "matches_run_played_idx";--> statement-breakpoint
ALTER TABLE "draws" ADD COLUMN "seq" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "seq" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "draws" ADD CONSTRAINT "draws_run_seq_key" UNIQUE("run_id","seq");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_run_seq_key" UNIQUE("run_id","seq");