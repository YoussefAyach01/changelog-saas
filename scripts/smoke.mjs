// End-to-end smoke test against a RUNNING server: `npm run build && npm start`, then `npm run smoke`.
// BASE defaults to http://localhost:3420. Uses a fresh random account each run.
const BASE = process.env.BASE ?? "http://localhost:3420";
const jar = new Map();
let failures = 0;

function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + extra}`);
  if (!cond) failures++;
}

async function req(path, opts = {}) {
  const headers = { ...(opts.headers ?? {}) };
  if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(BASE + path, { redirect: "manual", ...opts, headers });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    const v = pair.slice(i + 1);
    if (v) jar.set(pair.slice(0, i), v);
    else jar.delete(pair.slice(0, i));
  }
  return res;
}

// Next server actions need the action id, so we drive them through the real HTML forms.
async function actionIdFor(path, formMatch) {
  const html = await (await req(path)).text();
  const forms = [...html.matchAll(/<form[^>]*>[\s\S]*?<\/form>/g)].map((m) => m[0]);
  const form = forms.find((f) => formMatch.test(f));
  return { html, form };
}

async function submit(path, formMatch, fields) {
  const { form } = await actionIdFor(path, formMatch);
  if (!form) throw new Error(`form not found on ${path}`);
  const fd = new FormData();
  // Next encodes the action as hidden inputs named $ACTION_ID_<id> (progressive enhancement).
  for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = /name="([^"]+)"/.exec(m[0])?.[1];
    const value = /value="([^"]*)"/.exec(m[0])?.[1] ?? "";
    if (name) fd.append(name, value.replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return req(path, { method: "POST", body: fd });
}

const rnd = Math.random().toString(36).slice(2, 8);
const email = `smoke-${rnd}@example.com`;
const slug = `smoke-${rnd}`;

check("home 200", (await req("/")).status === 200);
check("health ok", (await (await req("/api/health")).json()).ok === true);
check("whatsnew.js served as javascript", /javascript/.test((await req("/whatsnew.js")).headers.get("content-type") ?? ""));
check("dashboard redirects when logged out", (await req("/dashboard")).status >= 300);
check("unknown changelog 404", (await req("/c/nobody-here")).status === 404);

let r = await submit("/signup", /name="email"/, { email, password: "supersecret1" });
check("signup redirects", r.status >= 300 && r.status < 400, String(r.status));

r = await submit("/dashboard", /name="slug"/, { name: "Smoke <shop>", slug });
const pid = /\/dashboard\/(\d+)/.exec(r.headers.get("location") ?? "")?.[1];
check("project created", !!pid, r.headers.get("location") ?? "");

const today = new Date().toISOString().slice(0, 10);
const addForm = /name="day"[\s\S]*Enregistrer/;
r = await submit(`/dashboard/${pid}`, addForm, { title: "Export <b>PDF</b>", body: "Now **faster**.\n\n- one\n- [bad](javascript:alert(1))", tag: "new", status: "published", day: today });
check("published entry ok", (r.headers.get("location") ?? "").includes("ok="), r.headers.get("location") ?? "");
r = await submit(`/dashboard/${pid}`, addForm, { title: "Secret draft", body: "", tag: "fixed", status: "draft", day: today });
check("draft saved", (r.headers.get("location") ?? "").includes("ok="));
r = await submit(`/dashboard/${pid}`, addForm, { title: "Later", body: "", tag: "fixed", status: "published", day: "2999-01-01" });
check("scheduled entry saved", (r.headers.get("location") ?? "").includes("ok="));
r = await submit(`/dashboard/${pid}`, addForm, { title: "Bad date", body: "", tag: "new", status: "published", day: "2026-02-31" });
check("impossible date rejected", (r.headers.get("location") ?? "").includes("err="), r.headers.get("location") ?? "");

jar.clear(); // everything below is what an anonymous visitor / another website sees
const page = await (await req(`/c/${slug}`)).text();
check("hosted page shows the published entry, escaped", page.includes("Export &lt;b&gt;PDF&lt;/b&gt;") && !page.includes("<b>PDF</b>"));
check("hosted page hides draft and scheduled entries", !page.includes("Secret draft") && !page.includes("Later"));
check("unsafe markdown link is not rendered as a link", !/href="javascript:/i.test(page));
check("hosted page has bold rendered as an element", page.includes("<strong>faster</strong>"));

const rss = await req(`/c/${slug}/rss.xml`);
const xml = await rss.text();
check("rss is xml with the entry", /xml/.test(rss.headers.get("content-type") ?? "") && xml.includes("<title>Export &lt;b&gt;PDF&lt;/b&gt;</title>") && !xml.includes("Secret draft"));

const pre = await req(`/api/public/${slug}/entries`, { method: "OPTIONS", headers: { origin: "https://customer.example" } });
check("preflight 204 with CORS", pre.status === 204 && !!pre.headers.get("access-control-allow-origin"), String(pre.status));
const api = await req(`/api/public/${slug}/entries`, { headers: { origin: "https://customer.example" } });
const data = await api.json();
check("API returns published entry only, as data", data.entries?.length === 1 && data.entries[0].title === "Export <b>PDF</b>" && Array.isArray(data.entries[0].blocks), JSON.stringify(data).slice(0, 200));
check("API has CORS header", api.headers.get("access-control-allow-origin") === "*");
check("API unknown slug 404", (await req(`/api/public/nope-nope/entries`)).status === 404);

console.log(failures ? `\n${failures} FAILED` : "\nall smoke checks passed");
process.exit(failures ? 1 : 0);
