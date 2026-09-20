import { beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { addEntry, createProject, createUser, updateProject } from "@/lib/repo";
import { GET, OPTIONS } from "@/app/api/public/[slug]/entries/route";
import { GET as rssGET } from "@/app/c/[slug]/rss.xml/route";

type G = { __db?: ReturnType<typeof openDb> };
let uid: number;
let pid: number;

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const get = (slug: string, qs = "", headers: Record<string, string> = {}) =>
  GET(new Request(`http://x/api/public/${slug}/entries${qs}`, { headers }), ctx(slug));

beforeEach(() => {
  const g = globalThis as unknown as G;
  g.__db = openDb(":memory:");
  uid = createUser(g.__db, "o@x.ma", "h");
  pid = createProject(g.__db, uid, "shop", "Shop <b>&</b>");
  addEntry(g.__db, pid, {
    title: "Hello <script>",
    body: "**bold** [x](javascript:alert(1)) [ok](https://a.com)",
    tag: "new",
    status: "published",
    publishedAt: 1000,
  });
  addEntry(g.__db, pid, {
    title: "Secret draft",
    body: "",
    tag: "new",
    status: "draft",
    publishedAt: 2000,
  });
});

describe("public entries API", () => {
  it("404s for unknown projects", async () => {
    expect((await get("nope")).status).toBe(404);
  });

  it("returns only published entries with Markdown parsed to data blocks", async () => {
    const res = await get("shop", "", { origin: "https://any.com" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].title).toBe("Hello <script>");
    const inline = body.entries[0].blocks[0].inline;
    expect(inline.find((x: { t: string }) => x.t === "b").text).toBe("bold");
    const anchors = inline.filter((x: { t: string }) => x.t === "a");
    expect(anchors).toEqual([{ t: "a", text: "ok", href: "https://a.com/" }]); // javascript: link is not an anchor
    expect(JSON.stringify(body)).not.toContain("Secret draft");
    expect(body.project.accent).toBe("#c93a22");
  });

  it("clamps the limit parameter", async () => {
    const g = globalThis as unknown as G;
    for (let i = 0; i < 60; i++)
      addEntry(g.__db!, pid, {
        title: `e${i}`,
        body: "",
        tag: "fixed",
        status: "published",
        publishedAt: 100 + i,
      });
    expect((await (await get("shop", "?limit=1000")).json()).entries).toHaveLength(50);
    expect((await (await get("shop", "?limit=3")).json()).entries).toHaveLength(3);
    expect((await (await get("shop", "?limit=abc")).json()).entries).toHaveLength(10);
  });

  it("enforces the origin allow-list", async () => {
    const g = globalThis as unknown as G;
    updateProject(g.__db!, uid, pid, {
      name: "Shop",
      accent: "#c93a22",
      origins: "https://shop.ma",
    });
    expect((await get("shop", "", { origin: "https://evil.com" })).status).toBe(403);
    expect((await get("shop")).status).toBe(403);
    const ok = await get("shop", "", { origin: "https://shop.ma" });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://shop.ma");
    const pre = await OPTIONS(
      new Request("http://x", { method: "OPTIONS", headers: { origin: "https://shop.ma" } }),
      ctx("shop"),
    );
    expect(pre.status).toBe(204);
    const preBad = await OPTIONS(
      new Request("http://x", { method: "OPTIONS", headers: { origin: "https://evil.com" } }),
      ctx("shop"),
    );
    expect(preBad.status).toBe(403);
  });
});

describe("RSS route", () => {
  it("serves an escaped feed of published entries only", async () => {
    const res = await rssGET(new Request("http://x/c/shop/rss.xml"), ctx("shop"));
    const xml = await res.text();
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    expect(xml).toContain("<title>Hello &lt;script&gt;</title>");
    expect(xml).toContain("Shop &lt;b&gt;&amp;&lt;/b&gt;");
    expect(xml).not.toContain("Secret draft");
    expect((await rssGET(new Request("http://x"), ctx("nope"))).status).toBe(404);
  });
});
