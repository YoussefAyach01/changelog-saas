/*
 * Journal "What's new" widget. One <script>, no dependencies.
 *   <script src="https://YOUR-HOST/whatsnew.js" data-slug="my-product" defer></script>
 * Optional: data-lang="fr|en|ar", data-position="right|left", data-label="What's new".
 *
 * Security: the API returns parsed Markdown as DATA (blocks/inlines). Everything is inserted with textContent
 * on elements created here; link hrefs are re-checked for http(s). innerHTML is never used with data.
 * The UI is in a Shadow DOM, so host CSS cannot break it and it cannot leak styles into the host.
 */
(function () {
  "use strict";

  var T = {
    en: {
      label: "What's new",
      title: "What's new",
      close: "Close",
      all: "See all updates",
      empty: "No updates yet.",
      err: "Could not load updates.",
      loading: "Loading...",
      unread: "new",
      new: "New",
      improved: "Improved",
      fixed: "Fixed",
    },
    fr: {
      label: "Nouveautés",
      title: "Nouveautés",
      close: "Fermer",
      all: "Voir toutes les nouveautés",
      empty: "Aucune nouveauté pour l'instant.",
      err: "Impossible de charger les nouveautés.",
      loading: "Chargement...",
      unread: "nouvelles",
      new: "Nouveau",
      improved: "Amélioré",
      fixed: "Corrigé",
    },
    ar: {
      label: "الجديد",
      title: "الجديد",
      close: "إغلاق",
      all: "عرض كل التحديثات",
      empty: "لا توجد تحديثات بعد.",
      err: "تعذر تحميل التحديثات.",
      loading: "جارٍ التحميل...",
      unread: "جديد",
      new: "جديد",
      improved: "تحسين",
      fixed: "إصلاح",
    },
  };

  var CSS =
    ":host{all:initial}*{box-sizing:border-box}" +
    ".wrap{position:fixed;bottom:16px;z-index:2147483000;font:16px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;color:#0b1b33}" +
    ".wrap.right{right:16px}.wrap.left{left:16px}" +
    "button{font:inherit;color:inherit}" +
    ".fab{position:relative;min-height:48px;min-width:48px;padding:0 18px;border:2px solid #0b1b33;border-radius:8px;background:var(--accent);color:var(--ink);font-weight:700;cursor:pointer;box-shadow:3px 3px 0 #0b1b33}" +
    ".badge{position:absolute;top:-10px;inset-inline-end:-10px;min-width:24px;height:24px;padding:0 6px;border:2px solid #0b1b33;border-radius:999px;background:#ffe58a;color:#0b1b33;font-size:13px;font-weight:700;line-height:20px;text-align:center}" +
    ".badge[hidden]{display:none}" +
    ".panel{position:absolute;bottom:62px;width:min(380px,calc(100vw - 32px));max-height:min(560px,calc(100vh - 100px));overflow:auto;background:#fff;border:2px solid #0b1b33;box-shadow:5px 5px 0 #0b1b33;border-radius:8px;padding:14px}" +
    ".right .panel{right:0}.left .panel{left:0}.panel[hidden]{display:none}" +
    ".head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.head h2{margin:0;font-size:18px}" +
    ".x{min-height:44px;min-width:44px;border:0;background:none;font-size:20px;cursor:pointer}" +
    ".entry{padding:12px 0;border-top:1px solid #c5d0df}" +
    ".meta{display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px;color:#45546b}" +
    ".tag{padding:0 8px;border:2px solid #0b1b33;border-radius:4px;color:#0b1b33;font-weight:600;text-transform:uppercase;letter-spacing:.03em}" +
    ".tag-new{background:#b8f0d0}.tag-improved{background:#bfd9ff}.tag-fixed{background:#ffe58a}" +
    ".entry h3{margin:0 0 4px;font-size:16px;overflow-wrap:anywhere}" +
    ".entry p,.entry ul{margin:4px 0;font-size:14px;overflow-wrap:anywhere}.entry ul{padding-inline-start:20px}" +
    ".entry h4{margin:6px 0 2px;font-size:14px}" +
    "code{font-family:ui-monospace,monospace;background:#eaf4ff;padding:0 4px;border-radius:3px}" +
    "a{color:#0b1b33;font-weight:600}" +
    ".all{display:inline-flex;align-items:center;min-height:44px;margin-top:6px}" +
    ".msg{margin:8px 0;font-size:14px}.err{color:#a3210b;font-weight:600}" +
    ":focus-visible{outline:3px solid #c93a22;outline-offset:2px}";

  function readableInk(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "#ffffff";
    var c = [0, 2, 4].map(function (i) {
      var v = parseInt(m[1].slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return 1.05 / (L + 0.05) >= (L + 0.05) / 0.06 ? "#ffffff" : "#0b1b33";
  }

  function safeHref(raw) {
    try {
      var u = new URL(String(raw));
      return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
    } catch {
      return null;
    }
  }

  function el(doc, tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    return e;
  }

  function renderInline(doc, parent, items) {
    (Array.isArray(items) ? items : []).forEach(function (x) {
      var text = x && typeof x.text === "string" ? x.text : "";
      var node;
      if (x && x.t === "b") node = el(doc, "strong", "", text);
      else if (x && x.t === "i") node = el(doc, "em", "", text);
      else if (x && x.t === "code") node = el(doc, "code", "", text);
      else if (x && x.t === "a" && safeHref(x.href)) {
        node = el(doc, "a", "", text);
        node.setAttribute("href", safeHref(x.href));
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer nofollow");
      } else node = doc.createTextNode(text);
      parent.appendChild(node);
    });
  }

  function renderBlocks(doc, parent, blocks) {
    (Array.isArray(blocks) ? blocks : []).forEach(function (b) {
      if (!b) return;
      if (b.type === "ul") {
        var ul = doc.createElement("ul");
        (b.items || []).forEach(function (it) {
          var li = doc.createElement("li");
          renderInline(doc, li, it);
          ul.appendChild(li);
        });
        parent.appendChild(ul);
      } else {
        var n = doc.createElement(b.type === "h" ? "h4" : "p");
        renderInline(doc, n, b.inline);
        parent.appendChild(n);
      }
    });
  }

  function mount(opts) {
    var win = opts.window || window;
    var doc = win.document;
    var base = String(opts.base).replace(/\/$/, "");
    var lang = T[opts.lang] ? opts.lang : "en";
    var t = T[lang];
    var doFetch = opts.fetch || win.fetch.bind(win);
    var now = opts.now || Date.now;
    var storeKey = "journal_seen_" + opts.slug;

    function getSeen() {
      try {
        var v = Number(win.localStorage.getItem(storeKey));
        if (v > 0) return v;
      } catch {
        /* storage blocked */
      }
      return now() - 14 * 86400000; // first visit: only the last two weeks count as new
    }
    function setSeen(v) {
      try {
        win.localStorage.setItem(storeKey, String(v));
      } catch {
        /* storage blocked */
      }
    }

    var host = doc.createElement("div");
    host.setAttribute("data-journal", "");
    var root = host.attachShadow({ mode: "open" });
    var style = doc.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);

    var wrap = el(doc, "div", "wrap " + (opts.position === "left" ? "left" : "right"));
    wrap.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    wrap.style.setProperty("--accent", "#c93a22");
    wrap.style.setProperty("--ink", "#ffffff");

    var fab = el(doc, "button", "fab", opts.label || t.label);
    fab.type = "button";
    fab.setAttribute("aria-haspopup", "dialog");
    fab.setAttribute("aria-expanded", "false");
    var badge = el(doc, "span", "badge");
    badge.hidden = true;
    fab.appendChild(badge);

    var panel = el(doc, "div", "panel");
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", t.title);
    var head = el(doc, "div", "head");
    var closeBtn = el(doc, "button", "x", "×");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", t.close);
    head.append(el(doc, "h2", "", t.title), closeBtn);
    var list = el(doc, "div", "list");
    list.appendChild(el(doc, "p", "msg", t.loading));
    panel.append(head, list);
    wrap.append(panel, fab);
    root.appendChild(wrap);

    var entries = [];
    var loaded = false;

    function unreadCount() {
      var seen = getSeen();
      return entries.filter(function (e) {
        return e.publishedAt > seen;
      }).length;
    }
    function refreshBadge() {
      var n = unreadCount();
      badge.hidden = n === 0;
      badge.textContent = String(n);
      fab.setAttribute(
        "aria-label",
        (opts.label || t.label) + (n ? " (" + n + " " + t.unread + ")" : ""),
      );
    }

    function render() {
      list.textContent = "";
      if (!entries.length) {
        list.appendChild(el(doc, "p", "msg", t.empty));
        return;
      }
      var fmt;
      try {
        fmt = new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeZone: "UTC" });
      } catch {
        fmt = null;
      }
      entries.forEach(function (e) {
        var art = el(doc, "article", "entry");
        var meta = el(doc, "div", "meta");
        var tag = /^(new|improved|fixed)$/.test(e.tag) ? e.tag : "new";
        meta.appendChild(el(doc, "span", "tag tag-" + tag, t[tag]));
        meta.appendChild(
          el(
            doc,
            "time",
            "",
            fmt
              ? fmt.format(new Date(e.publishedAt))
              : new Date(e.publishedAt).toISOString().slice(0, 10),
          ),
        );
        art.append(meta, el(doc, "h3", "", e.title));
        renderBlocks(doc, art, e.blocks);
        list.appendChild(art);
      });
      var all = el(doc, "a", "all", t.all);
      all.setAttribute("href", base + "/c/" + encodeURIComponent(opts.slug));
      all.setAttribute("target", "_blank");
      all.setAttribute("rel", "noopener");
      list.appendChild(all);
    }

    function open() {
      panel.hidden = false;
      fab.setAttribute("aria-expanded", "true");
      closeBtn.focus();
      if (entries.length)
        setSeen(
          Math.max.apply(
            null,
            entries.map(function (e) {
              return e.publishedAt;
            }),
          ),
        );
      else if (loaded) setSeen(now());
      badge.hidden = true;
    }
    function close() {
      panel.hidden = true;
      fab.setAttribute("aria-expanded", "false");
      fab.focus();
      refreshBadge();
    }
    fab.addEventListener("click", function () {
      if (panel.hidden) open();
      else close();
    });
    closeBtn.addEventListener("click", close);
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    (doc.body || doc.documentElement).appendChild(host);

    var ready = doFetch(base + "/api/public/" + encodeURIComponent(opts.slug) + "/entries?limit=8")
      .then(function (r) {
        return r.json().then(
          function (d) {
            return { ok: r.ok, data: d };
          },
          function () {
            return { ok: false, data: {} };
          },
        );
      })
      .then(
        function (r) {
          if (!r.ok) {
            list.textContent = "";
            list.appendChild(el(doc, "p", "msg err", t.err));
            return;
          }
          loaded = true;
          entries = Array.isArray(r.data.entries)
            ? r.data.entries.filter(function (e) {
                return e && typeof e.title === "string" && typeof e.publishedAt === "number";
              })
            : [];
          var accent =
            r.data.project && /^#[0-9a-f]{6}$/i.test(r.data.project.accent)
              ? r.data.project.accent
              : "#c93a22";
          wrap.style.setProperty("--accent", accent);
          wrap.style.setProperty("--ink", readableInk(accent));
          render();
          refreshBadge();
        },
        function () {
          list.textContent = "";
          list.appendChild(el(doc, "p", "msg err", t.err));
        },
      );

    return { host: host, root: root, open: open, close: close, ready: ready };
  }

  window.JournalWidget = { mount: mount, readableInk: readableInk };

  var s = document.currentScript;
  if (s && s.getAttribute("data-slug") && s.src) {
    var go = function () {
      mount({
        base: new URL(s.src).origin,
        slug: s.getAttribute("data-slug"),
        lang: s.getAttribute("data-lang") || (document.documentElement.lang || "en").slice(0, 2),
        position: s.getAttribute("data-position") || "right",
        label: s.getAttribute("data-label") || "",
      });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
    else go();
  }
})();
