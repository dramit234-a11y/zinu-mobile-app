CREATE TABLE "city_ride_categories" (
	"city_id" uuid NOT NULL,
	"category_code" varchar(16) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_ride_categories_city_id_category_code_pk" PRIMARY KEY("city_id","category_code")
);
--> statement-breakpoint
CREATE TABLE "fare_quotes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"city_id" uuid NOT NULL,
	"category_code" varchar(16) NOT NULL,
	"pricing_rule_id" uuid NOT NULL,
	"pickup" jsonb NOT NULL,
	"dropoff" jsonb NOT NULL,
	"distance_m" integer NOT NULL,
	"duration_s" integer NOT NULL,
	"polyline" text NOT NULL,
	"breakdown" jsonb NOT NULL,
	"total_paise" integer NOT NULL,
	"maps_provider" varchar(16) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"city_id" uuid NOT NULL,
	"category_code" varchar(16) NOT NULL,
	"version" integer NOT NULL,
	"base_fare_paise" integer NOT NULL,
	"base_distance_m" integer NOT NULL,
	"per_km_paise" integer NOT NULL,
	"per_min_paise" integer NOT NULL,
	"min_fare_paise" integer NOT NULL,
	"platform_fee_paise" integer NOT NULL,
	"tax_bps" integer NOT NULL,
	"night_surcharge_bps" integer NOT NULL,
	"night_start_hour" integer NOT NULL,
	"night_end_hour" integer NOT NULL,
	"note" varchar(200),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recent_places" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120),
	"address" varchar(300) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"place_id" varchar(300),
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ride_categories" (
	"code" varchar(16) PRIMARY KEY NOT NULL,
	"name" varchar(40) NOT NULL,
	"description" varchar(120) NOT NULL,
	"capacity" integer NOT NULL,
	"vehicle_types" text[] NOT NULL,
	"per_seat" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_places" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(8) NOT NULL,
	"name" varchar(120),
	"address" varchar(300) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"place_id" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "city_ride_categories" ADD CONSTRAINT "city_ride_categories_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_ride_categories" ADD CONSTRAINT "city_ride_categories_category_code_ride_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "public"."ride_categories"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_quotes" ADD CONSTRAINT "fare_quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_quotes" ADD CONSTRAINT "fare_quotes_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_quotes" ADD CONSTRAINT "fare_quotes_pricing_rule_id_pricing_rules_id_fk" FOREIGN KEY ("pricing_rule_id") REFERENCES "public"."pricing_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_category_code_ride_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "public"."ride_categories"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_places" ADD CONSTRAINT "recent_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fare_quotes_user_idx" ON "fare_quotes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "fare_quotes_group_idx" ON "fare_quotes" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_rules_version_uq" ON "pricing_rules" USING btree ("city_id","category_code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "recent_places_user_address_uq" ON "recent_places" USING btree ("user_id","address");--> statement-breakpoint
CREATE INDEX "recent_places_user_idx" ON "recent_places" USING btree ("user_id","used_at");--> statement-breakpoint
CREATE INDEX "saved_places_user_idx" ON "saved_places" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_places_home_work_uq" ON "saved_places" USING btree ("user_id","label") WHERE label in ('HOME','WORK');