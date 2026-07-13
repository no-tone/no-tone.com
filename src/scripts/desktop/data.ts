/* no-tone desktop — data layer.
   Projects come from the site's own cached, same-origin
   /api/projects.json endpoint (server-side GitHub fetch, so no
   per-visitor rate limit and no cross-origin call). A curated
   fallback keeps the panel populated if the endpoint is down.
   READMEs are fetched on demand straight from the GitHub HTML API
   (allowed by connect-src). i18n mirrors the UI kit. */

export type Lang = "en" | "pt";

export interface Project {
  name: string;
  description: string;
  language: string;
  year: string;
  topics: string[];
  stars: number;
  url: string;
  homepage: string;
}

export interface NodeDef {
  id: string;
  lat: number;
  lon: number;
  type: "panel" | "link";
  href?: string;
}

export interface Sig {
  id: string;
  dark: { c: string; hi: string; on: string };
  light: { c: string; hi: string; on: string };
}

const GH_USER = "no-tone";

/* ---- i18n (English default; Portuguese available) ---- */
export const STR: Record<Lang, Record<string, string>> = {
  en: {
    status: "heads-down · building", index: "index", signature: "signature",
    projects: "projects", cv: "cv", about: "about", contact: "contact", github: "github",
    selectedWork: "selected work", curriculum: "curriculum", colophon: "colophon",
    filter: "filter…", sortRecent: "recent", sortName: "a–z", sortStars: "stars",
    openRepo: "repo ↗", openSite: "live site ↗", openGithub: "open on github ↗",
    noReadme: "no readme available — see the description above or open on github.",
    fetchReadme: "fetching readme…", loadingRepos: "loading repositories…", noMatch: "no repos match",
    experience: "experience", education: "education", bestAt: "what i’m best at",
    focus: "focus", langs: "languages", interests: "interests",
    stack: "stack", infra: "infra", howGlobe: "how the globe works", getInTouch: "get in touch",
    aboutLead: "is the workshop of a software engineer — a place to build tools, ship experiments and leave a mark.",
    aboutP2: "Everything here is a window; the globe is the map of what I’ve made — drag it, click a node. Security-minded by default: content, headers and origins are locked down at the edge with a CSP-enforced middleware layer.",
    infraBody: "cloudflare workers + wrangler · cloudflare pages. one smart network, close to users, close to data.",
    cvLead: "Application engineer — full-stack, security-minded, happiest shipping tools at the edge. Currently building digital products while pursuing an MSc in software engineering.",
    pronounce: "pronounced", cityLondon: "london", citySf: "san francisco",
    onRepeat: "on repeat", openPlayer: "open the player",
  },
  pt: {
    status: "em foco · a construir", index: "índice", signature: "assinatura",
    projects: "projetos", cv: "cv", about: "sobre", contact: "contacto", github: "github",
    selectedWork: "trabalho selecionado", curriculum: "currículo", colophon: "colofão",
    filter: "filtrar…", sortRecent: "recente", sortName: "a–z", sortStars: "estrelas",
    openRepo: "repo ↗", openSite: "site ↗", openGithub: "abrir no github ↗",
    noReadme: "sem readme disponível — vê a descrição acima ou abre no github.",
    fetchReadme: "a obter readme…", loadingRepos: "a carregar repositórios…", noMatch: "nenhum repo corresponde a",
    experience: "experiência", education: "formação", bestAt: "o que faço melhor",
    focus: "foco", langs: "idiomas", interests: "interesses",
    stack: "stack", infra: "infra", howGlobe: "como o globo funciona", getInTouch: "fala comigo",
    aboutLead: "é a oficina de um engenheiro de software — um lugar para construir ferramentas, lançar experiências e deixar marca.",
    aboutP2: "Aqui tudo é uma janela; o globo é o mapa do que fiz — arrasta-o, clica num nó. Segurança por defeito: conteúdo, cabeçalhos e origens fechados na edge com uma camada de middleware com CSP.",
    infraBody: "cloudflare workers + wrangler · cloudflare pages. uma rede inteligente, perto dos utilizadores, perto dos dados.",
    cvLead: "Engenheiro de aplicações — full-stack, focado em segurança, mais feliz a lançar ferramentas na edge. Atualmente a construir produtos digitais enquanto faço um mestrado em engenharia de software.",
    pronounce: "pronuncia-se", cityLondon: "londres", citySf: "são francisco",
    onRepeat: "em repetição", openPlayer: "abrir o leitor",
  },
};

export const tt = (lang: Lang, k: string): string =>
  (STR[lang] && STR[lang][k]) || STR.en[k] || k;

/* ---- Globe nodes (lat/lon pins) ---- */
export const NODES: NodeDef[] = [
  { id: "projects", lat: 34, lon: -42, type: "panel" },
  { id: "cv", lat: -6, lon: 34, type: "panel" },
  { id: "about", lat: 28, lon: 104, type: "panel" },
  { id: "contact", lat: -24, lon: 158, type: "link", href: "mailto:msg@no-tone.com" },
  { id: "github", lat: 54, lon: -112, type: "link", href: "https://github.com/no-tone" },
];

/* ---- Signature palettes — per theme so hues stay legible ---- */
export const SIGS: Sig[] = [
  { id: "mono", dark: { c: "#ece9e1", hi: "#ffffff", on: "#000000" }, light: { c: "#1a1c22", hi: "#000000", on: "#ffffff" } },
  { id: "blue", dark: { c: "#4d8dff", hi: "#6ea3ff", on: "#001233" }, light: { c: "#1f6feb", hi: "#0a58d6", on: "#ffffff" } },
  { id: "green", dark: { c: "#3ddc97", hi: "#5fe8ac", on: "#001b10" }, light: { c: "#0f9d63", hi: "#0b7d4e", on: "#ffffff" } },
  { id: "violet", dark: { c: "#b47cff", hi: "#c79bff", on: "#12002e" }, light: { c: "#7c3aed", hi: "#6528d1", on: "#ffffff" } },
  { id: "coral", dark: { c: "#ff5c7a", hi: "#ff8098", on: "#33000c" }, light: { c: "#e11d48", hi: "#be1239", on: "#ffffff" } },
  { id: "orange", dark: { c: "#ff5c00", hi: "#ff7a33", on: "#1a0800" }, light: { c: "#d24500", hi: "#b23a00", on: "#ffffff" } },
];

/* ---- CV content (from the user's own CV; roles generalized).
   Fully bilingual: every field is authored per language (pt is
   European Portuguese, pt-PT). cv.ts indexes each export by the active
   Lang, so switching language re-renders the panel in that language —
   not just the section headings. Tech names (React, CSP, Docker…) stay
   untranslated in both. ---- */
export interface Exp { role: string; org: string; period: string; place: string; bullets: string[]; }
export interface Edu { title: string; period: string; bullets: string[]; }
export interface Best { k: string; v: string; }
export interface SkillGroup { label: string; items: string[]; }

export const EXPERIENCE: Record<Lang, Exp[]> = {
  en: [
    { role: "Application Engineer", org: "digital solutions studio", period: "feb 2026 — now", place: "hybrid",
      bullets: ["Websites, online stores and applications with management-system integration, supporting businesses' digital transformation."] },
    { role: "Software Engineer", org: "public-sector AI project", period: "sep 2025 — jan 2026", place: "remote",
      bullets: [
        "Built a chatbot avatar + voice system — speech-to-text, response integration and realistic lip-sync for natural citizen↔staff interactions.",
        "Applied NLP, generative AI and data science to streamline administrative processes and digital governance.",
      ] },
    { role: "Software Engineering Intern", org: "cloud management provider", period: "aug 2024 — jul 2025", place: "hybrid",
      bullets: [
        "Built interactive onboarding sliders that cut onboarding time ~15% for a banking platform.",
        "Led a web component for managing document elements; shipped a new expression editor from usability testing.",
      ] },
  ],
  pt: [
    { role: "Engenheiro de Aplicações", org: "estúdio de soluções digitais", period: "fev 2026 — agora", place: "híbrido",
      bullets: ["Sites, lojas online e aplicações com integração de sistemas de gestão, apoiando a transformação digital das empresas."] },
    { role: "Engenheiro de Software", org: "projeto de IA no setor público", period: "set 2025 — jan 2026", place: "remoto",
      bullets: [
        "Construí um avatar de chatbot + sistema de voz — speech-to-text, integração de respostas e lip-sync realista para interações naturais entre cidadãos e funcionários.",
        "Apliquei PLN, IA generativa e ciência de dados para simplificar processos administrativos e a governação digital.",
      ] },
    { role: "Estagiário de Engenharia de Software", org: "fornecedor de gestão cloud", period: "ago 2024 — jul 2025", place: "híbrido",
      bullets: [
        "Construí sliders de onboarding interativos que reduziram o tempo de onboarding em ~15% numa plataforma bancária.",
        "Liderei um componente web para gerir elementos de documentos; lancei um novo editor de expressões a partir de testes de usabilidade.",
      ] },
  ],
};

export const EDUCATION: Record<Lang, Edu[]> = {
  en: [
    { title: "MSc, Software Engineering", period: "2025 — 2027 (exp.)",
      bullets: ["Software architecture, testing and engineering practice."] },
    { title: "BSc, Computer Science", period: "2022 — 2025",
      bullets: ["Algorithms, data structures, systems, databases + web foundations."] },
  ],
  pt: [
    { title: "Mestrado em Engenharia de Software", period: "2025 — 2027 (prev.)",
      bullets: ["Arquitetura de software, testes e prática de engenharia."] },
    { title: "Licenciatura em Ciência de Computadores", period: "2022 — 2025",
      bullets: ["Algoritmos, estruturas de dados, sistemas, bases de dados + fundamentos web."] },
  ],
};

export const BEST_AT: Record<Lang, Best[]> = {
  en: [
    { k: "Full-stack product engineering", v: "React / Next.js front-ends to typed APIs and databases — end to end." },
    { k: "Web components & design systems", v: "Reusable, framework-agnostic UI primitives with real accessibility." },
    { k: "Security & privacy", v: "CSP, edge middleware, dependency hygiene — secure by default." },
    { k: "Applied AI / NLP", v: "Chat, voice and generative features wired into real products." },
    { k: "UI / UX craft", v: "Interaction detail, motion and typography that feels considered." },
  ],
  pt: [
    { k: "Engenharia de produto full-stack", v: "Front-ends React / Next.js até APIs tipadas e bases de dados — de ponta a ponta." },
    { k: "Web components e design systems", v: "Primitivas de UI reutilizáveis e agnósticas ao framework, com acessibilidade a sério." },
    { k: "Segurança e privacidade", v: "CSP, middleware na edge, higiene de dependências — seguro por defeito." },
    { k: "IA aplicada / PLN", v: "Chat, voz e funcionalidades generativas integradas em produtos reais." },
    { k: "Craft de UI / UX", v: "Detalhe de interação, movimento e tipografia pensados ao pormenor." },
  ],
};

export const SKILLS: Record<Lang, SkillGroup[]> = {
  en: [
    { label: "languages", items: ["TypeScript", "Rust", "Python", "C#", "Kotlin", "Java"] },
    { label: "frameworks", items: ["React", "Next.js", "Astro", ".NET", "Tauri"] },
    { label: "infra", items: ["Cloudflare Workers", "Docker", "PostgreSQL", "RabbitMQ", "Firebase"] },
  ],
  pt: [
    { label: "linguagens", items: ["TypeScript", "Rust", "Python", "C#", "Kotlin", "Java"] },
    { label: "frameworks", items: ["React", "Next.js", "Astro", ".NET", "Tauri"] },
    { label: "infra", items: ["Cloudflare Workers", "Docker", "PostgreSQL", "RabbitMQ", "Firebase"] },
  ],
};

export const SPOKEN: Record<Lang, string[]> = {
  en: ["Portuguese — native", "English — C1"],
  pt: ["Português — nativo", "Inglês — C1"],
};

export const INTERESTS: Record<Lang, string[]> = {
  en: ["Weightlifting", "Nature walks", "Chess", "Formula 1", "Motorcycles"],
  pt: ["Musculação", "Caminhadas na natureza", "Xadrez", "Fórmula 1", "Motos"],
};

/* ---- Curated fallback — mirrors the real no-tone inventory ---- */
export const FALLBACK_PROJECTS: Project[] = [
  { name: "taurisight", description: "Tauri + React + TensorFlow tray-first desktop app with integrated image & video recognition.", language: "Rust", year: "2025", topics: ["tauri", "ml", "desktop"], stars: 0, url: "https://github.com/no-tone/taurisight", homepage: "" },
  { name: "sonivore", description: "Streamlit app merging the Spotify API, scikit-learn clustering and LLM tagging to reorganize playlists by sound & mood.", language: "Python", year: "2025", topics: ["spotify", "ml", "audio"], stars: 0, url: "https://github.com/no-tone/sonivore", homepage: "" },
  { name: "pyrowatch", description: "Dashboard monitoring rural fire statistics & burned area in Portugal with Astro, D3.js and Leaflet.", language: "Astro", year: "2024", topics: ["data-viz", "maps"], stars: 0, url: "https://github.com/no-tone/pyrowatch", homepage: "https://no-tone.github.io/pyrowatch/" },
  { name: "dockthequeue", description: "Minimal .NET 9 API + RabbitMQ + MongoDB for JSON queueing, fully containerized with Docker Compose.", language: "C#", year: "2024", topics: ["backend", "queue"], stars: 0, url: "https://github.com/no-tone/dockthequeue", homepage: "" },
  { name: "datavision", description: "Practical CSV exploration app combining EDA, data-quality auditing and visual insights in one place.", language: "Python", year: "2024", topics: ["data", "streamlit"], stars: 0, url: "https://github.com/no-tone/datavision", homepage: "" },
  { name: "tripsync", description: "Kotlin + Android travel-management app with an authenticator and personal profile, backed by Firebase.", language: "Kotlin", year: "2023", topics: ["android", "firebase"], stars: 0, url: "https://github.com/no-tone/tripsync", homepage: "" },
];

interface ApiRepo {
  name?: string;
  url?: string;
  homepage?: string;
  language?: string;
  description?: string;
  topics?: string[];
  isFork?: boolean;
  isArchived?: boolean;
  hasPages?: boolean;
  stars?: number;
  updatedAt?: string;
}

/* Fetch public repos via the site's cached endpoint; returns
   {repos, live}. Falls back to the curated inventory. */
export async function fetchRepos(): Promise<{ repos: Project[]; live: boolean }> {
  try {
    const res = await fetch("/api/projects.json", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("api " + res.status);
    const raw: unknown = await res.json();
    if (!Array.isArray(raw)) throw new Error("bad shape");
    const repos: Project[] = (raw as ApiRepo[])
      .filter((r) => r && r.name && !r.isFork && !r.isArchived)
      .map((r) => ({
        name: String(r.name),
        description: r.description && r.description.trim() ? r.description : "—",
        language: r.language && r.language !== "Other" ? r.language : "",
        year: (r.updatedAt || "").slice(0, 4),
        topics: Array.isArray(r.topics) ? r.topics : [],
        stars: typeof r.stars === "number" ? r.stars : 0,
        url: r.url ? String(r.url) : `https://github.com/${GH_USER}/${r.name}`,
        homepage:
          (r.homepage && r.homepage.trim()) ||
          (r.hasPages ? `https://no-tone.github.io/${r.name}/` : ""),
      }));
    if (!repos.length) throw new Error("no repos");
    return { repos, live: true };
  } catch {
    return { repos: FALLBACK_PROJECTS, live: false };
  }
}

/* Fetch a rendered README (HTML fragment). Returns null on failure. */
export async function fetchReadme(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GH_USER}/${encodeURIComponent(name)}/readme`,
      { headers: { Accept: "application/vnd.github.html+json" } },
    );
    if (!res.ok) throw new Error("gh " + res.status);
    return await res.text();
  } catch {
    return null;
  }
}
