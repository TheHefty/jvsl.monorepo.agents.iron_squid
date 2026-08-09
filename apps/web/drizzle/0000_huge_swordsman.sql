CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"handle" text NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenges_public_id_key" UNIQUE("public_id"),
	CONSTRAINT "challenges_secret_hash_key" UNIQUE("secret_hash")
);
--> statement-breakpoint
CREATE TABLE "draws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"weapon_id" text NOT NULL,
	"head_id" text NOT NULL,
	"clothes_id" text NOT NULL,
	"shoes_id" text NOT NULL,
	"drawn_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"draw_id" uuid NOT NULL,
	"result" text NOT NULL,
	"mode" text NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"idempotency_key" text NOT NULL,
	CONSTRAINT "matches_run_idempotency_key" UNIQUE("run_id","idempotency_key"),
	CONSTRAINT "matches_result_check" CHECK (result in ('win', 'loss')),
	CONSTRAINT "matches_mode_check" CHECK (mode in ('splatZones', 'towerControl', 'rainmaker', 'clamBlitz'))
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "runs_challenge_number_key" UNIQUE("challenge_id","number")
);
--> statement-breakpoint
ALTER TABLE "draws" ADD CONSTRAINT "draws_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "draws_run_idx" ON "draws" USING btree ("run_id","drawn_at");--> statement-breakpoint
CREATE INDEX "matches_run_played_idx" ON "matches" USING btree ("run_id","played_at");