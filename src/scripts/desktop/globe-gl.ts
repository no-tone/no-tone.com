/* ============================================================
   VireGlobeGL — WebGL upgrade of the dotted EARTH.

   The dense dot sphere (the expensive part) is rendered on the GPU
   via OGL as GL_POINTS: one draw call, orthographic projection and
   rotation done in the vertex shader, soft-edged discs with a
   depth-driven glow in the fragment shader. Because the GPU shrugs
   off the point count, we sample a finer grid than the 2D globe.

   Arcs, node halos and the DOM-node positioning still need per-frame
   screen coordinates, so those stay on a lightweight 2D <canvas>
   overlay driven by the same CPU projection the 2D globe used — which
   keeps drag, accent, tilt and node behaviour byte-for-byte identical.
   Both layers share one rotation/tilt state.

   Drop-in for VireGlobe: same public surface (setNodes / readAccent /
   start / stop / destroy). `tryCreate` returns null when WebGL is
   unavailable so the caller can fall back to the 2D renderer.
   ============================================================ */

import { Renderer, Geometry, Program, Mesh } from "ogl";
import { buildDotField, llToVec, hexA, type GlobeNode, type GlobeOptions } from "./globe";

const DEG = Math.PI / 180;

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  hex = (hex || "#ece9e1").trim();
  if (hex[0] !== "#") return [0.925, 0.914, 0.882];
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

const VERT = /* glsl */ `
  attribute vec3 position;   // unit vector on the sphere
  attribute float land;      // 1.0 land, 0.0 ocean

  uniform float uRot;        // spin (radians)
  uniform float uTilt;       // tilt (radians)
  uniform float uSX;         // NDC scale x = 2R/w
  uniform float uSY;         // NDC scale y = 2R/h
  uniform float uDpr;
  uniform float uR;          // sphere radius (css px), for point sizing

  varying float vDepth;      // 0 back .. 1 front
  varying float vLand;

  void main() {
    // spin about Y, then tilt about X — matches the 2D projection exactly
    float cr = cos(uRot), sr = sin(uRot);
    float x = position.x * cr + position.z * sr;
    float z = -position.x * sr + position.z * cr;
    float y = position.y;
    float ct = cos(uTilt), st = sin(uTilt);
    float y2 = y * ct - z * st;
    float z2 = y * st + z * ct;

    vDepth = (z2 + 1.0) * 0.5;
    vLand = land;

    // orthographic: screen = center + v * R  ->  NDC (y flipped for canvas)
    gl_Position = vec4(x * uSX, -y2 * uSY, 0.0, 1.0);

    float base = land > 0.5 ? (0.9 + vDepth * 1.7) : 0.75;
    gl_PointSize = base * (uR / 260.0) * uDpr * 2.0;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;

  uniform vec3 uColor;
  varying float vDepth;
  varying float vLand;

  void main() {
    // soft round disc
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float disc = smoothstep(0.5, 0.15, d);

    float front = step(0.001, vDepth - 0.5); // rough front/back split at equator
    float alpha;
    if (vLand > 0.5) {
      alpha = mix(0.05 + vDepth * 0.06, 0.22 + vDepth * 0.66, front);
    } else {
      alpha = mix(0.02, 0.05 + vDepth * 0.08, front);
    }
    gl_FragColor = vec4(uColor, alpha * disc);
  }
`;

export class VireGlobeGL {
  private glCanvas: HTMLCanvasElement;
  private overlay: HTMLCanvasElement;
  private octx: CanvasRenderingContext2D;
  private renderer: Renderer;
  private mesh: Mesh;
  private program: Program;

  private tilt: number;
  private autoSpeed: number;
  private rot = 2.6;
  private nodes: GlobeNode[] = [];
  private accent = "#ece9e1";
  private optR: number;
  private dpr: number;

  private running = false;
  private wantRun = false;
  private dragging = false;
  private raf: number | null = null;

  private w = 0;
  private h = 0;
  private R = 0;
  private cx = 0;
  private cy = 0;

  private readonly onResize: () => void;
  private readonly onVisibility: () => void;
  private detachDrag: (() => void) | null = null;

  /** Returns a WebGL globe, or null if WebGL/OGL init fails (caller falls
   *  back to the 2D VireGlobe). */
  static tryCreate(canvas: HTMLCanvasElement, opts: GlobeOptions = {}): VireGlobeGL | null {
    try {
      return new VireGlobeGL(canvas, opts);
    } catch {
      return null;
    }
  }

  private constructor(canvas: HTMLCanvasElement, opts: GlobeOptions = {}) {
    this.glCanvas = canvas;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // WebGL surface on the existing #vk-canvas
    this.renderer = new Renderer({
      canvas,
      alpha: true,
      antialias: true,
      dpr: this.dpr,
      premultipliedAlpha: false,
    });
    const gl = this.renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    // finer grid than the 2D globe — the GPU doesn't care
    const dots = buildDotField(opts.step ? opts.step : 3.0);
    const position = new Float32Array(dots.length * 3);
    const land = new Float32Array(dots.length);
    dots.forEach((d, i) => {
      position[i * 3] = d.v[0];
      position[i * 3 + 1] = d.v[1];
      position[i * 3 + 2] = d.v[2];
      land[i] = d.land ? 1 : 0;
    });

    const geometry = new Geometry(gl, {
      position: { size: 3, data: position },
      land: { size: 1, data: land },
    });

    this.program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uRot: { value: this.rot },
        uTilt: { value: 0 },
        uSX: { value: 1 },
        uSY: { value: 1 },
        uDpr: { value: this.dpr },
        uR: { value: 1 },
        uColor: { value: hexToRgb(this.accent) },
      },
    });
    // normal alpha blend — reads correctly over both light and dark themes
    this.program.setBlendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.mesh = new Mesh(gl, { geometry, program: this.program, mode: gl.POINTS });

    // 2D overlay for arcs + node halos, layered between the globe (z0) and
    // the interactive nodes (z3).
    this.overlay = document.createElement("canvas");
    this.overlay.className = "vk-canvas vk-canvas--overlay";
    this.overlay.setAttribute("aria-hidden", "true");
    this.overlay.style.zIndex = "1";
    this.overlay.style.pointerEvents = "none";
    canvas.insertAdjacentElement("afterend", this.overlay);
    const octx = this.overlay.getContext("2d");
    if (!octx) throw new Error("VireGlobeGL: 2d overlay context unavailable");
    this.octx = octx;

    this.tilt = (opts.tilt ?? -16) * DEG;
    this.autoSpeed = opts.autoSpeed ?? 0.0016;
    this.optR = opts.r || 0.46;

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
    const host = this.glCanvas.closest("[data-theme]") || document.documentElement;
    const c = getComputedStyle(host).getPropertyValue("--accent").trim();
    if (c) {
      this.accent = c;
      this.program.uniforms.uColor.value = hexToRgb(c);
    }
  }

  setNodes(nodes: GlobeNode[]): void {
    this.nodes = nodes;
  }

  private bindDrag(): void {
    // Hit-test on the GL canvas; track on window so a drag survives the
    // pointer crossing nodes/chrome (identical to the 2D globe).
    const c = this.glCanvas;
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
    // The globe canvas is always the full fixed viewport. We must NOT read
    // clientWidth here: OGL's Renderer stamps a default 300x150 inline size
    // on the canvas, which beats the `.vk-canvas { width:100vw }` rule, so
    // clientWidth would report the collapsed 300 and lock the globe there.
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w;
    this.h = h;
    this.R = Math.min(w, h) * this.optR;
    this.cx = w * 0.5;
    this.cy = h * 0.5;

    this.renderer.setSize(w, h);
    this.overlay.width = w * this.dpr;
    this.overlay.height = h * this.dpr;

    const u = this.program.uniforms;
    u.uSX.value = (2 * this.R) / w;
    u.uSY.value = (2 * this.R) / h;
    u.uR.value = this.R;
  }

  private project(v: [number, number, number]): { x: number; y: number; z: number } {
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
    // GPU dot sphere
    this.program.uniforms.uRot.value = this.rot;
    this.program.uniforms.uTilt.value = this.tilt;
    this.renderer.render({ scene: this.mesh });

    // 2D overlay: clear, then arcs + node halos in CSS px (dpr transform)
    const ctx = this.octx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const acc = this.accent;

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
    this.overlay.remove();
  }
}
