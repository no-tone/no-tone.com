/* Panel registry — maps a node id to its builder. */

import type { Lang } from "../data";
import { buildProjects } from "./projects";
import { buildCv } from "./cv";
import { buildAbout } from "./about";

export type PanelId = "projects" | "cv" | "about";

export function buildPanel(id: PanelId, lang: Lang): HTMLElement {
  if (id === "projects") return buildProjects(lang);
  if (id === "cv") return buildCv(lang);
  return buildAbout(lang);
}
