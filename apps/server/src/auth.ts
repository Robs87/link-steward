import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "member";
};

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  role: "owner" | "member";
};

type ExtensionDeviceRow = {
  id: string;
  user_id: string;
  token_hash: string;
  token_salt: string;
};

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = Buffer.from(hashPassword(password, salt).hash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role
  };
}

export function ownerExists(db: DatabaseSync) {
  const row = db.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").get();
  return Boolean(row);
}

export function createOwner(db: DatabaseSync, input: { email: string; displayName: string; password: string }) {
  if (ownerExists(db)) {
    throw new Error("OWNER_ALREADY_EXISTS");
  }

  const now = new Date().toISOString();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const collectionId = randomUUID();
  const password = hashPassword(input.password);

  db.exec("BEGIN;");
  try {
    db.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, password_salt, role, created_at)
      VALUES (?, ?, ?, ?, ?, 'owner', ?)
    `).run(userId, input.email.toLowerCase(), input.displayName, password.hash, password.salt, now);

    db.prepare(`
      INSERT INTO workspaces (id, name, owner_user_id, created_at, updated_at)
      VALUES (?, 'Default Workspace', ?, ?, ?)
    `).run(workspaceId, userId, now, now);

    db.prepare(`
      INSERT INTO collections (id, workspace_id, owner_user_id, name, type, visibility, created_at, updated_at)
      VALUES (?, ?, ?, 'Personal Library', 'personal', 'private', ?, ?)
    `).run(collectionId, workspaceId, userId, now, now);

    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('localBookmarkFolder', 'Link Steward/Inbox', ?)
    `).run(now);

    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }

  return getUserById(db, userId);
}

export function getUserById(db: DatabaseSync, id: string) {
  return db.prepare("SELECT * FROM users WHERE id = ? AND disabled_at IS NULL").get(id) as UserRow | undefined;
}

export function getUserByEmail(db: DatabaseSync, email: string) {
  return db.prepare("SELECT * FROM users WHERE email = ? AND disabled_at IS NULL").get(email.toLowerCase()) as
    | UserRow
    | undefined;
}

export function createSession(db: DatabaseSync, userId: string) {
  const sessionId = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

  db.prepare(`
    INSERT INTO sessions (id, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, userId, now.toISOString(), expires.toISOString());

  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now.toISOString(), userId);

  return { sessionId, expiresAt: expires };
}

export function getUserBySession(db: DatabaseSync, sessionId: string | undefined) {
  if (!sessionId) return undefined;

  return db.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ?
      AND sessions.revoked_at IS NULL
      AND sessions.expires_at > ?
      AND users.disabled_at IS NULL
  `).get(sessionId, new Date().toISOString()) as UserRow | undefined;
}

export function revokeSession(db: DatabaseSync, sessionId: string | undefined) {
  if (!sessionId) return;
  db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(
    new Date().toISOString(),
    sessionId
  );
}

export function createExtensionToken(
  db: DatabaseSync,
  input: { userId: string; deviceName: string; browser?: string; extensionVersion?: string }
) {
  const deviceId = randomUUID();
  const tokenSecret = randomBytes(32).toString("base64url");
  const token = `lst_${deviceId}_${tokenSecret}`;
  const tokenHash = hashPassword(tokenSecret);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO extension_devices (
      id, user_id, browser, device_name, extension_version, token_hash, token_salt, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    deviceId,
    input.userId,
    input.browser ?? null,
    input.deviceName,
    input.extensionVersion ?? null,
    tokenHash.hash,
    tokenHash.salt,
    now
  );

  return { token, deviceId };
}

export function getUserByExtensionToken(db: DatabaseSync, token: string | undefined) {
  if (!token) return undefined;

  const match = /^lst_([0-9a-f-]+)_(.+)$/.exec(token);
  if (!match) return undefined;

  const [, deviceId, tokenSecret] = match;
  const device = db.prepare(`
    SELECT *
    FROM extension_devices
    WHERE id = ? AND revoked_at IS NULL
    LIMIT 1
  `).get(deviceId) as ExtensionDeviceRow | undefined;

  if (!device || !verifyPassword(tokenSecret, device.token_salt, device.token_hash)) {
    return undefined;
  }

  db.prepare("UPDATE extension_devices SET last_seen_at = ? WHERE id = ?").run(new Date().toISOString(), device.id);
  return getUserById(db, device.user_id);
}
