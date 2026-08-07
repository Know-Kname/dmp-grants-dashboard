/**
 * Minimal WebGL2 helpers for the DMP visual layer.
 *
 * Deliberately dependency-free. A 3D library (three.js and friends) costs
 * ~600 kB gzipped, and this app already ships maplibre and recharts — the two
 * scenes here need a perspective matrix, a shader, and a render loop, which is
 * about 150 lines. Adding a general-purpose engine to draw two backgrounds
 * would be the most expensive decoration in the bundle.
 *
 * Everything here is defensive about *not* running: jsdom has no WebGL, older
 * machines report no `webgl2`, and a background animation must never be the
 * reason a page fails to render. Callers get `null` and fall back to CSS.
 */

/* ── Matrices ────────────────────────────────────────────────────────
   Column-major, matching what `uniformMatrix4fv` expects with transpose
   set to false. Hand-rolled rather than pulled from gl-matrix: three
   functions is not a dependency.                                       */

export type Mat4 = Float32Array;

export function perspective(fovyRad: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovyRad / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

/** Right-handed look-at. `up` is assumed roughly +Y and is re-orthogonalised. */
export function lookAt(
  eye: [number, number, number],
  target: [number, number, number],
  up: [number, number, number] = [0, 1, 0]
): Mat4 {
  const [ex, ey, ez] = eye;
  let zx = ex - target[0], zy = ey - target[1], zz = ez - target[2];
  const zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl; zy /= zl; zz /= zl;

  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  const xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * ex + xy * ey + xz * ez),
    -(yx * ex + yy * ey + yz * ez),
    -(zx * ex + zy * ey + zz * ez),
    1,
  ]);
}

/* ── Program construction ────────────────────────────────────────── */

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // Surfaced rather than swallowed: a silent shader failure looks exactly
    // like "the design just isn't there", which is a miserable thing to debug.
    console.error('[gl] shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string
): WebGLProgram | null {
  const vert = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  // Shaders are reference-counted by the program; detaching now lets the
  // driver reclaim their source immediately.
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[gl] program link failed:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

/** `#RRGGBB` → linear-ish [r,g,b] in 0..1. Good enough for additive glow. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/* ── Canvas lifecycle ────────────────────────────────────────────── */

export interface SceneHandle {
  /** Called every frame with elapsed seconds and the drawing-buffer size. */
  render: (timeSec: number, width: number, height: number) => void;
  dispose: () => void;
}

export interface MountOptions {
  /** Build the scene. Return null to abort (unsupported hardware, etc.). */
  setup: (gl: WebGL2RenderingContext) => SceneHandle | null;
  /** Render a single frame and stop. Used for prefers-reduced-motion. */
  still?: boolean;
  /** Upper bound on devicePixelRatio. Backgrounds do not need retina. */
  maxDpr?: number;
}

/**
 * Attach a WebGL2 scene to a canvas and drive it.
 *
 * Returns a teardown function, or `null` when WebGL2 is unavailable — the
 * caller is expected to have a CSS fallback painted underneath either way, so
 * `null` is a normal outcome and not an error.
 *
 * The loop stops when the tab is hidden or the canvas scrolls out of view. On a
 * dashboard that is most of the time, and a background shader spinning at 60fps
 * behind a scrolled-away header is pure battery cost.
 */
export function mountScene(canvas: HTMLCanvasElement, opts: MountOptions): (() => void) | null {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: true,
    depth: false,
    premultipliedAlpha: true,
    powerPreference: 'low-power',
  });
  if (!gl) return null;

  const scene = opts.setup(gl);
  if (!scene) return null;

  const maxDpr = opts.maxDpr ?? 1.75;
  let raf = 0;
  let running = false;
  let visible = true;
  let onScreen = true;
  const start = performance.now();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  const frame = () => {
    resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    scene.render((performance.now() - start) / 1000, canvas.width, canvas.height);
    if (running) raf = requestAnimationFrame(frame);
  };

  const sync = () => {
    const should = visible && onScreen && !opts.still;
    if (should && !running) {
      running = true;
      raf = requestAnimationFrame(frame);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };

  const onVisibility = () => { visible = !document.hidden; sync(); };
  document.addEventListener('visibilitychange', onVisibility);

  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }, { threshold: 0 })
    : null;
  io?.observe(canvas);

  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => { if (!running) frame(); })
    : null;
  ro?.observe(canvas);

  // Always paint once, so a still scene (reduced motion) and the first frame of
  // an animated one both appear without waiting on an observer callback.
  frame();
  sync();

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVisibility);
    io?.disconnect();
    ro?.disconnect();
    scene.dispose();
  };
}
