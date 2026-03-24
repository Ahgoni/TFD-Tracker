-- Remove materials inventory feature (tracker uses AppState JSON; this was legacy row sync).
DROP TABLE IF EXISTS "MaterialEntry";
