import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createOwner,
  createExtensionToken,
  createSession,
  getUserByExtensionToken,
  getUserByEmail,
  getUserBySession,
  listExtensionDevices,
  ownerExists,
  revokeExtensionDevice,
  revokeSession,
  toPublicUser,
  verifyPassword
} from "./auth.js";
import type { AppConfig } from "./config.js";
import { normalizeUrl } from "./url.js";

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  role: "owner" | "member";
};

type WorkspaceRow = { id: string };
type CollectionRow = {
  id: string;
  workspace_id: string;
  owner_user_id: string;
  name: string;
  type: "personal" | "shared";
  visibility: "private" | "workspace";
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type BookmarkRow = {
  id: string;
  title: string;
  url: string;
  normalizedUrl: string;
  domain: string;
  description: string | null;
  collectionId: string;
  collectionName: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "archived";
  tagsJson: string;
};

const setupOwnerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
  password: z.string().min(10).max(200)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200)
});

const tagsSchema = z.array(z.string().trim().min(1).max(60)).max(20).optional();

const createBookmarkSchema = z.object({
  title: z.string().min(1).max(300),
  url: z.string().url(),
  description: z.string().max(1000).optional(),
  collectionId: z.string().uuid().optional(),
  tags: tagsSchema,
  source: z
    .object({
      type: z.enum(["extension", "html_import", "api", "future_sync"]).default("api"),
      browser: z.string().max(80).optional(),
      device: z.string().max(120).optional(),
      profile: z.string().max(120).optional(),
      localBookmarkFolder: z.string().max(300).optional()
    })
    .optional()
});

const updateBookmarkSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(1000).nullable().optional(),
  collectionId: z.string().uuid().optional(),
  tags: tagsSchema
});

const bookmarkParamsSchema = z.object({
  bookmarkId: z.string().uuid()
});

const bookmarkQuerySchema = z.object({
  q: z.string().max(200).optional(),
  collectionId: z.string().uuid().optional(),
  status: z.enum(["active", "archived", "all"]).default("active")
});

const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["personal", "shared"]).default("shared"),
  visibility: z.enum(["private", "workspace"]).optional()
});

const updateCollectionSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  visibility: z.enum(["private", "workspace"]).optional(),
  archived: z.boolean().optional()
});

const collectionParamsSchema = z.object({
  collectionId: z.string().uuid()
});

const createExtensionTokenSchema = z.object({
  deviceName: z.string().min(1).max(120),
  browser: z.string().max(80).optional(),
  extensionVersion: z.string().max(40).optional()
});

const deviceIdParamsSchema = z.object({
  deviceId: z.string().uuid()
});

const htmlImportSchema = z.object({
  html: z.string().min(1).max(10_000_000),
  collectionId: z.string().uuid().optional()
});

const exportQuerySchema = z.object({
  collectionId: z.string().uuid().optional()
});

const sessionCookieName = "ls_session";

export async function registerRoutes(app: FastifyInstance, db: DatabaseSync, config: AppConfig) {
  app.get("/api/health", async () => ({
    ok: true,
    service: "link-steward",
    time: new Date().toISOString()
  }));

  app.get("/api/auth/setup-status", async () => ({
    ownerExists: ownerExists(db)
  }));

  app.post("/api/auth/setup-owner", async (request, reply) => {
    const input = setupOwnerSchema.parse(request.body);
    const user = createOwner(db, input);
    if (!user) {
      throw new Error("OWNER_CREATE_FAILED");
    }

    const session = createSession(db, user.id);
    reply.setCookie(sessionCookieName, session.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.cookieSecure,
      path: "/",
      expires: session.expiresAt
    });

    return { user: toPublicUser(user) };
  });

  app.post("/api/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = getUserByEmail(db, input.email);

    if (!user || !verifyPassword(input.password, user.password_salt, user.password_hash)) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const session = createSession(db, user.id);
    reply.setCookie(sessionCookieName, session.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.cookieSecure,
      path: "/",
      expires: session.expiresAt
    });

    return { user: toPublicUser(user) };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    revokeSession(db, request.cookies[sessionCookieName]);
    reply.clearCookie(sessionCookieName, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (request, reply) => {
    const user = getUserFromRequest(db, request.cookies[sessionCookieName], request.headers.authorization);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    return { user: toPublicUser(user) };
  });

  app.post("/api/extension/tokens", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const input = createExtensionTokenSchema.parse(request.body);
    const token = createExtensionToken(db, {
      userId: user.id,
      deviceName: input.deviceName,
      browser: input.browser,
      extensionVersion: input.extensionVersion
    });

    return reply.code(201).send(token);
  });

  app.get("/api/extension/devices", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    return { devices: listExtensionDevices(db, user.id) };
  });

  app.delete("/api/extension/devices/:deviceId", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const params = deviceIdParamsSchema.parse(request.params);
    const revoked = revokeExtensionDevice(db, {
      userId: user.id,
      deviceId: params.deviceId
    });

    if (!revoked) {
      return reply.code(404).send({ error: "DEVICE_NOT_FOUND" });
    }

    return { ok: true };
  });

  app.get("/api/extension/me", async (request, reply) => {
    const user = getUserByBearerToken(db, request.headers.authorization);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    return { user: toPublicUser(user) };
  });

  app.get("/api/collections", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    return { collections: listCollections(db, user.id) };
  });

  app.post("/api/collections", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const input = createCollectionSchema.parse(request.body);
    const workspace = getDefaultWorkspace(db, user.id);
    const now = new Date().toISOString();
    const collectionId = randomUUID();
    const visibility = input.visibility ?? (input.type === "shared" ? "workspace" : "private");

    db.prepare(`
      INSERT INTO collections (id, workspace_id, owner_user_id, name, type, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(collectionId, workspace.id, user.id, input.name, input.type, visibility, now, now);

    return reply.code(201).send({ collection: getCollectionById(db, collectionId, user.id) });
  });

  app.patch("/api/collections/:collectionId", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const params = collectionParamsSchema.parse(request.params);
    const input = updateCollectionSchema.parse(request.body);
    const collection = getCollectionForUser(db, params.collectionId, user.id, { includeArchived: true });
    if (!collection) {
      return reply.code(404).send({ error: "COLLECTION_NOT_FOUND" });
    }
    if (collection.type === "personal" && input.archived) {
      return reply.code(400).send({ error: "CANNOT_ARCHIVE_PERSONAL_LIBRARY" });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE collections
      SET name = COALESCE(?, name),
          visibility = COALESCE(?, visibility),
          archived_at = CASE
            WHEN ? = 1 THEN COALESCE(archived_at, ?)
            WHEN ? = 0 THEN NULL
            ELSE archived_at
          END,
          updated_at = ?
      WHERE id = ? AND owner_user_id = ?
    `).run(
      input.name ?? null,
      input.visibility ?? null,
      input.archived === undefined ? null : input.archived ? 1 : 0,
      now,
      input.archived === undefined ? null : input.archived ? 1 : 0,
      now,
      params.collectionId,
      user.id
    );

    return { collection: getCollectionById(db, params.collectionId, user.id) };
  });

  app.get("/api/tags", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const workspace = getDefaultWorkspace(db, user.id);
    const tags = db.prepare(`
      SELECT tags.id, tags.name, COUNT(bookmark_tags.bookmark_id) AS bookmarkCount
      FROM tags
      LEFT JOIN bookmark_tags ON bookmark_tags.tag_id = tags.id
      WHERE tags.workspace_id = ?
      GROUP BY tags.id
      ORDER BY tags.name COLLATE NOCASE
    `).all(workspace.id);

    return { tags };
  });

  app.get("/api/bookmarks", async (request, reply) => {
    const user = getUserFromRequest(db, request.cookies[sessionCookieName], request.headers.authorization);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const query = bookmarkQuerySchema.parse(request.query);
    return { bookmarks: listBookmarks(db, user.id, query) };
  });

  app.get("/api/bookmarks/check-duplicate", async (request, reply) => {
    const user = getUserFromRequest(db, request.cookies[sessionCookieName], request.headers.authorization);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const query = z.object({ url: z.string().url() }).parse(request.query);
    const { normalizedUrl } = normalizeUrl(query.url);
    const workspace = getDefaultWorkspace(db, user.id);
    const existing = db.prepare(`
      SELECT id, title, url
      FROM bookmarks
      WHERE workspace_id = ? AND normalized_url = ? AND status = 'active'
      LIMIT 1
    `).get(workspace.id, normalizedUrl);

    return { duplicate: Boolean(existing), bookmark: existing ?? null };
  });

  app.post("/api/bookmarks", async (request, reply) => {
    const user = getUserFromRequest(db, request.cookies[sessionCookieName], request.headers.authorization);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const input = createBookmarkSchema.parse(request.body);
    const result = createBookmark(db, user.id, input);
    if (result.duplicate) {
      return reply.code(409).send({ error: "DUPLICATE_BOOKMARK", bookmark: result.bookmark });
    }

    return reply.code(201).send({ bookmark: result.bookmark });
  });

  app.patch("/api/bookmarks/:bookmarkId", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const params = bookmarkParamsSchema.parse(request.params);
    const input = updateBookmarkSchema.parse(request.body);
    const bookmark = getBookmarkForUser(db, params.bookmarkId, user.id, { includeArchived: true });
    if (!bookmark) {
      return reply.code(404).send({ error: "BOOKMARK_NOT_FOUND" });
    }

    if (input.collectionId) {
      const target = getCollectionForUser(db, input.collectionId, user.id);
      if (!target || target.workspace_id !== bookmark.workspace_id) {
        return reply.code(400).send({ error: "INVALID_COLLECTION" });
      }
    }

    db.prepare(`
      UPDATE bookmarks
      SET title = COALESCE(?, title),
          description = ?,
          collection_id = COALESCE(?, collection_id),
          updated_at = ?
      WHERE id = ? AND created_by_user_id = ?
    `).run(
      input.title ?? null,
      input.description === undefined ? bookmark.description : input.description,
      input.collectionId ?? null,
      new Date().toISOString(),
      params.bookmarkId,
      user.id
    );

    if (input.tags) {
      setBookmarkTags(db, bookmark.workspace_id, params.bookmarkId, input.tags);
    }

    return { bookmark: getBookmarkForUser(db, params.bookmarkId, user.id, { includeArchived: true }) };
  });

  app.delete("/api/bookmarks/:bookmarkId", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const params = bookmarkParamsSchema.parse(request.params);
    const result = db.prepare(`
      UPDATE bookmarks
      SET status = 'archived', updated_at = ?
      WHERE id = ? AND created_by_user_id = ? AND status = 'active'
    `).run(new Date().toISOString(), params.bookmarkId, user.id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: "BOOKMARK_NOT_FOUND" });
    }

    return { ok: true };
  });

  app.post("/api/import/html-bookmarks", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const input = htmlImportSchema.parse(request.body);
    const workspace = getDefaultWorkspace(db, user.id);
    const collection = input.collectionId
      ? getCollectionForUser(db, input.collectionId, user.id)
      : getDefaultPersonalCollection(db, user.id);
    if (!collection || collection.workspace_id !== workspace.id) {
      return reply.code(400).send({ error: "INVALID_COLLECTION" });
    }

    const parsed = parseBookmarksHtml(input.html);
    const imported: string[] = [];
    const skipped: Array<{ url: string; reason: string }> = [];

    for (const item of parsed) {
      const result = createBookmark(db, user.id, {
        title: item.title || item.url,
        url: item.url,
        collectionId: collection.id,
        source: { type: "html_import" }
      });
      if (result.duplicate) {
        skipped.push({ url: item.url, reason: "duplicate" });
      } else if (result.bookmark) {
        imported.push(String(result.bookmark.id));
      }
    }

    const jobId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO import_jobs (id, workspace_id, user_id, source_type, imported_count, skipped_count, report_json, created_at)
      VALUES (?, ?, ?, 'html_bookmarks', ?, ?, ?, ?)
    `).run(jobId, workspace.id, user.id, imported.length, skipped.length, JSON.stringify({ skipped }), now);

    return reply.code(201).send({
      job: {
        id: jobId,
        importedCount: imported.length,
        skippedCount: skipped.length,
        skipped
      }
    });
  });

  app.get("/api/export/json", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const query = exportQuerySchema.parse(request.query);
    const bookmarks = listBookmarks(db, user.id, { status: "active", collectionId: query.collectionId });
    reply.header("content-disposition", "attachment; filename=\"link-steward-bookmarks.json\"");
    return { exportedAt: new Date().toISOString(), bookmarks };
  });

  app.get("/api/export/markdown", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const query = exportQuerySchema.parse(request.query);
    const bookmarks = listBookmarks(db, user.id, { status: "active", collectionId: query.collectionId });
    reply.type("text/markdown; charset=utf-8");
    reply.header("content-disposition", "attachment; filename=\"link-steward-bookmarks.md\"");
    return toMarkdown(bookmarks);
  });

  app.get("/api/export/html", async (request, reply) => {
    const user = getSessionUser(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    const query = exportQuerySchema.parse(request.query);
    const bookmarks = listBookmarks(db, user.id, { status: "active", collectionId: query.collectionId });
    reply.type("text/html; charset=utf-8");
    reply.header("content-disposition", "attachment; filename=\"link-steward-bookmarks.html\"");
    return toBookmarksHtml(bookmarks);
  });
}

function createBookmark(
  db: DatabaseSync,
  userId: string,
  input: z.infer<typeof createBookmarkSchema>
): { duplicate: boolean; bookmark: Record<string, unknown> | null } {
  const workspace = getDefaultWorkspace(db, userId);
  const collection = input.collectionId
    ? getCollectionForUser(db, input.collectionId, userId)
    : getDefaultPersonalCollection(db, userId);

  if (!collection || collection.workspace_id !== workspace.id) {
    throw new Error("INVALID_COLLECTION");
  }

  const { normalizedUrl, domain } = normalizeUrl(input.url);
  const existing = db.prepare(`
    SELECT id, title, url
    FROM bookmarks
    WHERE workspace_id = ? AND normalized_url = ? AND status = 'active'
    LIMIT 1
  `).get(workspace.id, normalizedUrl) as Record<string, unknown> | undefined;

  if (existing) {
    return { duplicate: true, bookmark: existing };
  }

  const now = new Date().toISOString();
  const bookmarkId = randomUUID();
  const sourceId = randomUUID();
  const source = input.source ?? { type: "api" as const };

  db.exec("BEGIN;");
  try {
    db.prepare(`
      INSERT INTO bookmarks (
        id, workspace_id, created_by_user_id, title, url, normalized_url, domain,
        description, collection_id, created_at, updated_at, last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bookmarkId,
      workspace.id,
      userId,
      input.title,
      input.url,
      normalizedUrl,
      domain,
      input.description ?? null,
      collection.id,
      now,
      now,
      now
    );

    db.prepare(`
      INSERT INTO bookmark_sources (
        id, bookmark_id, source_type, source_browser, source_device, source_profile,
        source_url, local_bookmark_folder, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sourceId,
      bookmarkId,
      source.type,
      source.browser ?? null,
      source.device ?? null,
      source.profile ?? null,
      input.url,
      source.localBookmarkFolder ?? null,
      now
    );

    if (input.tags) {
      setBookmarkTags(db, workspace.id, bookmarkId, input.tags);
    }

    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }

  return {
    duplicate: false,
    bookmark: getBookmarkForUser(db, bookmarkId, userId, { includeArchived: true }) ?? null
  };
}

function listBookmarks(
  db: DatabaseSync,
  userId: string,
  input: { q?: string; collectionId?: string; status?: "active" | "archived" | "all" }
) {
  const clauses = ["bookmarks.created_by_user_id = ?"];
  const values: string[] = [userId];

  if (input.status && input.status !== "all") {
    clauses.push("bookmarks.status = ?");
    values.push(input.status);
  }

  if (input.collectionId) {
    clauses.push("bookmarks.collection_id = ?");
    values.push(input.collectionId);
  }

  if (input.q?.trim()) {
    const q = `%${input.q.trim().toLowerCase()}%`;
    clauses.push(`(
      lower(bookmarks.title) LIKE ?
      OR lower(bookmarks.url) LIKE ?
      OR lower(bookmarks.domain) LIKE ?
      OR lower(COALESCE(bookmarks.description, '')) LIKE ?
      OR EXISTS (
        SELECT 1
        FROM bookmark_tags
        JOIN tags ON tags.id = bookmark_tags.tag_id
        WHERE bookmark_tags.bookmark_id = bookmarks.id AND lower(tags.name) LIKE ?
      )
    )`);
    values.push(q, q, q, q, q);
  }

  const rows = db.prepare(`
    SELECT
      bookmarks.id,
      bookmarks.title,
      bookmarks.url,
      bookmarks.normalized_url AS normalizedUrl,
      bookmarks.domain,
      bookmarks.description,
      bookmarks.collection_id AS collectionId,
      bookmarks.created_at AS createdAt,
      bookmarks.updated_at AS updatedAt,
      bookmarks.status,
      collections.name AS collectionName,
      COALESCE((
        SELECT json_group_array(tags.name)
        FROM bookmark_tags
        JOIN tags ON tags.id = bookmark_tags.tag_id
        WHERE bookmark_tags.bookmark_id = bookmarks.id
      ), '[]') AS tagsJson
    FROM bookmarks
    JOIN collections ON collections.id = bookmarks.collection_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY bookmarks.created_at DESC
    LIMIT 500
  `).all(...values) as BookmarkRow[];

  return rows.map(mapBookmarkRow);
}

function getBookmarkForUser(
  db: DatabaseSync,
  bookmarkId: string,
  userId: string,
  options: { includeArchived?: boolean } = {}
) {
  const statusClause = options.includeArchived ? "" : "AND bookmarks.status = 'active'";
  const row = db.prepare(`
    SELECT
      bookmarks.id,
      bookmarks.title,
      bookmarks.url,
      bookmarks.normalized_url AS normalizedUrl,
      bookmarks.domain,
      bookmarks.description,
      bookmarks.collection_id AS collectionId,
      bookmarks.created_at AS createdAt,
      bookmarks.updated_at AS updatedAt,
      bookmarks.status,
      collections.name AS collectionName,
      COALESCE((
        SELECT json_group_array(tags.name)
        FROM bookmark_tags
        JOIN tags ON tags.id = bookmark_tags.tag_id
        WHERE bookmark_tags.bookmark_id = bookmarks.id
      ), '[]') AS tagsJson,
      bookmarks.workspace_id
    FROM bookmarks
    JOIN collections ON collections.id = bookmarks.collection_id
    WHERE bookmarks.id = ? AND bookmarks.created_by_user_id = ? ${statusClause}
    LIMIT 1
  `).get(bookmarkId, userId) as (BookmarkRow & { workspace_id: string }) | undefined;

  return row ? { ...mapBookmarkRow(row), workspace_id: row.workspace_id, description: row.description } : undefined;
}

function mapBookmarkRow(row: BookmarkRow) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    normalizedUrl: row.normalizedUrl,
    domain: row.domain,
    description: row.description,
    collectionId: row.collectionId,
    collectionName: row.collectionName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    status: row.status,
    tags: JSON.parse(row.tagsJson || "[]") as string[]
  };
}

function listCollections(db: DatabaseSync, userId: string) {
  return db.prepare(`
    SELECT
      collections.id,
      collections.name,
      collections.type,
      collections.visibility,
      collections.created_at AS createdAt,
      collections.updated_at AS updatedAt,
      collections.archived_at AS archivedAt,
      COUNT(bookmarks.id) AS bookmarkCount
    FROM collections
    LEFT JOIN bookmarks ON bookmarks.collection_id = collections.id AND bookmarks.status = 'active'
    WHERE collections.owner_user_id = ?
    GROUP BY collections.id
    ORDER BY collections.type = 'personal' DESC, collections.name COLLATE NOCASE
  `).all(userId);
}

function getCollectionById(db: DatabaseSync, collectionId: string, userId: string) {
  return db.prepare(`
    SELECT
      collections.id,
      collections.name,
      collections.type,
      collections.visibility,
      collections.created_at AS createdAt,
      collections.updated_at AS updatedAt,
      collections.archived_at AS archivedAt,
      COUNT(bookmarks.id) AS bookmarkCount
    FROM collections
    LEFT JOIN bookmarks ON bookmarks.collection_id = collections.id AND bookmarks.status = 'active'
    WHERE collections.id = ? AND collections.owner_user_id = ?
    GROUP BY collections.id
    LIMIT 1
  `).get(collectionId, userId);
}

function setBookmarkTags(db: DatabaseSync, workspaceId: string, bookmarkId: string, tags: string[]) {
  const cleanTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
  const now = new Date().toISOString();

  db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(bookmarkId);

  for (const tag of cleanTags) {
    const existing = db.prepare("SELECT id FROM tags WHERE workspace_id = ? AND name = ?").get(workspaceId, tag) as
      | { id: string }
      | undefined;
    const tagId = existing?.id ?? randomUUID();
    if (!existing) {
      db.prepare("INSERT INTO tags (id, workspace_id, name, created_at) VALUES (?, ?, ?, ?)").run(
        tagId,
        workspaceId,
        tag,
        now
      );
    }
    db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)").run(bookmarkId, tagId);
  }
}

function getDefaultWorkspace(db: DatabaseSync, ownerUserId: string) {
  const workspace = db.prepare("SELECT * FROM workspaces WHERE owner_user_id = ? LIMIT 1").get(ownerUserId) as
    | WorkspaceRow
    | undefined;

  if (!workspace) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }

  return workspace;
}

function getDefaultPersonalCollection(db: DatabaseSync, userId: string) {
  return db.prepare(`
    SELECT *
    FROM collections
    WHERE owner_user_id = ? AND type = 'personal' AND archived_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1
  `).get(userId) as CollectionRow | undefined;
}

function getCollectionForUser(
  db: DatabaseSync,
  collectionId: string,
  userId: string,
  options: { includeArchived?: boolean } = {}
) {
  const archivedClause = options.includeArchived ? "" : "AND archived_at IS NULL";
  return db.prepare(`
    SELECT *
    FROM collections
    WHERE id = ?
      ${archivedClause}
      AND (owner_user_id = ? OR visibility = 'workspace')
    LIMIT 1
  `).get(collectionId, userId) as CollectionRow | undefined;
}

function getSessionUser(db: DatabaseSync, sessionId: string | undefined) {
  return getUserBySession(db, sessionId) as UserRow | undefined;
}

function getUserFromRequest(db: DatabaseSync, sessionId: string | undefined, authorization: string | undefined) {
  return getUserBySession(db, sessionId) ?? getUserByBearerToken(db, authorization);
}

function getUserByBearerToken(db: DatabaseSync, authorization: string | undefined) {
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  return getUserByExtensionToken(db, match?.[1]) as UserRow | undefined;
}

function parseBookmarksHtml(html: string) {
  const items: Array<{ title: string; url: string }> = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const href = /href\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(match[1]);
    const url = href?.[2] ?? href?.[3] ?? href?.[4];
    if (!url || !/^https?:\/\//i.test(url)) {
      continue;
    }

    items.push({
      url,
      title: decodeHtml(stripTags(match[2])).trim() || url
    });
  }

  return items;
}

function toMarkdown(bookmarks: ReturnType<typeof mapBookmarkRow>[]) {
  const lines = ["# Link Steward Bookmarks", ""];
  const groups = groupByCollection(bookmarks);

  for (const [collection, items] of groups) {
    lines.push(`## ${collection}`, "");
    for (const bookmark of items) {
      const tags = bookmark.tags.length > 0 ? ` ${bookmark.tags.map((tag) => `#${tag.replace(/\s+/g, "-")}`).join(" ")}` : "";
      const description = bookmark.description ? ` - ${bookmark.description}` : "";
      lines.push(`- [${bookmark.title}](${bookmark.url})${description}${tags}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function toBookmarksHtml(bookmarks: ReturnType<typeof mapBookmarkRow>[]) {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Link Steward Bookmarks</TITLE>",
    "<H1>Link Steward Bookmarks</H1>",
    "<DL><p>"
  ];
  const groups = groupByCollection(bookmarks);

  for (const [collection, items] of groups) {
    lines.push(`  <DT><H3>${escapeHtml(collection)}</H3>`);
    lines.push("  <DL><p>");
    for (const bookmark of items) {
      lines.push(`    <DT><A HREF="${escapeHtml(bookmark.url)}">${escapeHtml(bookmark.title)}</A>`);
    }
    lines.push("  </DL><p>");
  }

  lines.push("</DL><p>");
  return lines.join("\n");
}

function groupByCollection(bookmarks: ReturnType<typeof mapBookmarkRow>[]) {
  const groups = new Map<string, ReturnType<typeof mapBookmarkRow>[]>();
  for (const bookmark of bookmarks) {
    const items = groups.get(bookmark.collectionName) ?? [];
    items.push(bookmark);
    groups.set(bookmark.collectionName, items);
  }
  return groups;
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
