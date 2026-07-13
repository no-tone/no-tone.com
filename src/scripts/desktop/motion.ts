/* Motion — GSAP-powered micro-interactions layered over the CSS chrome.
   Kept deliberately small: the drawer slide itself stays CSS (cheap, and
   it already reads well); GSAP is used only where a hand-tuned stagger
   beats what CSS transitions can express — the content reveal as a panel
   mounts, and the ranked "best at" meters filling on entry.

   Everything here is a no-op under prefers-reduced-motion, and every
   tween clears the inline props it sets so the DOM is left exactly as
   the builders produced it (matters because panels are rebuilt on every
   open and language switch). */

import { gsap } from "gsap";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Top-level blocks of a panel, in reading order. We animate whichever of
// these actually exist in the mounted panel, so one routine covers all
// three panels without knowing their individual shapes.
const REVEAL_SELECTORS = [
  ".vp__head",
  ".vp__cvlead",
  ".vp__muted",
  ".vp__filter",
  ".vp__sub--best",
  ".vp__bestrow",
  ".vp__sub",
  ".vp__exp",
  ".vp__skillset",
  ".vp__chips",
  ".vire-code",
  ".vp__row",
].join(",");

/** Stagger the panel's content in as it mounts. Call after the panel DOM
 *  has been inserted into the drawer body. */
export function revealPanel(container: HTMLElement): void {
  if (reduceMotion) return;

  const targets = Array.from(container.querySelectorAll<HTMLElement>(REVEAL_SELECTORS))
    // Drop nested matches: a `.vp__bestrow` inside a block we already grabbed
    // would double-animate. Keep only elements whose nearest matching
    // ancestor isn't also in the set.
    .filter((el) => {
      const parentMatch = el.parentElement?.closest(REVEAL_SELECTORS);
      return !parentMatch || !container.contains(parentMatch) || parentMatch === el;
    });

  if (!targets.length) return;

  gsap.fromTo(
    targets,
    { autoAlpha: 0, y: 10 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 0.42,
      ease: "power2.out",
      stagger: 0.045,
      clearProps: "opacity,visibility,transform",
    },
  );
}
