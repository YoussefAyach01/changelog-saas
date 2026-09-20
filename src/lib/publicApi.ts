import { getDb } from "./db";
import { corsFor } from "./cors";
import { createLimiter } from "./ratelimit";
import { getProjectBySlug, listPublicEntries, type Project } from "./repo";
import { parseMarkdown } from "./markdown";

const g = globalThis as unknown as { __readLimiter?: ReturnType<typeof createLimiter> };
const readLimiter = (g.__readLimiter ??= createLimiter(300, 60 * 1000));

export function reply(data: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(data, {
    status,
    headers: {
      ...headers,
      "Cache-Control": "public, max-age=30",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

export async function preflight(req: Request, params: Promise<{ slug: string }>) {
  const project = getProjectBySlug(getDb(), (await params).slug);
  const headers = project ? corsFor(project.origins, req.headers.get("origin")) : null;
  return new Response(null, { status: headers ? 204 : 403, headers: headers ?? {} });
}

/** Entries as parsed Markdown blocks (data, not HTML) so the widget can render them with text nodes. */
export function entriesPayload(project: Project, limit: number, now = Date.now()) {
  return {
    project: { name: project.name, slug: project.slug, accent: project.accent },
    entries: listPublicEntries(getDb(), project.id, limit, now).map((e) => ({
      id: e.id,
      title: e.title,
      tag: e.tag,
      publishedAt: e.published_at,
      blocks: parseMarkdown(e.body),
    })),
  };
}

export async function guardRead(req: Request, params: Promise<{ slug: string }>) {
  const project = getProjectBySlug(getDb(), (await params).slug);
  if (!project)
    return reply({ error: "unknown_project" }, 404, { "Access-Control-Allow-Origin": "*" });
  const headers = corsFor(project.origins, req.headers.get("origin"));
  if (!headers) return Response.json({ error: "origin_not_allowed" }, { status: 403 });
  if (!readLimiter(`read:${project.id}:${clientIp(req)}`))
    return Response.json({ error: "rate_limited" }, { status: 429, headers });
  return { project, headers };
}
