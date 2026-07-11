/* CV panel — a LinkedIn-style experience / education / skills page,
   led by a ranked "what I'm best at" grid. */

import { h } from "../dom";
import { chips, meter, panelHead } from "../components";
import {
  tt,
  EXPERIENCE,
  EDUCATION,
  BEST_AT,
  SKILLS,
  SPOKEN,
  INTERESTS,
  type Lang,
} from "../data";

export function buildCv(lang: Lang): HTMLElement {
  const t = (k: string) => tt(lang, k);

  const best = h("div", { class: "vp__best" });
  for (const b of BEST_AT) {
    best.appendChild(
      h(
        "div",
        { class: "vp__bestrow" },
        h("div", { class: "vp__bestk" }, b.k, meter(b.lvl)),
        h("div", { class: "vp__bestv" }, b.v),
      ),
    );
  }

  const expSection = h("section", {}, h("div", { class: "vp__sub" }, t("experience")));
  for (const e of EXPERIENCE) {
    const bullets = h("ul", { class: "vp__expBullets" });
    for (const b of e.bullets) bullets.appendChild(h("li", {}, b));
    expSection.appendChild(
      h(
        "div",
        { class: "vp__exp" },
        h(
          "div",
          { class: "vp__expHead" },
          h("span", { class: "vp__expRole" }, e.role),
          h("span", { class: "vp__expPeriod" }, e.period),
        ),
        h("div", { class: "vp__expOrg" }, `${e.org} · ${e.place}`),
        bullets,
      ),
    );
  }
  expSection.appendChild(h("div", { class: "vp__sub", style: "margin-top:22px" }, t("education")));
  for (const e of EDUCATION) {
    const bullets = h("ul", { class: "vp__expBullets" });
    for (const b of e.bullets) bullets.appendChild(h("li", {}, b));
    expSection.appendChild(
      h(
        "div",
        { class: "vp__exp" },
        h(
          "div",
          { class: "vp__expHead" },
          h("span", { class: "vp__expRole" }, e.title),
          h("span", { class: "vp__expPeriod" }, e.period),
        ),
        bullets,
      ),
    );
  }

  const aside = h("aside", {});
  for (const [k, arr] of Object.entries(SKILLS)) {
    aside.appendChild(
      h("div", { style: "margin-bottom:16px" }, h("div", { class: "vp__skillk" }, k), chips(arr)),
    );
  }
  aside.appendChild(h("div", { class: "vp__skillk" }, t("langs")));
  const spoken = chips(SPOKEN);
  spoken.style.marginBottom = "16px";
  aside.appendChild(spoken);
  aside.appendChild(h("div", { class: "vp__skillk" }, t("interests")));
  aside.appendChild(chips(INTERESTS));

  return h(
    "div",
    { class: "vp" },
    panelHead(t("curriculum"), t("cv")),
    h("p", { class: "vp__cvlead" }, t("cvLead")),
    h("div", { class: "vp__sub", style: "margin-top:26px" }, t("bestAt")),
    best,
    h("div", { class: "vp__cv" }, expSection, aside),
  );
}
