/**
 * Grove — a true 3D field of drifting light, in DMP green and gold.
 *
 * Perspective-projected points in a cylindrical volume, rising slowly like
 * motes caught in low sun over the grounds. Depth is real: points are sized by
 * `1 / -viewZ`, fogged toward the green with distance, and the camera makes a
 * slow orbit that pointer movement leans into. That parallax between near and
 * far points is what sells it as space rather than wallpaper.
 *
 * Tone was the whole design constraint. This sits behind a product people open
 * beside grieving families, so it is slow (a full orbit takes ~80s), it never
 * flashes, and nothing moves fast enough to pull the eye off the content in
 * front of it. It reads as depth and quiet, not as an animation.
 */
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../lib/motion';
import { BRAND } from '../../config/brand';
import { createProgram, hexToRgb, lookAt, mountScene, perspective } from '../../lib/gl';

const VERT = /* glsl */ `#version 300 es
precision highp float;

// x,y,z = position in the volume; w = per-mote phase/speed seed.
in vec4 a_seed;

uniform mat4  u_proj;
uniform mat4  u_view;
uniform float u_time;
uniform float u_pixelScale;

out float v_glow;
out float v_warm;

void main() {
  float seed = a_seed.w;

  // Rise, wrapping through the volume height so the field never empties.
  float speed  = 0.055 + fract(seed * 7.31) * 0.075;
  float height = 9.0;
  float y = mod(a_seed.y + u_time * speed + seed * height, height) - height * 0.5;

  // Two out-of-phase sways: a slow drift plus a smaller cross-breeze, so the
  // field breathes instead of marching.
  float t = u_time * 0.22 + seed * 6.2831;
  vec3 world = vec3(
    a_seed.x + sin(t) * 0.30 + sin(t * 0.37) * 0.14,
    y,
    a_seed.z + cos(t * 0.83) * 0.24
  );

  vec4 viewPos = u_view * vec4(world, 1.0);
  gl_Position  = u_proj * viewPos;

  float dist = max(0.35, -viewPos.z);
  gl_PointSize = (u_pixelScale * (0.55 + fract(seed * 3.77) * 1.55)) / dist;

  // Depth fog. The volume spans roughly 4–20 units from the camera, so the
  // ramp has to cover that: a tighter one crushes everything mid-field and the
  // whole layer reads as empty.
  float fog = smoothstep(26.0, 3.0, dist);
  // Slow twinkle, never fully extinguishing.
  float twinkle = 0.58 + 0.42 * sin(u_time * 0.55 + seed * 12.9);

  v_glow = fog * twinkle;
  v_warm = fract(seed * 19.13);
}
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;

in float v_glow;
in float v_warm;

uniform vec3 u_gold;
uniform vec3 u_warm;
uniform float u_intensity;

out vec4 outColor;

void main() {
  // Soft radial falloff — a round mote with no hard edge.
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  // Bright core with a soft halo. A steeper falloff makes pinpricks; a flatter
  // one makes discs. 1.8 lands on "mote".
  float alpha = pow(1.0 - r * 2.0, 1.8);

  // A minority of motes run warmer, so the field is not one flat gold.
  vec3 tint = mix(u_gold, u_warm, smoothstep(0.72, 1.0, v_warm));

  // Premultiplied: colour is already scaled by coverage here, which is why the
  // blend func is ONE/ONE rather than SRC_ALPHA/ONE. Multiplying by alpha in
  // both places squares it, and the whole field disappears.
  float a = alpha * v_glow * u_intensity;
  outColor = vec4(tint * a, a);
}
`;

const COUNT = 1800;

export interface GroveProps {
  /** Overall brightness. Lower behind dense content. */
  intensity?: number;
  className?: string;
}

/**
 * @param intensity Multiplier on mote brightness (default 1). Behind text-heavy
 *                  panels, 0.5–0.7 keeps contrast comfortably above AA.
 */
export default function Grove({ intensity = 1, className = '' }: GroveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerMove = (e: PointerEvent) => {
      // Normalised to roughly [-1,1]; the camera only leans a few degrees.
      pointer.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (!reduced) window.addEventListener('pointermove', onPointerMove, { passive: true });

    const teardown = mountScene(canvas, {
      still: !!reduced,
      setup: (gl) => {
        const program = createProgram(gl, VERT, FRAG);
        if (!program) return null;

        // Stable pseudo-random field. A fixed sequence rather than Math.random
        // so the composition is the same every mount — this is art direction,
        // not noise, and a layout that reshuffles on every navigation reads as
        // a glitch.
        const seeds = new Float32Array(COUNT * 4);
        let s = 0x2f6e2b1;
        const rnd = () => {
          s = (s * 1664525 + 1013904223) >>> 0;
          return s / 4294967296;
        };
        for (let i = 0; i < COUNT; i++) {
          // A wide slab, not a cylinder. Every surface this sits behind is a
          // banner — roughly 6:1 — and a cylinder viewed through that aspect
          // bunches all its density into a band across the middle with empty
          // corners. The slab is wider than the frame at every breakpoint, so
          // the field runs edge to edge.
          seeds[i * 4 + 0] = (rnd() * 2 - 1) * 17;
          seeds[i * 4 + 1] = rnd() * 9;
          // Depth spread is what the perspective divide turns into scale
          // variation — near motes read as soft bokeh, far ones as pinpricks.
          seeds[i * 4 + 2] = -9 + rnd() * 11;
          seeds[i * 4 + 3] = rnd();
        }

        const vao = gl.createVertexArray();
        const vbo = gl.createBuffer();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(program, 'a_seed');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);

        const u = {
          proj: gl.getUniformLocation(program, 'u_proj'),
          view: gl.getUniformLocation(program, 'u_view'),
          time: gl.getUniformLocation(program, 'u_time'),
          pixelScale: gl.getUniformLocation(program, 'u_pixelScale'),
          gold: gl.getUniformLocation(program, 'u_gold'),
          warm: gl.getUniformLocation(program, 'u_warm'),
          intensity: gl.getUniformLocation(program, 'u_intensity'),
        };

        const gold = hexToRgb(BRAND.gold);
        const warm = hexToRgb(BRAND.goldLight);

        gl.enable(gl.BLEND);
        // Additive over a premultiplied source — see the fragment shader.
        gl.blendFunc(gl.ONE, gl.ONE);

        return {
          render: (time, width, height) => {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(program);
            gl.bindVertexArray(vao);

            // Ease the camera toward the pointer so it glides rather than snaps.
            const p = pointer.current;
            p.x += (p.tx - p.x) * 0.035;
            p.y += (p.ty - p.y) * 0.035;

            // A sway, not an orbit: ~100s to cross and return. Circling a slab
            // would swing it edge-on and flatten the parallax; this keeps the
            // field facing us while near and far motes still shear past each
            // other, which is the entire depth cue.
            const sway = reduced ? 0.25 : Math.sin(time * 0.063) * 0.55;
            const eye: [number, number, number] = [
              sway * 3.2 + p.x * 1.6,
              1.0 - p.y * 0.8,
              6.5,
            ];

            gl.uniformMatrix4fv(u.proj, false, perspective(0.85, width / height, 0.1, 60));
            gl.uniformMatrix4fv(u.view, false, lookAt(eye, [sway * 0.6, 0.4, -3]));
            gl.uniform1f(u.time, reduced ? 8 : time);
            gl.uniform1f(u.pixelScale, height * 0.135);
            gl.uniform3fv(u.gold, gold);
            gl.uniform3fv(u.warm, warm);
            gl.uniform1f(u.intensity, intensity);

            gl.drawArrays(gl.POINTS, 0, COUNT);
          },
          dispose: () => {
            gl.deleteBuffer(vbo);
            gl.deleteVertexArray(vao);
            gl.deleteProgram(program);
          },
        };
      },
    });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      teardown?.();
    };
  }, [reduced, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    />
  );
}
