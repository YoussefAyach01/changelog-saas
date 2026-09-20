import type { Block, Inline } from "@/lib/markdown";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((x, i) => {
        switch (x.t) {
          case "b":
            return <strong key={i}>{x.text}</strong>;
          case "i":
            return <em key={i}>{x.text}</em>;
          case "code":
            return (
              <code key={i} className="mono rounded bg-white/70 px-1 text-[0.9em]">
                {x.text}
              </code>
            );
          case "a":
            return (
              <a
                key={i}
                href={x.href}
                rel="noopener noreferrer nofollow"
                className="font-semibold underline underline-offset-2"
              >
                {x.text}
              </a>
            );
          default:
            return <span key={i}>{x.text}</span>;
        }
      })}
    </>
  );
}

/** Renders parsed Markdown blocks. Only text nodes and known elements: no raw HTML path exists. */
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3" style={{ overflowWrap: "anywhere" }}>
      {blocks.map((b, i) =>
        b.type === "h" ? (
          <h3 key={i} className="display text-lg">
            <Inlines items={b.inline} />
          </h3>
        ) : b.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j}>
                <Inlines items={it} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Inlines items={b.inline} />
          </p>
        ),
      )}
    </div>
  );
}

export const TAG_LABEL: Record<string, string> = {
  new: "Nouveau",
  improved: "Amélioré",
  fixed: "Corrigé",
};

export function TagSticker({ tag }: { tag: string }) {
  return <span className={`sticker sticker-${tag}`}>{TAG_LABEL[tag] ?? tag}</span>;
}

const MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/** Tear-off calendar leaf: the signature element of a Journal entry. */
export function Leaf({ at, accent, ink }: { at: number; accent: string; ink: string }) {
  const d = new Date(at);
  return (
    <div className="leaf" aria-hidden="true">
      <div className="leaf-top" style={{ background: accent, color: ink }}>
        {MONTHS[d.getUTCMonth()]} {d.getUTCFullYear()}
      </div>
      <div className="leaf-day">{String(d.getUTCDate()).padStart(2, "0")}</div>
    </div>
  );
}
