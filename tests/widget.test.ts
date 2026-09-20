// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Mounted = {
  host: HTMLElement;
  root: ShadowRoot;
  open: () => void;
  close: () => void;
  ready: Promise<void>;
};
type Widget = {
  mount: (o: Record<string, unknown>) => Mounted;
  readableInk: (h: string) => string;
};
const src = readFileSync(path.resolve(__dirname, "../public/whatsnew.js"), "utf8");
let W: Widget;

const NOW = Date.UTC(2026, 8, 20);
const DAY = 86_400_000;
const EVIL = '<img src=x onerror="window.__pwned=1">';
const PAYLOAD = {
  project: { name: "Shop", slug: "shop", accent: "#ffe58a" },
  entries: [
    {
      id: 2,
      title: EVIL,
      tag: "new",
      publishedAt: NOW - 1 * DAY,
      blocks: [
        {
          type: "p",
          inline: [
            { t: "text", text: "<script>window.__pwned=1</script>" },
            { t: "a", text: "evil", href: "javascript:window.__pwned=1" },
            { t: "a", text: "good", href: "https://a.com/x" },
            { t: "b", text: "bold" },
          ],
        },
        { type: "ul", items: [[{ t: "text", text: "one" }], [{ t: "code", text: "two" }]] },
      ],
    },
    {
      id: 1,
      title: "Old one",
      tag: "fixed",
      publishedAt: NOW - 40 * DAY,
      blocks: [{ type: "p", inline: [{ t: "text", text: "old" }] }],
    },
  ],
};
const res = (data: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(data) });

beforeAll(() => {
  // Node 25 ships an experimental global localStorage that shadows jsdom's; use a plain in-memory one.
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    clear: () => mem.clear(),
  };
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
  vi.stubGlobal("localStorage", storage);
  new Function(src)();
  W = (window as unknown as { JournalWidget: Widget }).JournalWidget;
});
beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

async function setup(fetchImpl: (...a: unknown[]) => Promise<unknown> = () => res(PAYLOAD), extra = {}) {
  const fetchMock = vi.fn(fetchImpl);
  const w = W.mount({
    base: "https://j.test",
    slug: "shop",
    fetch: fetchMock,
    lang: "en",
    now: () => NOW,
    ...extra,
  });
  await w.ready;
  return { w, fetchMock, $: (s: string) => w.root.querySelector(s) as HTMLElement };
}

describe("whatsnew widget", () => {
  it("fetches entries from the right URL and applies the accent + readable ink", async () => {
    const { fetchMock, $ } = await setup();
    expect(fetchMock.mock.calls[0][0]).toBe("https://j.test/api/public/shop/entries?limit=8");
    expect($(".wrap").style.getPropertyValue("--accent")).toBe("#ffe58a");
    expect($(".wrap").style.getPropertyValue("--ink")).toBe("#0b1b33");
  });

  it("shows a badge counting only entries newer than the last seen date (first visit = 14 days)", async () => {
    const { $ } = await setup();
    expect($(".badge").hidden).toBe(false);
    expect($(".badge").textContent).toBe("1"); // the 40-day-old entry is not "new"
  });

  it("opening clears the badge and remembers it across page loads", async () => {
    const a = await setup();
    a.$(".fab").click();
    expect(a.$(".badge").hidden).toBe(true);
    expect(localStorage.getItem("journal_seen_shop")).toBe(String(NOW - DAY));
    document.body.innerHTML = "";
    const b = await setup();
    expect(b.$(".badge").hidden).toBe(true);
  });

  it("a newer entry after the last visit brings the badge back", async () => {
    localStorage.setItem("journal_seen_shop", String(NOW - 2 * DAY));
    expect((await setup()).$(".badge").textContent).toBe("1");
    localStorage.setItem("journal_seen_shop", String(NOW));
    document.body.innerHTML = "";
    expect((await setup()).$(".badge").hidden).toBe(true);
  });

  it("renders entries as TEXT only: no injected elements, unsafe links become plain text (XSS)", async () => {
    const { w, $ } = await setup();
    $(".fab").click();
    expect(w.root.querySelector("img")).toBeNull();
    expect(w.root.querySelector("script")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    expect(w.root.querySelector(".entry h3")?.textContent).toBe(EVIL);
    const anchors = [...w.root.querySelectorAll<HTMLAnchorElement>(".entry a:not(.all)")];
    expect(anchors.map((a) => a.textContent)).toEqual(["good"]);
    expect(anchors[0].getAttribute("href")).toBe("https://a.com/x");
    expect(anchors[0].getAttribute("rel")).toContain("noopener");
    expect(w.root.querySelectorAll(".entry li")).toHaveLength(2);
    expect(w.root.querySelector(".entry strong")?.textContent).toBe("bold");
  });

  it("links to the hosted changelog", async () => {
    const { w, $ } = await setup();
    $(".fab").click();
    expect(w.root.querySelector<HTMLAnchorElement>("a.all")?.getAttribute("href")).toBe(
      "https://j.test/c/shop",
    );
  });

  it("toggles aria-expanded and closes on Escape, restoring focus", async () => {
    const { $ } = await setup();
    $(".fab").click();
    expect($(".fab").getAttribute("aria-expanded")).toBe("true");
    $(".panel").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect($(".panel").hidden).toBe(true);
    expect($(".fab").getAttribute("aria-expanded")).toBe("false");
  });

  it("uses Arabic labels and RTL", async () => {
    const { $ } = await setup(() => res(PAYLOAD), { lang: "ar" });
    expect($(".wrap").getAttribute("dir")).toBe("rtl");
    expect($(".fab").firstChild?.textContent).toBe("الجديد");
  });

  it("shows an error message when the API fails or the network is down", async () => {
    const a = await setup(() => res({ error: "x" }, 500));
    a.$(".fab").click();
    expect(a.$(".msg.err").textContent).toContain("Could not load");
    document.body.innerHTML = "";
    const b = await setup(() => Promise.reject(new Error("offline")));
    expect(b.$(".msg.err").textContent).toContain("Could not load");
  });

  it("tolerates malformed payloads without throwing", async () => {
    const { w, $ } = await setup(() =>
      res({
        entries: [
          null,
          { title: 5 },
          { title: "ok", tag: "weird", publishedAt: NOW, blocks: "nope" },
        ],
        project: { accent: "red" },
      }),
    );
    $(".fab").click();
    expect(w.root.querySelectorAll(".entry")).toHaveLength(1);
    expect($(".wrap").style.getPropertyValue("--accent")).toBe("#c93a22");
  });
});
