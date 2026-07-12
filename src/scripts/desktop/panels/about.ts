/* About panel — bio, pronunciation, stack + infra, and a small
   "how the globe works" code snippet. Languages-used is enriched from
   live repos when available. */

import { h, clear } from "../dom";
import { tag, chips, codeBlock, panelHead } from "../components";
import { tt, fetchRepos, type Lang } from "../data";

const GLOBE_CODE = `export class Globe extends Server {
  onConnect(conn) {
    conn.setState({ x: 0, y: 0 });
  }
  onMove(conn, p) {
    this.broadcast(p, [conn.id]);
  }
}`;

export function buildAbout(lang: Lang): HTMLElement {
  const t = (k: string) => tt(lang, k);

  const lead = h("p", { class: "vp__lead" }, h("b", {}, "no-tone"), ` ${t("aboutLead")}`);
  const pron = h(
    "p",
    { class: "vp__pron" },
    `${t("pronounce")} `,
    h("b", {}, "/noʊ·toʊn/"),
    " — “no tone”, flat and quiet.",
  );

  const stackChips = chips(
    ["Astro", "TypeScript", "Cloudflare Workers", "Wrangler"],
    "accent",
  );

  const langsWrap = chips(["TypeScript", "Astro"]);

  const contact = h(
    "p",
    { class: "vp__contact vp__contact--gap" },
    `${t("getInTouch")}: `,
    h("a", { href: "mailto:msg@no-tone.com" }, "msg@no-tone.com"),
  );

  const left = h(
    "div",
    {},
    lead,
    pron,
    h("p", {}, t("aboutP2")),
    h("div", { class: "vp__sub vp__sub--stack" }, t("stack")),
    stackChips,
    h("div", { class: "vp__sub vp__sub--infra" }, t("infra")),
    h("p", { class: "vp__muted vp__muted--body" }, t("infraBody")),
    h("div", { class: "vp__sub vp__sub--langs" }, "languages used"),
    langsWrap,
    contact,
  );


  // untitled.stream refuses external framing (X-Frame-Options: SAMEORIGIN +
  // frame-ancestors 'none' on its embed URLs), so an <iframe> can't render.
  // A link-out card is the honest, always-works alternative.
  const embed = h(
    "div",
    { class: "vp__embed" },
    h("div", { class: "vp__sub" }, t("onRepeat")),
    h(
      "a",
      {
        class: "vp__player",
        href: "https://untitled.stream/library/project/Y7ges7T8FiwyWmNhfqqQn",
        target: "_blank",
        rel: "noreferrer noopener",
      },
      h("span", { class: "vp__player-glyph", "aria-hidden": "true" }, "▶"),
      h(
        "span",
        { class: "vp__player-body" },
        h("span", { class: "vp__player-title" }, "untitled.stream"),
        h("span", { class: "vp__player-sub" }, t("openPlayer")),
      ),
      h("span", { class: "vp__player-arrow", "aria-hidden": "true" }, "↗"),
    ),
  );

  const right = h(
    "div",
    {},
    h("div", { class: "vp__sub" }, t("howGlobe")),
    codeBlock("globe.ts", GLOBE_CODE),
    embed,
  );

  void fetchRepos().then((r) => {
    const langs = Array.from(new Set(r.repos.map((p) => p.language).filter(Boolean)));
    if (langs.length) {
      clear(langsWrap);
      for (const l of langs) langsWrap.appendChild(tag(l));
    }
  });

  return h(
    "div",
    { class: "vp" },
    panelHead(t("colophon"), t("about")),
    h("div", { class: "vp__about2" }, left, right),
  );
}
