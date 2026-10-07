CREATE TABLE "document_files" (
	"document_id" uuid NOT NULL,
	"upload_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "document_files_document_id_position_pk" PRIMARY KEY("document_id","position")
);
--> statement-breakpoint
CREATE TABLE "document_reminders" (
	"document_id" uuid NOT NULL,
	"threshold_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_reminders_document_id_threshold_days_pk" PRIMARY KEY("document_id","threshold_days")
);
--> statement-breakpoint
CREATE TABLE "document_types" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"label" varchar(80) NOT NULL,
	"owner_type" varchar(16) NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"requires_number" boolean DEFAULT false NOT NULL,
	"requires_expiry" boolean DEFAULT false NOT NULL,
	"min_files" integer DEFAULT 1 NOT NULL,
	"max_files" integer DEFAULT 2 NOT NULL,
	"fuel_types" text[],
	"block_online_when_expired" boolean DEFAULT true NOT NULL,
	"reminder_days" integer[] DEFAULT '{30,15,7,1}'::int[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"driver_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"doc_type" varchar(32) NOT NULL,
	"document_number" varchar(64),
	"expires_on" date,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_vehicles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"driver_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(48) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"push_status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"driver_id" uuid NOT NULL,
	"method" varchar(8) NOT NULL,
	"holder_name" varchar(100) NOT NULL,
	"details_enc" text NOT NULL,
	"masked_label" varchar(64) NOT NULL,
	"ifsc" varchar(11),
	"status" varchar(24) DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"purpose" varchar(32) NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" varchar(64) NOT NULL,
	"max_bytes" integer NOT NULL,
	"size_bytes" integer,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"registration_number" varchar(16) NOT NULL,
	"vehicle_type" varchar(16) NOT NULL,
	"fuel_type" varchar(16) NOT NULL,
	"ownership_type" varchar(24) NOT NULL,
	"fleet_partner_name" varchar(120),
	"make" varchar(60),
	"model" varchar(60),
	"colour" varchar(30),
	"manufacture_year" integer,
	"city_id" uuid,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "push_provider" varchar(16);--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_document_id_driver_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."driver_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reminders" ADD CONSTRAINT "document_reminders_document_id_driver_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."driver_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_doc_type_document_types_code_fk" FOREIGN KEY ("doc_type") REFERENCES "public"."document_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_vehicles" ADD CONSTRAINT "driver_vehicles_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_vehicles" ADD CONSTRAINT "driver_vehicles_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_files_upload_uq" ON "document_files" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "driver_documents_driver_idx" ON "driver_documents" USING btree ("driver_id","doc_type");--> statement-breakpoint
CREATE INDEX "driver_documents_expiry_idx" ON "driver_documents" USING btree ("expires_on") WHERE status = 'APPROVED' and superseded_at is null;--> statement-breakpoint
CREATE INDEX "driver_vehicles_driver_idx" ON "driver_vehicles" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "driver_vehicles_vehicle_idx" ON "driver_vehicles" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_vehicles_one_active_uq" ON "driver_vehicles" USING btree ("driver_id") WHERE active;--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_accounts_one_active_uq" ON "payout_accounts" USING btree ("driver_id") WHERE active;--> statement-breakpoint
CREATE INDEX "uploads_owner_idx" ON "uploads" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_registration_uq" ON "vehicles" USING btree ("registration_number");