/* no-tone desktop — interactive shell (vanilla port of app.jsx).
   Progressive enhancement over the server-rendered chrome: wires the
   globe, the node/rail navigation, the theme + signature + language
   toggles, the clocks, the coordinate readout and the slide-over
   drawer. Theme/accent/language persist in localStorage. */

import { VireGlobe, type GlobeNode } from "./globe";
import { NODES, SIGS, tt, type Lang, type Sig } from "./data";
import { buildPanel, type PanelId } from "./panels";
import { initCursor } from "./cursor";

interface NoToneHelpers {
  setStoredTheme?: (theme: "light" | "dark") => void;
  applyTheme?: (theme: "light" | "dark") => void;
  readTheme?: () => "light" | "dark";
}

const SIG_KEY = "desktop:sig";
const LANG_KEY = "desktop:lang";
const THEME_FADE_MS = 520;

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(sel);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function helpers(): NoToneHelpers {
  return (window as unknown as { noTone?: NoToneHelpers }).noTone ?? {};
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* no-op */
  }
}

function currentTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function init(): void {
  const canvas = $<HTMLCanvasElement>("#vk-canvas");
  const drawer = $("#vk-drawer");
  const sheetBody = $("#vk-sheet-body");
  const backdrop = $("#vk-backdrop");
  const closeBtn = $("#vk-close");
  const btt = $("#vk-btt");
  const word = $("#vk-word");
  const swatchWrap = $("#vk-swatches");
  const coordX = $("#vk-x");
  const coordY = $("#vk-y");
  const clockLondon = $("#vk-clock-london");
  const clockSf = $("#vk-clock-sf");

  if (!canvas || !drawer || !sheetBody) return;

  let lang: Lang = readStored(LANG_KEY) === "pt" ? "pt" : "en";
  let sigId = readStored(SIG_KEY) || "mono";
  if (!SIGS.some((s) => s.id === sigId)) sigId = "mono";
  let open: PanelId | null = null;
  let lastFocused: HTMLElement | null = null;

  /* ---------- globe ---------- */
  const globe = new VireGlobe(canvas, { step: 4.2, autoSpeed: 0.0016, tilt: -16 });
  const nodeEls = Array.from(document.querySelectorAll<HTMLElement>(".vk-node[data-node]"));
  const globeNodes: GlobeNode[] = NODES.map((n) => ({
    id: n.id,
    lat: n.lat,
    lon: n.lon,
    el: nodeEls.find((el) => el.dataset.node === n.id) ?? null,
  }));
  globe.setNodes(globeNodes);
  globe.readAccent();
  globe.start();

  /* ---------- accent / signature ---------- */
  function applyAccent(): void {
    const sig: Sig = SIGS.find((s) => s.id === sigId) ?? SIGS[0];
    const variant = currentTheme() === "light" ? sig.light : sig.dark;
    const style = document.documentElement.style;
    style.setProperty("--accent", variant.c);
    style.setProperty("--accent-hover", variant.hi);
    style.setProperty("--text-on-accent", variant.on);
    globe.readAccent();
    if (swatchWrap) {
      for (const btn of Array.from(swatchWrap.children)) {
        const el = btn as HTMLElement;
        el.classList.toggle("is-on", el.dataset.sig === sigId);
      }
    }
  }

  function buildSwatches(): void {
    if (!swatchWrap) return;
    const theme = currentTheme();
    swatchWrap.replaceChildren();
    for (const sig of SIGS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vk-swatch" + (sig.id === sigId ? " is-on" : "");
      btn.dataset.sig = sig.id;
      btn.title = sig.id;
      btn.setAttribute("aria-label", `signature: ${sig.id}`);
      btn.style.background = (theme === "light" ? sig.light : sig.dark).c;
      btn.addEventListener("click", () => {
        sigId = sig.id;
        writeStored(SIG_KEY, sigId);
        applyAccent();
      });
      swatchWrap.appendChild(btn);
    }
  }

  /* ---------- theme (smooth colour crossfade, no wipe) ---------- */
  function setTheme(theme: "light" | "dark"): void {
    const root = document.documentElement;
    if (!reduceMotion) {
      root.classList.add("vk-theming");
      window.setTimeout(() => root.classList.remove("vk-theming"), THEME_FADE_MS);
    }
    const help = helpers();
    if (help.setStoredTheme) help.setStoredTheme(theme);
    else {
      root.dataset.theme = theme;
      writeStored("theme", theme);
    }
    buildSwatches();
    applyAccent();
  }

  function toggleTheme(): void {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  }

  /* ---------- i18n ---------- */
  function applyLang(): void {
    document.documentElement.lang = lang;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-i18n]"))) {
      const key = el.dataset.i18n;
      if (!key) continue;
      el.textContent = tt(lang, key) + (el.hasAttribute("data-arrow") ? " ↗" : "");
    }
    for (const btn of Array.from(document.querySelectorAll<HTMLElement>(".vk-lang [data-lang]"))) {
      btn.classList.toggle("is-on", btn.dataset.lang === lang);
    }
    if (open) renderPanel(open); // rebuild open panel in the new language
  }

  /* ---------- drawer ---------- */
  function renderPanel(id: PanelId): void {
    if (!sheetBody) return;
    sheetBody.replaceChildren(buildPanel(id, lang));
    sheetBody.scrollTop = 0;
    btt?.classList.remove("is-on");
  }

  function openPanel(id: PanelId): void {
    lastFocused = (document.activeElement as HTMLElement) ?? null;
    open = id;
    renderPanel(id);
    drawer!.classList.add("is-open");
    drawer!.removeAttribute("inert");
    reflectActive();
    if (closeBtn) {
      const btn = closeBtn;
      window.setTimeout(() => btn.focus(), 60);
    }
  }

  function closePanel(): void {
    if (!open) return;
    open = null;
    drawer!.classList.remove("is-open");
    drawer!.setAttribute("inert", "");
    reflectActive();
    window.setTimeout(() => {
      if (!open && sheetBody) sheetBody.replaceChildren();
    }, 360);
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  }

  function reflectActive(): void {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(".vk-rail__item[data-node]"))) {
      el.classList.toggle("is-on", el.dataset.node === open);
    }
  }

  function go(id: string): void {
    const node = NODES.find((n) => n.id === id);
    if (!node) return;
    if (node.type === "link") {
      const href = node.href ?? "";
      if (href.startsWith("mailto:")) window.location.href = href;
      else if (href) window.open(href, "_blank", "noopener,noreferrer");
    } else {
      openPanel(node.id as PanelId);
    }
  }

  /* ---------- wire navigation ---------- */
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-node]"))) {
    el.addEventListener("click", () => {
      const id = el.dataset.node;
      if (id) go(id);
    });
  }
  word?.addEventListener("click", toggleTheme);
  closeBtn?.addEventListener("click", closePanel);
  backdrop?.addEventListener("click", closePanel);

  // back-to-top: reveal once the panel is scrolled, scroll to top on click
  if (btt) {
    const body = sheetBody;
    const b = btt;
    body.addEventListener(
      "scroll",
      () => b.classList.toggle("is-on", body.scrollTop > 260),
      { passive: true },
    );
    b.addEventListener("click", () => {
      body.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) closePanel();
  });
  for (const btn of Array.from(document.querySelectorAll<HTMLElement>(".vk-lang [data-lang]"))) {
    btn.addEventListener("click", () => {
      lang = btn.dataset.lang === "pt" ? "pt" : "en";
      writeStored(LANG_KEY, lang);
      applyLang();
    });
  }

  /* ---------- clocks ---------- */
  function fmt(tz: string): string {
    try {
      return new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit", minute: "2-digit", timeZone: tz, hour12: false,
      });
    } catch {
      return "--:--";
    }
  }
  function tickClocks(): void {
    if (clockLondon) clockLondon.textContent = fmt("Europe/London");
    if (clockSf) clockSf.textContent = fmt("America/Los_Angeles");
  }
  tickClocks();
  window.setInterval(tickClocks, 15000);

  /* ---------- coordinate readout ---------- */
  const pad = (n: number) => String(Math.max(0, Math.min(9999, Math.round(n)))).padStart(4, "0");
  window.addEventListener(
    "pointermove",
    (e) => {
      if (coordX) coordX.textContent = pad(e.clientX);
      if (coordY) coordY.textContent = pad(e.clientY);
    },
    { passive: true },
  );

  /* ---------- boot ---------- */
  drawer.setAttribute("inert", "");
  initCursor();
  buildSwatches();
  applyAccent();
  applyLang();

  // keep accent legible if theme changes elsewhere (e.g. cross-tab sync)
  window.addEventListener("no-tone:themechange", () => {
    buildSwatches();
    applyAccent();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
