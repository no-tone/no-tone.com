/* Design-system primitives, rebuilt as vanilla DOM. These mirror the
   Claude Design React components (Button / Tag / Input / CodeBlock) and
   reuse the same `vire-*` class names defined in desktop.css. */

import { h } from "./dom";

export function tag(text: string, tone?: "accent"): HTMLElement {
  return h("span", { class: tone ? `vire-tag vire-tag--${tone}` : "vire-tag" }, text);
}

export function btnLink(text: string, href: string, primary = false): HTMLElement {
  return h(
    "a",
    {
      class: primary ? "vire-btn vire-btn--primary" : "vire-btn",
      href,
      target: "_blank",
      rel: "noreferrer noopener",
    },
    text,
  );
}

export function openExternal(href: string): void {
  try {
    const u = new URL(href);
    if (u.protocol === "http:" || u.protocol === "https:") {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  } catch {
    /* ignore malformed urls */
  }
}

export function panelHead(eyebrow: string, title: string, src?: HTMLElement): HTMLElement {
  return h(
    "header",
    { class: "vp__head" },
    h(
      "div",
      {},
      h("div", { class: "vp__eyebrow" }, eyebrow),
      h("h2", { class: "vp__title" }, title),
    ),
    src,
  );
}

export function chips(items: string[], tone?: "accent"): HTMLElement {
  const wrap = h("div", { class: "vp__chips" });
  for (const s of items) wrap.appendChild(tag(s, tone));
  return wrap;
}

export function codeBlock(filename: string, code: string): HTMLElement {
  const lines = code.replace(/\n$/, "").split("\n");
  const gutter = h("div", { class: "vire-code__gutter" });
  const body = h("div", { class: "vire-code__lines" });
  lines.forEach((line, i) => {
    gutter.appendChild(h("span", {}, String(i + 1)));
    body.appendChild(h("span", {}, line || " "));
  });
  return h(
    "div",
    { class: "vire-code" },
    h(
      "div",
      { class: "vire-code__bar" },
      h("span", { class: "vire-code__dot" }, "◈"),
      h("span", {}, filename),
    ),
    h("div", { class: "vire-code__body" }, gutter, body),
  );
}
