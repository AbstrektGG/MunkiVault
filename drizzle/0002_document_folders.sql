-- Turn the old free-text document "folder" values into real root folders before dropping the column.
INSERT INTO "folders" ("org_id", "name", "icon")
SELECT DISTINCT "org_id", btrim("folder"), 'documents' FROM "documents"
WHERE "folder" IS NOT NULL AND btrim("folder") <> '';
--> statement-breakpoint
UPDATE "documents" AS d SET "folder_id" = f."id"
FROM "folders" AS f
WHERE f."org_id" = d."org_id" AND f."parent_id" IS NULL AND f."name" = btrim(d."folder");
--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "folder";
