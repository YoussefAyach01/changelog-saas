import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "@/lib/db";
import { parseInline, parseMarkdown, safeHref, toPlainText } from "@/lib/markdown";
import { buildRss, xmlEscape } from "@/lib/rss";
import { contrast, readableInk } from "@/lib/color";
import { entrySchema, parseDay, projectSchema, slugSchema } from "@/lib/validation";
import {
  ConflictError,
  addEntry,
  createProject,
  createUser,
  deleteEntry,
  getOwnedProject,
  listAllEntries,
  listPublicEntries,
  updateEntry,
  updateProject,
} from "@/lib/repo";

describe("markdown", () => {
  it("parses paragraphs, headings, lists and inline styles", () => {
    const blocks = parseMarkdown(
      "## Title\n\nHello **bold** and *it* and `code`.\nSame paragraph.\n\n- one\n- two",
    );
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: "h", inline: [{ t: "text", text: "Title" }] });
    expect(blocks[1].type).toBe("p");
    expect(toPlainText(blocks)).toBe(
      "Title\n\nHello bold and it and code. Same paragraph.\n\n- one\n- two",
    );
    expect(blocks[2]).toMatchObject({ type: "ul" });
  });

  it("only turns http(s) links into anchors", () => {
    expect(parseInline("[ok](https://a.com/x)")).toEqual([
      { t: "a", text: "ok", href: "https://a.com/x" },
    ]);
    for (const bad of [
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "data:text/html,x",
      "vbscript:x",
      "//evil.com",
    ]) {
      const r = parseInline(`[click](${bad})`);
      expect(r.some((x) => x.t === "a")).toBe(false);
      expect(safeHref(bad)).toBeNull();
    }
  });

  it("keeps raw HTML as literal text (no HTML path exists)", () => {
    const blocks = parseMarkdown("<img src=x onerror=alert(1)> <script>alert(2)</script>");
    expect(blocks).toEqual([
      {
        type: "p",
        inline: [{ t: "text", text: "<img src=x onerror=alert(1)> <script>alert(2)</script>" }],
      },
    ]);
  });

  it("handles empty input, CRLF and unbalanced markers", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("a\r\n\r\nb")).toHaveLength(2);
    expect(toPlainText(parseMarkdown("2 * 3 = 6 and **unclosed"))).toBe("2 * 3 = 6 and **unclosed");
  });

  it("handles unicode and Arabic", () => {
    expect(toPlainText(parseMarkdown("**جديد** ✨ إضافة"))).toBe("جديد ✨ إضافة");
  });
});

describe("rss", () => {
  it("escapes XML specials and strips illegal control chars", () => {
    expect(xmlEscape(`<a href="x">&'</a>\u0001`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;",
    );
  });
  it("builds a feed with items, stable guids and RFC 822 dates", () => {
    const xml = buildRss({ title: "Shop & Co", link: "https://j.app/c/shop", description: "d" }, [
      { id: 7, title: "<b>x</b>", description: "desc", publishedAt: Date.UTC(2026, 8, 20) },
    ]);
    expect(xml).toContain("<title>Shop &amp; Co</title>");
    expect(xml).toContain("<title>&lt;b&gt;x&lt;/b&gt;</title>");
    expect(xml).toContain('<guid isPermaLink="false">https://j.app/c/shop#e-7</guid>');
    expect(xml).toContain("<pubDate>Sun, 20 Sep 2026 00:00:00 GMT</pubDate>");
    expect(xml).not.toContain("<b>x</b>");
  });
});

describe("color", () => {
  it("picks readable ink", () => {
    expect(readableInk("#c93a22")).toBe("#ffffff");
    expect(readableInk("#ffe58a")).toBe("#0b1b33");
    expect(readableInk("nope")).toBe("#ffffff");
    for (const c of ["#c93a22", "#ffe58a", "#000000", "#ffffff", "#5b3df5", "#7f7f7f"]) {
      expect(contrast(c, readableInk(c))).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("validation", () => {
  it("parses real dates only", () => {
    expect(parseDay("2026-09-20")).toBe(Date.UTC(2026, 8, 20));
    for (const bad of ["2026-02-31", "2026-13-01", "20-09-2026", "", "2026-9-2"])
      expect(parseDay(bad)).toBeNull();
  });
  it("validates slugs", () => {
    expect(slugSchema.parse(" My-Product ")).toBe("my-product");
    for (const bad of ["ab", "-abc", "a_b_c", "api", "c", "a b c", "x".repeat(41)])
      expect(slugSchema.safeParse(bad).success).toBe(false);
    expect(projectSchema.safeParse({ name: "", slug: "abc" }).success).toBe(false);
  });
  it("validates entries", () => {
    const ok = entrySchema.safeParse({
      title: "T",
      body: "b",
      tag: "new",
      status: "published",
      day: "2026-09-20",
    });
    expect(ok.success && ok.data.day).toBe(Date.UTC(2026, 8, 20));
    expect(
      entrySchema.safeParse({
        title: "T",
        body: "",
        tag: "wow",
        status: "published",
        day: "2026-09-20",
      }).success,
    ).toBe(false);
    expect(
      entrySchema.safeParse({ title: "T", body: "", tag: "new", status: "published", day: "nope" })
        .success,
    ).toBe(false);
    expect(
      entrySchema.safeParse({
        title: " ",
        body: "",
        tag: "new",
        status: "draft",
        day: "2026-09-20",
      }).success,
    ).toBe(false);
  });
});

let db: DatabaseSync;
let a: { uid: number; pid: number };
let b: { uid: number; pid: number };
const mk = (email: string, slug: string) => {
  const uid = createUser(db, email, "h");
  return { uid, pid: createProject(db, uid, slug, "P") };
};
const E = (o: Partial<{ title: string; status: string; publishedAt: number }> = {}) => ({
  title: "t",
  body: "b",
  tag: "new",
  status: "published",
  publishedAt: 1000,
  ...o,
});

beforeEach(() => {
  db = openDb(":memory:");
  a = mk("a@x.ma", "alpha");
  b = mk("b@x.ma", "beta");
});

describe("repo", () => {
  it("rejects duplicate slugs and emails", () => {
    expect(() => createProject(db, a.uid, "alpha", "dup")).toThrow(ConflictError);
    expect(() => createUser(db, "a@x.ma", "h")).toThrow(ConflictError);
  });
  it("scopes everything to the owner (IDOR)", () => {
    const id = addEntry(db, a.pid, E());
    expect(getOwnedProject(db, b.uid, a.pid)).toBeUndefined();
    expect(updateProject(db, b.uid, a.pid, { name: "hax", accent: "#000000", origins: "" })).toBe(
      false,
    );
    expect(
      updateEntry(db, b.pid, id, {
        title: "hax",
        body: "",
        tag: "new",
        status: "published",
        publishedAt: 1,
      }),
    ).toBe(false);
    expect(deleteEntry(db, b.pid, id)).toBe(false);
    expect(listAllEntries(db, a.pid)[0].title).toBe("t");
    expect(deleteEntry(db, a.pid, id)).toBe(true);
  });
  it("public list hides drafts and scheduled entries, and sorts newest first", () => {
    addEntry(db, a.pid, E({ title: "old", publishedAt: 1000 }));
    addEntry(db, a.pid, E({ title: "new", publishedAt: 2000 }));
    addEntry(db, a.pid, E({ title: "draft", status: "draft", publishedAt: 1500 }));
    addEntry(db, a.pid, E({ title: "future", publishedAt: 9000 }));
    expect(listPublicEntries(db, a.pid, 50, 5000).map((e) => e.title)).toEqual(["new", "old"]);
    expect(listPublicEntries(db, a.pid, 50, 10_000).map((e) => e.title)).toEqual([
      "future",
      "new",
      "old",
    ]);
    expect(listPublicEntries(db, a.pid, 1, 10_000)).toHaveLength(1);
    expect(listAllEntries(db, a.pid)).toHaveLength(4);
    expect(listPublicEntries(db, b.pid, 50, 10_000)).toHaveLength(0);
  });
});
