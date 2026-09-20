export function xmlEscape(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "") // illegal in XML 1.0
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type RssItem = { id: number; title: string; description: string; publishedAt: number };

export function buildRss(feed: { title: string; link: string; description: string }, items: RssItem[]): string {
  const rows = items
    .map(
      (i) => `    <item>
      <title>${xmlEscape(i.title)}</title>
      <link>${xmlEscape(`${feed.link}#e-${i.id}`)}</link>
      <guid isPermaLink="false">${xmlEscape(`${feed.link}#e-${i.id}`)}</guid>
      <pubDate>${new Date(i.publishedAt).toUTCString()}</pubDate>
      <description>${xmlEscape(i.description)}</description>
    </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(feed.title)}</title>
    <link>${xmlEscape(feed.link)}</link>
    <description>${xmlEscape(feed.description)}</description>
${rows}
  </channel>
</rss>
`;
}
