/* Projects panel — master/detail repo list with live README. */

import { h, clear } from "../dom";
import { tag, btnLink, openExternal, panelHead } from "../components";
import { tt, fetchRepos, fetchReadme, type Lang, type Project } from "../data";

type SortId = "recent" | "name" | "stars";

function sanitizeReadme(html: string): DocumentFragment {
  const cleaned = html
    .replace(/\sstyle\s*=\s*"[^"]*"/gi, "")
    .replace(/\sstyle\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z-]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z-]+\s*=\s*'[^']*'/gi, "");
  const tpl = document.createElement("template");
  tpl.innerHTML = cleaned;
  const frag = tpl.content;
  frag
    .querySelectorAll("script, style, link, iframe, object, embed, meta, base, form")
    .forEach((el) => el.remove());
  // Defensive second pass for anything the string sweep missed.
  frag.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name === "style" || name.startsWith("on")) el.removeAttribute(attr.name);
    }
  });
  return frag;
}

export function buildProjects(lang: Lang): HTMLElement {
  const t = (k: string) => tt(lang, k);
  const SORTS: { id: SortId; label: string }[] = [
    { id: "recent", label: t("sortRecent") },
    { id: "name", label: t("sortName") },
    { id: "stars", label: t("sortStars") },
  ];

  let repos: Project[] = [];
  let live = false;
  let loading = true;
  let q = "";
  let sortI = 0;
  let sel: Project | null = null;

  const srcLabel = document.createTextNode(" …");
  const src = h("span", { class: "vp__src" }, h("span", { class: "vp__dot" }), srcLabel);

  const input = h("input", {
    class: "vire-input",
    type: "text",
    placeholder: t("filter"),
    "aria-label": t("filter"),
    onInput: (e: Event) => {
      q = (e.target as HTMLInputElement).value;
      renderList();
    },
  });
  const sortLabel = document.createTextNode(SORTS[sortI].label);
  const sortBtn = h(
    "button",
    {
      class: "vp__sortbtn",
      type: "button",
      title: "order",
      onClick: () => {
        sortI = (sortI + 1) % SORTS.length;
        sortLabel.textContent = SORTS[sortI].label;
        renderList();
      },
    },
    h("span", { class: "vp__sortglyph" }, "⇅"),
    sortLabel,
  );

  const scroll = h("div", { class: "vp__scroll" });
  const list = h(
    "aside",
    { class: "vp__list" },
    h("div", { class: "vp__filter" }, input, sortBtn),
    scroll,
  );
  const detail = h("section", { class: "vp__detail" });
  const root = h(
    "div",
    { class: "vp" },
    panelHead(t("selectedWork"), t("projects"), src),
    h("div", { class: "vp__split" }, list, detail),
  );

  function sortedRows(): Project[] {
    const query = q.toLowerCase();
    const filtered = repos.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.description || "").toLowerCase().includes(query),
    );
    const sort = SORTS[sortI].id;
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "stars") return (b.stars || 0) - (a.stars || 0);
      return (b.year || "").localeCompare(a.year || "");
    });
  }

  function iconBtn(glyph: string, title: string, href: string): HTMLElement {
    return h(
      "button",
      {
        class: "vp__iconbtn",
        type: "button",
        title,
        onClick: (e: Event) => {
          e.stopPropagation();
          openExternal(href);
        },
      },
      glyph,
    );
  }

  function renderList(): void {
    clear(scroll);
    if (loading) {
      scroll.appendChild(h("div", { class: "vp__muted" }, t("loadingRepos")));
      return;
    }
    const rows = sortedRows();
    if (!rows.length) {
      scroll.appendChild(h("div", { class: "vp__muted" }, `${t("noMatch")} “${q}”.`));
      return;
    }
    for (const p of rows) {
      const isSel = sel !== null && sel.name === p.name;
      const icons = h("span", { class: "vp__rowicons" }, iconBtn("</>", t("openRepo"), p.url));
      if (p.homepage) icons.appendChild(iconBtn("↗", t("openSite"), p.homepage));

      const meta = h("span", { class: "vp__rowmeta" });
      if (p.language) meta.appendChild(h("em", {}, p.language));
      if (p.year) meta.appendChild(h("span", {}, p.year));
      if (p.stars > 0) meta.appendChild(h("span", {}, `★ ${p.stars}`));

      scroll.appendChild(
        h(
          "button",
          { class: "vp__row" + (isSel ? " is-sel" : ""), type: "button", onClick: () => select(p) },
          h("div", { class: "vp__rowtop" }, h("span", { class: "vp__rowname" }, p.name), icons),
          meta,
        ),
      );
    }
  }

  function renderDetail(): void {
    clear(detail);
    if (!sel) return;
    const s = sel;
    const metaWrap = h("div", { class: "vp__repoMeta" });
    if (s.language) metaWrap.appendChild(tag(s.language));
    if (s.stars > 0) metaWrap.appendChild(tag(`★ ${s.stars}`));
    for (const tp of (s.topics || []).slice(0, 4)) metaWrap.appendChild(tag(tp));

    const actions = h("div", { class: "vp__repoActions" }, btnLink(t("openGithub"), s.url, true));
    if (s.homepage) actions.appendChild(btnLink(t("openSite"), s.homepage));

    const readmeBox = h("div", { class: "vp__readme" }, h("div", { class: "vp__muted" }, t("fetchReadme")));

    detail.appendChild(
      h(
        "div",
        { class: "vp__detailInner" },
        h(
          "div",
          { class: "vp__detailHead" },
          h("h3", { class: "vp__repoName" }, s.name),
          metaWrap,
          h("p", { class: "vp__repoDesc" }, s.description),
          actions,
        ),
        readmeBox,
      ),
    );

    void fetchReadme(s.name).then((html) => {
      if (sel !== s) return; // selection changed while fetching
      clear(readmeBox);
      if (html) {
        const prose = h("div", { class: "prose" });
        prose.appendChild(sanitizeReadme(html));
        readmeBox.appendChild(prose);
      } else {
        readmeBox.appendChild(h("div", { class: "vp__muted" }, t("noReadme")));
      }
    });
  }

  function select(p: Project): void {
    sel = p;
    renderList();
    renderDetail();
  }

  renderList();

  void fetchRepos().then((r) => {
    repos = r.repos;
    live = r.live;
    loading = false;
    src.className = "vp__src" + (live ? " is-live" : "");
    srcLabel.textContent = live ? " live · github" : " cached";
    if (!sel && repos.length) sel = repos[0];
    renderList();
    renderDetail();
  });

  return root;
}
