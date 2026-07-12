/* Custom pointer: a themed arrow that follows the cursor (colored from
   --accent so it reads on both themes), plus a cartoonish 3-line "click"
   burst on press. Only active for fine pointers; skipped for touch and
   the click burst is skipped under reduced-motion.

   Positioning uses element.style (CSSOM), which is exempt from the style-src
   CSP — only literal `style=` attributes are policed. Doing it this way (vs a
   dynamic stylesheet re-parsed on every pointermove) keeps the main thread free. */

import { trustedHTML } from "./trusted";

const ARROW_SVG =
  '<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">' +
  '<path d="M4 2 L4 20 L9 15 L12 21.6 L14.6 20.4 L11.6 14 L18 14 Z"/></svg>';

const BURST_SVG =
  '<svg viewBox="-16 -16 32 32" width="38" height="38" aria-hidden="true"><g>' +
  '<line x1="0" y1="-5.5" x2="0" y2="-12.5"/>' +
  '<line x1="4.8" y1="2.8" x2="10.8" y2="6.3"/>' +
  '<line x1="-4.8" y1="2.8" x2="-10.8" y2="6.3"/>' +
  "</g></svg>";

export function initCursor(): void {
  if (!window.matchMedia("(pointer: fine)").matches) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cursor = document.createElement("div");
  cursor.className = "vk-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = trustedHTML(ARROW_SVG);
  document.body.appendChild(cursor);

  window.addEventListener(
    "pointermove",
    (e) => {
      cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      cursor.style.opacity = "1";
    },
    { passive: true },
  );
  window.addEventListener("pointerdown", () => cursor.classList.add("is-down"));
  window.addEventListener("pointerup", () => cursor.classList.remove("is-down"));
  document.addEventListener("pointerleave", () => {
    cursor.style.opacity = "0";
  });

  if (!reduce) {
    window.addEventListener("pointerdown", (e) => {
      const burst = document.createElement("div");
      burst.className = "vk-click";
      burst.style.left = `${e.clientX}px`;
      burst.style.top = `${e.clientY}px`;
      burst.innerHTML = trustedHTML(BURST_SVG);
      document.body.appendChild(burst);
      window.setTimeout(() => burst.remove(), 420);
    });
  }
}
