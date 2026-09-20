import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getProjectBySlug, listPublicEntries } from "@/lib/repo";
import { parseMarkdown } from "@/lib/markdown";
import { readableInk } from "@/lib/color";
import { Blocks, Leaf, TagSticker } from "@/components/blocks";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProjectBySlug(getDb(), (await params).slug);
  if (!p) return {};
  return {
    title: `Nouveautés de ${p.name}`,
    alternates: { types: { "application/rss+xml": `/c/${p.slug}/rss.xml` } },
  };
}

export default async function PublicChangelog({ params }: Props) {
  const project = getProjectBySlug(getDb(), (await params).slug);
  if (!project) notFound();
  const entries = listPublicEntries(getDb(), project.id, 100);
  const ink = readableInk(project.accent);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <p className="label">Journal des nouveautés</p>
      <h1 className="display text-4xl sm:text-5xl" style={{ overflowWrap: "anywhere" }}>
        {project.name}
      </h1>
      <p className="mt-3 text-sm">
        <a
          href={`/c/${project.slug}/rss.xml`}
          className="mono font-semibold underline underline-offset-4"
        >
          S&apos;abonner par RSS
        </a>
      </p>
      {entries.length === 0 ? (
        <p className="mt-8">Aucune nouveauté publiée pour l&apos;instant.</p>
      ) : null}
      <ol className="mt-8 list-none space-y-8 p-0">
        {entries.map((e) => (
          <li key={e.id} id={`e-${e.id}`}>
            <article className="flex flex-col gap-3 sm:flex-row sm:gap-5">
              <Leaf at={e.published_at} accent={project.accent} ink={ink} />
              <div className="card min-w-0 flex-1">
                <TagSticker tag={e.tag} />
                <h2 className="display mt-2 text-xl" style={{ overflowWrap: "anywhere" }}>
                  {e.title}
                </h2>
                <div className="mt-3">
                  <Blocks blocks={parseMarkdown(e.body)} />
                </div>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </main>
  );
}
