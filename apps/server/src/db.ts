import { DatabaseSync } from "node:sqlite";
import type { AppConfig } from "./config.js";

const migrations = [
  {
    id: "0001_initial",
    sql: `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
        created_at TEXT NOT NULL,
        last_login_at TEXT,
        disabled_at TEXT
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_user_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        owner_user_id TEXT NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('personal', 'shared')),
        visibility TEXT NOT NULL CHECK (visibility IN ('private', 'workspace')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        created_by_user_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        normalized_url TEXT NOT NULL,
        domain TEXT NOT NULL,
        description TEXT,
        favicon_url TEXT,
        collection_id TEXT NOT NULL REFERENCES collections(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS bookmark_sources (
        id TEXT PRIMARY KEY,
        bookmark_id TEXT NOT NULL REFERENCES bookmarks(id),
        source_type TEXT NOT NULL,
        source_browser TEXT,
        source_device TEXT,
        source_profile TEXT,
        source_url TEXT,
        local_bookmark_folder TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS extension_devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        browser TEXT,
        device_name TEXT NOT NULL,
        extension_version TEXT,
        token_hash TEXT NOT NULL,
        token_salt TEXT NOT NULL,
        last_seen_at TEXT,
        created_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_collections_workspace_id ON collections(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_workspace_id ON bookmarks(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_normalized_url ON bookmarks(workspace_id, normalized_url);
      CREATE INDEX IF NOT EXISTS idx_bookmark_sources_bookmark_id ON bookmark_sources(bookmark_id);
      CREATE INDEX IF NOT EXISTS idx_extension_devices_user_id ON extension_devices(user_id);
    `
  },
  {
    id: "0002_bookmarks_and_extension_devices",
    sql: `
      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        created_by_user_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        normalized_url TEXT NOT NULL,
        domain TEXT NOT NULL,
        description TEXT,
        favicon_url TEXT,
        collection_id TEXT NOT NULL REFERENCES collections(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS bookmark_sources (
        id TEXT PRIMARY KEY,
        bookmark_id TEXT NOT NULL REFERENCES bookmarks(id),
        source_type TEXT NOT NULL,
        source_browser TEXT,
        source_device TEXT,
        source_profile TEXT,
        source_url TEXT,
        local_bookmark_folder TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS extension_devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        browser TEXT,
        device_name TEXT NOT NULL,
        extension_version TEXT,
        token_hash TEXT NOT NULL,
        token_salt TEXT NOT NULL,
        last_seen_at TEXT,
        created_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_bookmarks_workspace_id ON bookmarks(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_normalized_url ON bookmarks(workspace_id, normalized_url);
      CREATE INDEX IF NOT EXISTS idx_bookmark_sources_bookmark_id ON bookmark_sources(bookmark_id);
      CREATE INDEX IF NOT EXISTS idx_extension_devices_user_id ON extension_devices(user_id);
    `
  }
];

export function openDatabase(config: AppConfig): DatabaseSync {
  const db = new DatabaseSync(config.dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  for (const migration of migrations) {
    const existing = db
      .prepare("SELECT id FROM schema_migrations WHERE id = ?")
      .get(migration.id);

    if (!existing) {
      db.exec("BEGIN;");
      try {
        db.exec(migration.sql);
        db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
          .run(migration.id, new Date().toISOString());
        db.exec("COMMIT;");
      } catch (error) {
        db.exec("ROLLBACK;");
        throw error;
      }
    }
  }

  return db;
}
