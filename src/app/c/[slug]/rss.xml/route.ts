import { getDb } from "@/lib/db";
import { getProjectBySlug, listPublicEntries } from "@/lib/repo";
import { parseMarkdown, toPlainText } from "@/lib/markdown";
import { buildRss } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const project = getProjectBySlug(getDb(), (await ctx.params).slug);
  if (!project) return new Response("Not found", { status: 404 });
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3420";
  const xml = buildRss(
    {
      title: `${project.name}: nouveautés`,
      link: `${site}/c/${project.slug}`,
      description: `Journal des nouveautés de ${project.name}`,
    },
    listPublicEntries(getDb(), project.id, 30).map((e) => ({
      id: e.id,
      title: e.title,
      description: toPlainText(parseMarkdown(e.body)),
      publishedAt: e.published_at,
    })),
  );
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
