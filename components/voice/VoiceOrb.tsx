"use client";

import { useEffect, useRef } from "react";
import type { Phase } from "@/lib/assembly/useVoiceAgent";

const LOBES = [
  { k: 2, speed: 0.00021, weight: 1 },
  { k: 3, speed: -0.00017, weight: 0.48 },
  { k: 5, speed: 0.00011, weight: 0.22 },
];

export function VoiceOrb({
  phase,
  level,
  onClick,
  disabled,
  size = "clamp(140px, min(16vw, 20vh), 220px)",
}: {
  phase: Phase;

  level: number;
  onClick?: () => void;
  disabled?: boolean;

  size?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  const phaseRef = useRef(phase);
  const levelRef = useRef(level);
  useEffect(() => {
    phaseRef.current = phase;
    levelRef.current = level;
  }, [phase, level]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let smoothed = 0;
    let breath = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (t: number) => {
      const box = canvas.getBoundingClientRect();
      const w = box.width;
      const h = box.height;
      const cx = w / 2;
      const cy = h / 2;

      const base = Math.min(w, h) * 0.208;

      g.clearRect(0, 0, w, h);

      const p = phaseRef.current;
      const live = p === "listening" || p === "speaking";

      const target = live ? Math.min(1, levelRef.current * 1.55) : 0;
      smoothed += (target - smoothed) * (target > smoothed ? 0.32 : 0.06);

      breath += reduced ? 0 : 0.0007;
      const breathe = Math.sin(breath) * 0.5 + 0.5;

      const deform =
        p === "thinking" ? 0.042 :
        p === "connecting" ? 0.018 :
        live ? 0.012 + smoothed * 0.075 :
        0.007 + breathe * 0.006;

      const scale =
        p === "thinking" ? 1 + breathe * 0.015 :
        live ? 1 + smoothed * 0.2 :
        0.982 + breathe * 0.036;

      const rate = p === "thinking" ? 5.5 : p === "connecting" ? 2.4 : 1;
      const time = reduced ? 0 : t * rate;

      const warm = p === "speaking" ? 1 : live ? 0.72 : 0.4;

      const radiusAt = (a: number) => {
        let r = 1;
        for (const l of LOBES) r += Math.sin(a * l.k + time * l.speed * 1000) * deform * l.weight;
        return base * scale * r;
      };

      const glow = g.createRadialGradient(cx, cy, base * 0.6, cx, cy, base * 2.15);
      glow.addColorStop(0, `rgba(232, 160, 84, ${0.17 * warm + smoothed * 0.26})`);
      glow.addColorStop(0.45, `rgba(232, 160, 84, ${0.05 * warm})`);
      glow.addColorStop(1, "rgba(232, 160, 84, 0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);

      const STEPS = 96;
      const pts: [number, number][] = [];
      for (let i = 0; i < STEPS; i++) {
        const a = (i / STEPS) * Math.PI * 2;
        const r = radiusAt(a);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }

      const mid = (i: number, j: number): [number, number] => [
        (pts[i][0] + pts[j][0]) / 2,
        (pts[i][1] + pts[j][1]) / 2,
      ];

      g.beginPath();
      const first = mid(STEPS - 1, 0);
      g.moveTo(first[0], first[1]);
      for (let i = 0; i < STEPS; i++) {
        const next = mid(i, (i + 1) % STEPS);
        g.quadraticCurveTo(pts[i][0], pts[i][1], next[0], next[1]);
      }
      g.closePath();

      const fill = g.createRadialGradient(
        cx - base * 0.28, cy - base * 0.32, base * 0.08,
        cx, cy, base * 1.25,
      );
      fill.addColorStop(0, `rgba(255, 231, 200, ${0.16 + smoothed * 0.34})`);
      fill.addColorStop(0.55, `rgba(232, 160, 84, ${0.085 + smoothed * 0.18})`);
      fill.addColorStop(1, "rgba(232, 160, 84, 0.028)");
      g.fillStyle = fill;
      g.fill();

      g.strokeStyle = `rgba(244, 186, 124, ${0.34 + warm * 0.3 + smoothed * 0.34})`;
      g.lineWidth = 1;
      g.stroke();

      if (smoothed > 0.01) {
        const core = g.createRadialGradient(cx, cy, 0, cx, cy, base * (0.42 + smoothed * 0.3));
        core.addColorStop(0, `rgba(255, 240, 220, ${smoothed * 0.4})`);
        core.addColorStop(1, "rgba(255, 240, 220, 0)");
        g.fillStyle = core;
        g.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const label =
    phase === "idle" ? "Start speaking" :
    phase === "connecting" ? "Connecting" :
    phase === "speaking" ? "Loud Enough is speaking" :
    phase === "thinking" ? "Working on what you said" :
    "Listening — tap to stop";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{ width: size }}
      className="group relative block aspect-square max-w-[78vw] rounded-full transition-transform duration-500 active:scale-[0.97] disabled:cursor-default"
    >
      <canvas
        ref={ref}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[220%] w-[220%] -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
      />
    </button>
  );
}
