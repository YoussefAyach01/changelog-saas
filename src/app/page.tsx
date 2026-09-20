import Link from "next/link";
import { Blocks, Leaf, TagSticker } from "@/components/blocks";
import { parseMarkdown } from "@/lib/markdown";

const SAMPLE = [
  {
    at: Date.UTC(2026, 8, 18),
    tag: "new",
    title: "Export PDF des factures",
    body: "Un clic pour exporter **toutes** tes factures du mois.",
  },
  {
    at: Date.UTC(2026, 8, 9),
    tag: "improved",
    title: "Recherche plus rapide",
    body: "- Résultats en moins de 100 ms\n- Les accents ne comptent plus",
  },
];

export default function Home() {
  return (
    <div>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <span className="display text-xl">Journal</span>
        <nav aria-label="Compte" className="flex items-center gap-3 text-sm font-semibold">
          <Link
            href="/login"
            className="flex min-h-11 items-center px-2 underline underline-offset-4"
          >
            Connexion
          </Link>
          <Link href="/signup" className="btn">
            Créer mon compte
          </Link>
        </nav>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-4 pb-16 pt-6 md:grid-cols-2 md:items-start">
        <section>
          <h1
            className="display text-[2.4rem] leading-[1.05] sm:text-[3.4rem]"
            style={{ textWrap: "balance" }}
          >
            Dis à tes clients ce qui <span style={{ color: "var(--tomato)" }}>a changé.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg" style={{ color: "var(--muted)" }}>
            Écris une nouveauté en Markdown, publie-la. Tu obtiens une page publique, un flux RSS et
            un widget « Nouveautés » avec pastille pour ton application.
          </p>
          <pre className="mono card mt-6 overflow-x-auto text-xs" tabIndex={0}>
            {`<script src="https://journal.app/whatsnew.js"\n  data-slug="mon-produit" defer></script>`}
          </pre>
          <Link href="/signup" className="btn mt-6 !min-h-12 !px-6 text-lg">
            Commencer gratuitement
          </Link>
          <p className="mono mt-3 text-xs" style={{ color: "var(--muted)" }}>
            1 projet gratuit · Pro 59 MAD/mois
          </p>
        </section>

        <section aria-label="Exemple de changelog" className="space-y-5">
          {SAMPLE.map((e) => (
            <article key={e.title} className="flex gap-4">
              <Leaf at={e.at} accent="#c93a22" ink="#ffffff" />
              <div className="card flex-1">
                <TagSticker tag={e.tag} />
                <h2 className="display mt-2 text-lg">{e.title}</h2>
                <div className="mt-2">
                  <Blocks blocks={parseMarkdown(e.body)} />
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
