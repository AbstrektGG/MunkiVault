CREATE TABLE "asset_credentials" (
	"asset_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "asset_credentials_asset_id_credential_id_pk" PRIMARY KEY("asset_id","credential_id")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "credential_source" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "user_vault_key" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "asset_credentials" ADD CONSTRAINT "asset_credentials_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_credentials" ADD CONSTRAINT "asset_credentials_credential_id_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_credentials_credential_idx" ON "asset_credentials" USING btree ("credential_id");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_owner_idx" ON "organizations" USING btree ("owner_id");