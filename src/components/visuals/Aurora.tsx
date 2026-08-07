/**
 * Aurora — a slow, domain-warped mesh gradient.
 *
 * Two octaves of value noise warp the sample point before a third reads the
 * field, which is what turns concentric blobs into something that folds like
 * silk. It is the cheapest way to get a surface that looks lit rather than
 * filled: one fullscreen triangle, no geometry, no texture.
 *
 * Used behind headers and hero panels where `Grove`'s depth would compete with
 * dense content. Where Grove is space, this is material.
 */
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../lib/motion';
import { createProgram, hexToRgb, mountScene } from '../../lib/gl';

// One oversized triangle rather than a quad: no diagonal seam, three vertices
// instead of six, and no index buffer.
const VERT = /* glsl */ `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

uniform float u_time;
uniform vec2  u_res;
uniform vec3  u_deep;
uniform vec3  u_mid;
uniform vec3  u_accent;
uniform float u_alpha;

out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  vec2 p = uv * vec2(u_res.x / max(u_res.y, 1.0), 1.0) * 2.4;

  float t = u_time * 0.021;

  // Domain warp: sample the field through an offset built from the field.
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(4.3, -t * 0.8)));
  vec2 r = vec2(
    fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.6),
    fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.5)
  );
  float f = fbm(p + 3.4 * r);

  vec3 col = mix(u_deep, u_mid, smoothstep(0.18, 0.82, f));
  // Accent only in the brightest folds, so gold stays an event.
  col = mix(col, u_accent, smoothstep(0.72, 1.05, f + r.x * 0.32) * 0.55);

  // Vignette — pulls the eye to centre and keeps edges from banding.
  float vig = smoothstep(1.25, 0.25, length(uv - 0.5) * 1.6);

  outColor = vec4(col, u_alpha * vig);
}
`;

export interface AuroraProps {
  /** Darkest colour of the field. */
  deep?: string;
  /** Mid tone the field spends most of its range in. */
  mid?: string;
  /** Highlight, applied only in the brightest folds. */
  accent?: string;
  /** Overall opacity (default 1). */
  alpha?: number;
  className?: string;
}

export default function Aurora({
  deep = '#0f2419',
  mid = '#1a3d2b',
  accent = '#c49a2c',
  alpha = 1,
  className = '',
}: AuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    return mountScene(canvas, {
      still: !!reduced,
      // Smooth gradients need far less than retina; halving DPR here is free.
      maxDpr: 1.25,
      setup: (gl) => {
        const program = createProgram(gl, VERT, FRAG);
        if (!program) return null;

        // gl_VertexID needs a bound VAO even with no attributes.
        const vao = gl.createVertexArray();

        const u = {
          time: gl.getUniformLocation(program, 'u_time'),
          res: gl.getUniformLocation(program, 'u_res'),
          deep: gl.getUniformLocation(program, 'u_deep'),
          mid: gl.getUniformLocation(program, 'u_mid'),
          accent: gl.getUniformLocation(program, 'u_accent'),
          alpha: gl.getUniformLocation(program, 'u_alpha'),
        };

        const cDeep = hexToRgb(deep);
        const cMid = hexToRgb(mid);
        const cAccent = hexToRgb(accent);

        return {
          render: (time, width, height) => {
            gl.useProgram(program);
            gl.bindVertexArray(vao);
            // A frozen field still wants an interesting frame, not t=0.
            gl.uniform1f(u.time, reduced ? 120 : time);
            gl.uniform2f(u.res, width, height);
            gl.uniform3fv(u.deep, cDeep);
            gl.uniform3fv(u.mid, cMid);
            gl.uniform3fv(u.accent, cAccent);
            gl.uniform1f(u.alpha, alpha);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
          },
          dispose: () => {
            gl.deleteVertexArray(vao);
            gl.deleteProgram(program);
          },
        };
      },
    }) ?? undefined;
  }, [reduced, deep, mid, accent, alpha]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    />
  );
}
