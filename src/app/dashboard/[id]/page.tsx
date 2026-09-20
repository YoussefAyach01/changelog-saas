import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { getOwnedProject, listAllEntries } from "@/lib/repo";
import { TAGS } from "@/lib/validation";
import { TAG_LABEL } from "@/components/blocks";
import { createEntry, removeEntry, saveEntry, saveSettings } from "../../actions";

export const dynamic = "force-dynamic";

const isFuture = (t: number) => t > Date.now();
const day = (t?: number) => new Date(t ?? Date.now()).toISOString().slice(0, 10);

type EntryDefaults = {
  id?: number;
  title?: string;
  body?: string;
  tag?: string;
  status?: string;
  at?: number;
};

function EntryFields({ d, prefix }: { d: EntryDefaults; prefix: string }) {
  return (
    <>
      <div>
        <label className="label" htmlFor={`${prefix}-title`}>
          Titre
        </label>
        <input
          id={`${prefix}-title`}
          name="title"
          defaultValue={d.title}
          className="field"
          required
          maxLength={120}
        />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}-body`}>
          Texte (Markdown : **gras**, *italique*, - listes, [lien](https://...))
        </label>
        <textarea
          id={`${prefix}-body`}
          name="body"
          defaultValue={d.body}
          className="field mono"
          rows={5}
          maxLength={5000}
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="label" htmlFor={`${prefix}-tag`}>
            Type
          </label>
          <select id={`${prefix}-tag`} name="tag" defaultValue={d.tag ?? "new"} className="field">
            {TAGS.map((t) => (
              <option key={t} value={t}>
                {TAG_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${prefix}-status`}>
            Statut
          </label>
          <select
            id={`${prefix}-status`}
            name="status"
            defaultValue={d.status ?? "published"}
            className="field"
          >
            <option value="published">Publié</option>
            <option value="draft">Brouillon</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${prefix}-day`}>
            Date (future = programmée)
          </label>
          <input
            id={`${prefix}-day`}
            name="day"
            type="date"
            defaultValue={day(d.at)}
            className="field"
            required
          />
        </div>
      </div>
    </>
  );
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = getDb();
  const project = getOwnedProject(db, user.id, Number((await params).id));
  if (!project) notFound();
  const { ok, err } = await searchParams;
  const entries = listAllEntries(db, project.id);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3420";
  const snippet = `<script src="${site}/whatsnew.js" data-slug="${project.slug}" defer></script>`;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <nav aria-label="Fil d'Ariane">
        <Link href="/dashboard" className="font-semibold underline underline-offset-4">
          Mes projets
        </Link>
      </nav>
      <h1 className="display text-3xl" style={{ overflowWrap: "anywhere" }}>
        {project.name}
      </h1>
      {ok ? (
        <p role="status" className="card font-semibold" style={{ color: "var(--ok)" }}>
          {ok}
        </p>
      ) : null}
      {err ? (
        <p role="alert" className="card font-semibold" style={{ color: "var(--danger)" }}>
          {err}
        </p>
      ) : null}

      <section aria-labelledby="share-h" className="card space-y-2">
        <h2 id="share-h" className="display text-xl">
          Partager
        </h2>
        <p className="text-sm">
          Page publique :{" "}
          <Link href={`/c/${project.slug}`} className="mono font-semibold underline">
            /c/{project.slug}
          </Link>
          {" · "}
          <Link href={`/c/${project.slug}/rss.xml`} className="mono font-semibold underline">
            RSS
          </Link>
        </p>
        <p className="text-sm">
          Widget « Nouveautés », à coller avant la fin du body de ton site :
        </p>
        <pre
          className="mono overflow-x-auto border-2 p-3 text-xs"
          style={{ borderColor: "var(--ink)" }}
          tabIndex={0}
        >
          {snippet}
        </pre>
      </section>

      <section aria-labelledby="new-h" className="card">
        <h2 id="new-h" className="display text-xl">
          Nouvelle nouveauté
        </h2>
        <form action={createEntry} className="mt-3 space-y-3">
          <input type="hidden" name="projectId" value={project.id} />
          <EntryFields d={{}} prefix="new" />
          <button className="btn" type="submit">
            Enregistrer
          </button>
        </form>
      </section>

      <section aria-labelledby="list-h" className="space-y-4">
        <h2 id="list-h" className="display text-xl">
          Historique ({entries.length})
        </h2>
        {entries.length === 0 ? <p>Rien de publié pour l&apos;instant.</p> : null}
        <ul className="list-none space-y-4 p-0">
          {entries.map((e) => (
            <li key={e.id} className="card">
              <p className="mono mb-2 text-xs" style={{ color: "var(--muted)" }}>
                {e.status === "draft"
                  ? "Brouillon"
                  : isFuture(e.published_at)
                    ? "Programmée"
                    : "En ligne"}
              </p>
              <form action={saveEntry} className="space-y-3">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="id" value={e.id} />
                <EntryFields
                  d={{
                    title: e.title,
                    body: e.body,
                    tag: e.tag,
                    status: e.status,
                    at: e.published_at,
                  }}
                  prefix={`e${e.id}`}
                />
                <button className="btn" type="submit">
                  Mettre à jour
                </button>
              </form>
              <form action={removeEntry} className="mt-2">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="id" value={e.id} />
                <button
                  className="btn btn-danger"
                  type="submit"
                  aria-label={`Supprimer ${e.title}`}
                >
                  Supprimer
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="set-h" className="card">
        <h2 id="set-h" className="display text-xl">
          Réglages
        </h2>
        <form action={saveSettings} className="mt-3 space-y-3">
          <input type="hidden" name="projectId" value={project.id} />
          <div>
            <label className="label" htmlFor="pname">
              Nom
            </label>
            <input
              id="pname"
              name="name"
              defaultValue={project.name}
              className="field"
              required
              maxLength={60}
            />
          </div>
          <div>
            <label className="label" htmlFor="accent">
              Couleur d&apos;accent
            </label>
            <input
              id="accent"
              name="accent"
              defaultValue={project.accent}
              className="field mono"
              pattern="#[0-9a-fA-F]{6}"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="origins">
              Sites autorisés pour le widget (un par ligne, vide = tous)
            </label>
            <textarea
              id="origins"
              name="origins"
              defaultValue={project.origins}
              className="field mono"
              rows={3}
              placeholder="https://monsite.ma"
            />
          </div>
          <button className="btn" type="submit">
            Enregistrer les réglages
          </button>
        </form>
      </section>
    </main>
  );
}
