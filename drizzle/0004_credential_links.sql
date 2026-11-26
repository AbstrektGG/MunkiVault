-- Carry existing one-to-one credential links into the new link table before dropping the old column.
INSERT INTO "asset_credentials" ("asset_id", "credential_id", "position")
SELECT "asset_id", "id", (row_number() OVER (PARTITION BY "asset_id" ORDER BY "name"))::int - 1
FROM "credentials" WHERE "asset_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "assets" SET "credential_source" = 'linked'
WHERE "id" IN (SELECT "asset_id" FROM "asset_credentials");
--> statement-breakpoint
ALTER TABLE "credentials" DROP CONSTRAINT "credentials_asset_id_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "credentials" DROP COLUMN "asset_id";
