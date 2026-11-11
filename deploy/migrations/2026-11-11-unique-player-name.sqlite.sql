-- ============================================================
-- Migration: 1.0.0 -> 1.0.0 (sqlite)
-- Generated: 2026-11-11 00:03:43
-- ============================================================
-- Review this file carefully before applying.
-- WARNING comments indicate potentially destructive changes.
-- ============================================================

PRAGMA foreign_keys = OFF;

CREATE UNIQUE INDEX "uq_players_name" ON "players" ("name");

PRAGMA foreign_keys = ON;

-- Record migration
INSERT INTO "_framework_schema_version"
  (schema_version, framework_version, applied_at, model_hash, notes)
VALUES
  ('1.0.0', '0.2.0', CURRENT_TIMESTAMP, 'a1d25226f95b77cf6a0242d89c7b852f', 'migration from 1.0.0');

INSERT INTO "_framework_migrations"
  (from_version, to_version, applied_at, migration_sql, checksum)
VALUES
  ('1.0.0', '1.0.0', CURRENT_TIMESTAMP, 'see file', 'a1d25226f95b77cf6a0242d89c7b852f');
