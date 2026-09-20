/**
 * A deliberately tiny Markdown subset that outputs a DATA STRUCTURE, never an HTML string.
 * React (dashboard, hosted page) and the embeddable widget (DOM API) both render that structure with
 * text nodes, so user content cannot inject markup. Supported: paragraphs, "## " headings,
 * "- " lists, **bold**, *italic*, `code`, [text](http(s) url).
 */
export type Inline =
  | { t: "text"; text: string }
  | { t: "b" | "i" | "code"; text: string }
  | { t: "a"; text: string; href: string };

export type Block =
  | { type: "p"; inline: Inline[] }
  | { type: "h"; inline: Inline[] }
  | { type: "ul"; items: Inline[][] };

export function safeHref(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

const INLINE_RE = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of src.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ t: "text", text: src.slice(last, idx) });
    if (m[1] !== undefined) out.push({ t: "b", text: m[1] });
    else if (m[2] !== undefined) out.push({ t: "i", text: m[2] });
    else if (m[3] !== undefined) out.push({ t: "code", text: m[3] });
    else {
      const href = safeHref(m[5]);
      // Unsafe URL (javascript:, data:...) degrades to plain text, never a link.
      if (href) out.push({ t: "a", text: m[4], href });
      else out.push({ t: "text", text: m[0] });
    }
    last = idx + m[0].length;
  }
  if (last < src.length) out.push({ t: "text", text: src.slice(last) });
  return out;
}

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: Inline[][] | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", inline: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "ul", items: list });
    list = null;
  };
  for (const raw of md.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (!line) {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: "h", inline: parseInline(heading[1]) });
    } else if (bullet) {
      flushPara();
      (list ??= []).push(parseInline(bullet[1]));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

/** Plain-text version (used for RSS descriptions and previews). */
export function toPlainText(blocks: Block[]): string {
  const inl = (xs: Inline[]) => xs.map((x) => x.text).join("");
  return blocks
    .map((b) => (b.type === "ul" ? b.items.map((i) => `- ${inl(i)}`).join("\n") : inl(b.inline)))
    .join("\n\n");
}
