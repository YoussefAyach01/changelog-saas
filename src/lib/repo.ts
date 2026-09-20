import type { DatabaseSync } from "node:sqlite";

export type Project = {
  id: number;
  user_id: number;
  slug: string;
  name: string;
  accent: string;
  origins: string;
  created_at: number;
};
export type Entry = {
  id: number;
  project_id: number;
  title: string;
  body: string;
  tag: string;
  status: string;
  published_at: number;
  created_at: number;
};

export class ConflictError extends Error {
  constructor(public field: "email" | "slug") {
    super(`${field} already taken`);
  }
}

// ---- users & sessions -------------------------------------------------------------------------

export function createUser(
  db: DatabaseSync,
  email: string,
  pwHash: string,
  now = Date.now(),
): number {
  try {
    const r = db
      .prepare("INSERT INTO users (email, pw_hash, created_at) VALUES (?, ?, ?)")
      .run(email, pwHash, now);
    return Number(r.lastInsertRowid);
  } catch (e) {
    if (e instanceof Error && e.message.includes("users.email")) throw new ConflictError("email");
    throw e;
  }
}

export const getUserByEmail = (db: DatabaseSync, email: string) =>
  db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
    { id: number; email: string; pw_hash: string; plan: string } | undefined;

export function createSession(
  db: DatabaseSync,
  userId: number,
  tokenHash: string,
  expiresAt: number,
) {
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    tokenHash,
    userId,
    expiresAt,
  );
}

export function getSessionUser(db: DatabaseSync, tokenHash: string, now = Date.now()) {
  return db
    .prepare(
      `SELECT u.id, u.email, u.plan FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, now) as { id: number; email: string; plan: string } | undefined;
}

export const deleteSession = (db: DatabaseSync, tokenHash: string) =>
  void db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);

// ---- projects ---------------------------------------------------------------------------------

export function createProject(
  db: DatabaseSync,
  userId: number,
  slug: string,
  name: string,
  now = Date.now(),
) {
  try {
    const r = db
      .prepare("INSERT INTO projects (user_id, slug, name, created_at) VALUES (?, ?, ?, ?)")
      .run(userId, slug, name, now);
    return Number(r.lastInsertRowid);
  } catch (e) {
    if (e instanceof Error && e.message.includes("projects.slug")) throw new ConflictError("slug");
    throw e;
  }
}

export const listProjects = (db: DatabaseSync, userId: number) =>
  db.prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY id").all(userId) as Project[];

export const getOwnedProject = (db: DatabaseSync, userId: number, id: number) =>
  db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(id, userId) as
    Project | undefined;

export const getProjectBySlug = (db: DatabaseSync, slug: string) =>
  db.prepare("SELECT * FROM projects WHERE slug = ?").get(slug) as Project | undefined;

export function updateProject(
  db: DatabaseSync,
  userId: number,
  id: number,
  p: { name: string; accent: string; origins: string },
): boolean {
  return (
    Number(
      db
        .prepare(
          "UPDATE projects SET name = ?, accent = ?, origins = ? WHERE id = ? AND user_id = ?",
        )
        .run(p.name, p.accent, p.origins, id, userId).changes,
    ) > 0
  );
}

// ---- entries ----------------------------------------------------------------------------------

type EntryInput = { title: string; body: string; tag: string; status: string; publishedAt: number };

export function addEntry(
  db: DatabaseSync,
  projectId: number,
  e: EntryInput,
  now = Date.now(),
): number {
  const r = db
    .prepare(
      "INSERT INTO entries (project_id, title, body, tag, status, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(projectId, e.title, e.body, e.tag, e.status, e.publishedAt, now);
  return Number(r.lastInsertRowid);
}

export function updateEntry(
  db: DatabaseSync,
  projectId: number,
  id: number,
  e: EntryInput,
): boolean {
  return (
    Number(
      db
        .prepare(
          "UPDATE entries SET title = ?, body = ?, tag = ?, status = ?, published_at = ? WHERE id = ? AND project_id = ?",
        )
        .run(e.title, e.body, e.tag, e.status, e.publishedAt, id, projectId).changes,
    ) > 0
  );
}

export const deleteEntry = (db: DatabaseSync, projectId: number, id: number) =>
  Number(
    db.prepare("DELETE FROM entries WHERE id = ? AND project_id = ?").run(id, projectId).changes,
  ) > 0;

/** Owner view: drafts and scheduled entries included. */
export const listAllEntries = (db: DatabaseSync, projectId: number) =>
  db
    .prepare("SELECT * FROM entries WHERE project_id = ? ORDER BY published_at DESC, id DESC")
    .all(projectId) as Entry[];

/** Public view: published and already due (a future date means "scheduled"). */
export const listPublicEntries = (
  db: DatabaseSync,
  projectId: number,
  limit = 50,
  now = Date.now(),
) =>
  db
    .prepare(
      `SELECT * FROM entries WHERE project_id = ? AND status = 'published' AND published_at <= ?
       ORDER BY published_at DESC, id DESC LIMIT ?`,
    )
    .all(projectId, now, limit) as Entry[];
