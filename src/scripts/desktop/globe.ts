/* ============================================================
   VireGlobe — a dotted EARTH on a <canvas>. Continent polygons
   are rasterized to an offscreen equirectangular map, then sampled
   per lat/lon grid cell: land cells render bright, ocean faint, so
   the sphere keeps its volume. Auto-rotates and is drag-to-rotate
   (x = spin, y = tilt). Nodes are pinned at lat/lon; the controller
   positions caller-supplied DOM elements over them each frame and
   draws arcs between them. Color is read live from --accent.
   Ported from the Claude Design UI kit (ui_kits/desktop/globe.js).
   ============================================================ */

const DEG = Math.PI / 180;

type Vec3 = [number, number, number];
type Ring = [number, number][]; // [lon, lat]

export interface GlobeNode {
  id: string;
  lat: number;
  lon: number;
  el?: HTMLElement | null;
}

export interface GlobeOptions {
  step?: number;
  autoSpeed?: number;
  tilt?: number;
  r?: number;
}

interface Mask {
  data: Uint8ClampedArray;
  W: number;
  H: number;
}

// Rough continent outlines as [lon, lat] rings — recognizable
// silhouettes, rasterized once for cheap sampling.
const LAND: Ring[] = [
  [[-168, 65], [-160, 71], [-140, 70], [-120, 71], [-95, 72], [-82, 73], [-62, 82], [-75, 68], [-80, 62], [-64, 60], [-56, 52], [-66, 45], [-70, 42], [-74, 40], [-81, 31], [-80, 25], [-90, 29], [-97, 26], [-97, 21], [-105, 20], [-107, 24], [-112, 24], [-117, 33], [-124, 40], [-124, 48], [-133, 55], [-142, 60], [-152, 59], [-165, 60]],
  [[-92, 18], [-86, 21], [-83, 15], [-77, 8], [-82, 8], [-88, 13], [-92, 15]],
  [[-81, 7], [-76, 10], [-64, 11], [-52, 5], [-50, 0], [-44, -2], [-35, -6], [-39, -14], [-48, -25], [-56, -35], [-62, -40], [-66, -46], [-71, -52], [-75, -52], [-73, -45], [-70, -30], [-71, -18], [-77, -13], [-81, -4]],
  [[-46, 60], [-30, 61], [-20, 70], [-22, 78], [-40, 83], [-58, 80], [-53, 68]],
  [[-10, 36], [-9, 44], [-2, 48], [-5, 58], [5, 62], [12, 66], [26, 71], [30, 66], [40, 64], [42, 54], [34, 46], [28, 41], [20, 40], [14, 38], [8, 38], [0, 41], [-6, 36]],
  [[-6, 50], [-3, 54], [-6, 59], [-9, 56], [-7, 51]],
  [[-16, 15], [-16, 26], [-6, 36], [11, 37], [24, 32], [34, 31], [43, 12], [51, 12], [42, -2], [40, -15], [35, -24], [26, -34], [18, -35], [12, -17], [9, 4], [-8, 5], [-17, 14]],
  [[43, -13], [50, -15], [49, -25], [44, -22]],
  [[40, 50], [45, 56], [55, 62], [68, 73], [95, 78], [112, 74], [132, 73], [150, 72], [165, 70], [179, 67], [179, 60], [162, 60], [150, 53], [142, 46], [135, 43], [126, 40], [122, 38], [121, 31], [110, 20], [105, 9], [100, 6], [94, 9], [89, 22], [80, 8], [77, 8], [72, 20], [66, 25], [57, 26], [48, 30], [44, 40], [41, 45]],
  [[96, 5], [118, 1], [136, -4], [141, -9], [122, -9], [103, -1], [97, 2]],
  [[130, 31], [136, 35], [141, 38], [142, 44], [139, 37], [133, 33]],
  [[113, -22], [123, -17], [131, -12], [142, -11], [147, -20], [150, -38], [140, -38], [130, -32], [118, -35], [114, -30]],
  [[166, -45], [172, -41], [177, -39], [173, -46], [168, -47]],
];

function buildMask(W: number, H: number): Mask {
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const c = off.getContext("2d");
  if (!c) return { data: new Uint8ClampedArray(W * H * 4), W, H };
  c.fillStyle = "#000";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#fff";
  const X = (lon: number) => ((lon + 180) / 360) * W;
  const Y = (lat: number) => ((90 - lat) / 180) * H;
  for (const ring of LAND) {
    c.beginPath();
    ring.forEach(([lo, la], i) => (i ? c.lineTo(X(lo), Y(la)) : c.moveTo(X(lo), Y(la))));
    c.closePath();
    c.fill();
  }
  c.fillRect(0, Y(-63), W, H - Y(-63)); // Antarctica band
  return { data: c.getImageData(0, 0, W, H).data, W, H };
}

function fibGrid(step: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let lat = -88; lat <= 88; lat += step) {
    const lonStep = step / Math.max(0.25, Math.cos(lat * DEG));
    for (let lon = -180; lon < 180; lon += lonStep) pts.push([lat, lon]);
  }
  return pts;
}

export interface Dot {
  v: Vec3;
  land: boolean;
}

/** Build the sampled dot field once — a grid of unit vectors tagged
 *  land/ocean by sampling the rasterized continent mask. Shared by both
 *  the canvas-2D and WebGL globe renderers so they stay pixel-identical
 *  in layout. */
export function buildDotField(step: number): Dot[] {
  const mask = buildMask(720, 360);
  return fibGrid(step).map(([lat, lon]) => {
    const px = Math.floor(((lon + 180) / 360) * mask.W);
    const py = Math.floor(((90 - lat) / 180) * mask.H);
    const land = mask.data[(py * mask.W + px) * 4] > 128;
    return { v: llToVec(lat, lon), land };
  });
}

export function llToVec(lat: number, lon: number): Vec3 {
  const la = lat * DEG;
  const lo = lon * DEG;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
}

export function hexA(hex: string, a: number): string {
  hex = (hex || "#ece9e1").trim();
  if (hex[0] !== "#") return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export class VireGlobe {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dots: { v: Vec3; land: boolean }[];
  private tilt: number;
  private autoSpeed: number;
  private rot = 2.6;
  private nodes: GlobeNode[] = [];
  private running = false;
  private wantRun = false;
  private accent = "#ece9e1";
  private dpr: number;
  private optR: number;
  private dragging = false;
  private raf: number | null = null;
  private readonly onResize: () => void;
  private readonly onVisibility: () => void;
  private detachDrag: (() => void) | null = null;
  private w = 0;
  private h = 0;
  private R = 0;
  private cx = 0;
  private cy = 0;

  constructor(canvas: HTMLCanvasElement, opts: GlobeOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("VireGlobe: 2d context unavailable");
    this.ctx = ctx;

    this.dots = buildDotField(opts.step || 4.2);

    this.tilt = (opts.tilt ?? -16) * DEG;
    this.autoSpeed = opts.autoSpeed ?? 0.0016;
    this.optR = opts.r || 0.46;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.onResize = () => this.resize();
    window.addEventListener("resize", this.onResize);

    this.onVisibility = () => {
      if (document.hidden) {
        this.running = false;
        if (this.raf) cancelAnimationFrame(this.raf);
      } else if (this.wantRun && !this.running) {
        this.running = true;
        this.tick();
      }
    };
    document.addEventListener("visibilitychange", this.onVisibility);
    this.bindDrag();
    this.resize();
    this.readAccent();
  }

  readAccent(): void {
    const host = this.canvas.closest("[data-theme]") || document.documentElement;
    const c = getComputedStyle(host).getPropertyValue("--accent").trim();
    if (c) this.accent = c;
  }

  setNodes(nodes: GlobeNode[]): void {
    this.nodes = nodes;
  }

  private bindDrag(): void {
    const c = this.canvas;
    let lx = 0;
    let ly = 0;
    let downX = 0;
    let downY = 0;
    let active = false;

    const onDown = (e: PointerEvent) => {
      const rect = c.getBoundingClientRect();
      const dx = e.clientX - rect.left - this.cx;
      const dy = e.clientY - rect.top - this.cy;
      if (Math.hypot(dx, dy) > this.R * 1.05) return;
      active = true;
      lx = downX = e.clientX;
      ly = downY = e.clientY;
    };
    // Tracked on window (not the canvas) so the drag survives the pointer
    // crossing nodes/chrome and runs its full range on both mouse and touch.
    const onMove = (e: PointerEvent) => {
      if (!active) return;
      if (!this.dragging) {
        if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) < 4) return;
        this.dragging = true;
      }
      this.rot += (e.clientX - lx) * 0.006;
      this.tilt = Math.max(-1.25, Math.min(1.25, this.tilt - (e.clientY - ly) * 0.004));
      lx = e.clientX;
      ly = e.clientY;
    };
    const onUp = () => {
      active = false;
      this.dragging = false;
    };

    c.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    this.detachDrag = () => {
      c.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }

  private resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.w = w;
    this.h = h;
    this.R = Math.min(w, h) * this.optR;
    this.cx = w * 0.5;
    this.cy = h * 0.5;
  }

  private project(v: Vec3): { x: number; y: number; z: number } {
    const cosR = Math.cos(this.rot);
    const sinR = Math.sin(this.rot);
    const x = v[0] * cosR + v[2] * sinR;
    const z = -v[0] * sinR + v[2] * cosR;
    const y = v[1];
    const cosT = Math.cos(this.tilt);
    const sinT = Math.sin(this.tilt);
    const y2 = y * cosT - z * sinT;
    const z2 = y * sinT + z * cosT;
    return { x: this.cx + x * this.R, y: this.cy + y2 * this.R, z: z2 };
  }

  private frame(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const acc = this.accent;

    ctx.fillStyle = acc;
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      const p = this.project(d.v);
      const front = p.z > 0;
      const depth = (p.z + 1) / 2;
      let alpha: number;
      let size: number;
      if (d.land) {
        alpha = front ? 0.22 + depth * 0.62 : 0.05 + depth * 0.05;
        size = front ? 0.95 + depth * 1.35 : 0.7;
      } else {
        alpha = front ? 0.05 + depth * 0.07 : 0.02;
        size = 0.7;
      }
      ctx.globalAlpha = alpha;
      ctx.fillRect(p.x - size, p.y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;

    const proj = this.nodes.map((n) => ({ n, p: this.project(llToVec(n.lat, n.lon)) }));
    ctx.lineWidth = 1;
    for (let i = 0; i < proj.length; i++) {
      if (proj.length < 2) break;
      const a = proj[i];
      const b = proj[(i + 1) % proj.length];
      if (a.p.z > -0.1 && b.p.z > -0.1) {
        const mx = (a.p.x + b.p.x) / 2;
        const my = (a.p.y + b.p.y) / 2 - Math.abs(a.p.x - b.p.x) * 0.16 - 24;
        ctx.beginPath();
        ctx.strokeStyle = hexA(acc, 0.4);
        ctx.moveTo(a.p.x, a.p.y);
        ctx.quadraticCurveTo(mx, my, b.p.x, b.p.y);
        ctx.stroke();
      }
    }

    // Position nodes via CSSOM. Writing element.style is exempt from the
    // style-src CSP (only literal `style=` attributes are policed), and it's
    // far cheaper than re-parsing a whole stylesheet every animation frame.
    for (const { n, p } of proj) {
      const front = p.z > -0.06;
      if (n.el) {
        n.el.style.transform = `translate(-50%,-50%) translate(${p.x}px,${p.y}px)`;
        n.el.style.opacity = front ? "1" : "0";
        n.el.style.pointerEvents = front ? "auto" : "none";
      }
      if (front) {
        ctx.beginPath();
        ctx.fillStyle = hexA(acc, 0.14);
        ctx.arc(p.x, p.y, 12, 0, 6.2832);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = acc;
        ctx.lineWidth = 1.5;
        ctx.arc(p.x, p.y, 12, 0, 6.2832);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = acc;
        ctx.arc(p.x, p.y, 3, 0, 6.2832);
        ctx.fill();
      }
    }

    if (!this.dragging) this.rot += this.autoSpeed;
  }

  private tick = (): void => {
    if (!this.running) return;
    this.frame();
    this.raf = requestAnimationFrame(this.tick);
  };

  start(): void {
    this.wantRun = true;
    if (this.running || document.hidden) return;
    this.running = true;
    this.tick();
  }

  stop(): void {
    this.wantRun = false;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  destroy(): void {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.detachDrag?.();
  }
}
