ALTER TABLE "matches" DROP CONSTRAINT "matches_run_idempotency_key";--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "challenge_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_idempotency_key" UNIQUE("challenge_id","idempotency_key");