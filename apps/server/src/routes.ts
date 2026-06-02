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

const setupOwnerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
  password: z.string().min(10).max(200)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200)
});

const createBookmarkSchema = z.object({
  title: z.string().min(1).max(300),
  url: z.string().url(),
  description: z.string().max(1000).optional(),
  collectionId: z.string().uuid().optional(),
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

const createExtensionTokenSchema = z.object({
  deviceName: z.string().min(1).max(120),
  browser: z.string().max(80).optional(),
  extensionVersion: z.string().max(40).optional()
});

const deviceIdParamsSchema = z.object({
  deviceId: z.string().uuid()
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
    const user = getUserBySession(db, request.cookies[sessionCookieName]);
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
    const user = getUserBySession(db, request.cookies[sessionCookieName]);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    return { devices: listExtensionDevices(db, user.id) };
  });

  app.delete("/api/extension/devices/:deviceId", async (request, reply) => {
    const user = getUserBySession(db, request.cookies[sessionCookieName]);
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

  app.get("/api/bookmarks", async (request, reply) => {
    const user = getUserFromRequest(db, request.cookies[sessionCookieName], request.headers.authorization);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
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
        collections.name AS collectionName
      FROM bookmarks
      JOIN collections ON collections.id = bookmarks.collection_id
      WHERE bookmarks.created_by_user_id = ?
      ORDER BY bookmarks.created_at DESC
      LIMIT 100
    `).all(user.id);

    return { bookmarks: rows };
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
      WHERE workspace_id = ? AND normalized_url = ?
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
    const workspace = getDefaultWorkspace(db, user.id);
    const collection = input.collectionId
      ? getCollectionForUser(db, input.collectionId, user.id)
      : getDefaultPersonalCollection(db, user.id);

    if (!collection || collection.workspace_id !== workspace.id) {
      return reply.code(400).send({ error: "INVALID_COLLECTION" });
    }

    const { normalizedUrl, domain } = normalizeUrl(input.url);
    const existing = db.prepare(`
      SELECT id, title, url
      FROM bookmarks
      WHERE workspace_id = ? AND normalized_url = ?
      LIMIT 1
    `).get(workspace.id, normalizedUrl);

    if (existing) {
      return reply.code(409).send({ error: "DUPLICATE_BOOKMARK", bookmark: existing });
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
        user.id,
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

      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }

    return reply.code(201).send({
      bookmark: {
        id: bookmarkId,
        title: input.title,
        url: input.url,
        normalizedUrl,
        domain,
        collectionId: collection.id,
        createdAt: now
      }
    });
  });
}

function getDefaultWorkspace(db: DatabaseSync, ownerUserId: string) {
  const workspace = db.prepare("SELECT * FROM workspaces WHERE owner_user_id = ? LIMIT 1").get(ownerUserId) as
    | { id: string }
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
  `).get(userId) as { id: string; workspace_id: string } | undefined;
}

function getCollectionForUser(db: DatabaseSync, collectionId: string, userId: string) {
  return db.prepare(`
    SELECT *
    FROM collections
    WHERE id = ?
      AND archived_at IS NULL
      AND (owner_user_id = ? OR visibility = 'workspace')
    LIMIT 1
  `).get(collectionId, userId) as { id: string; workspace_id: string } | undefined;
}

function getUserFromRequest(db: DatabaseSync, sessionId: string | undefined, authorization: string | undefined) {
  return getUserBySession(db, sessionId) ?? getUserByBearerToken(db, authorization);
}

function getUserByBearerToken(db: DatabaseSync, authorization: string | undefined) {
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  return getUserByExtensionToken(db, match?.[1]);
}
