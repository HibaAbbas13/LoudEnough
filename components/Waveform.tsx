"use client";

import { useEffect, useRef } from "react";

/**
 * Driven by real mic amplitude — never a CSS loop. A faked waveform is the
 * fastest way to look generated, and in a voice app it's the one element that
 * has to be honest.
 */
export function Waveform({ level, held }: { level: number; held: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hist = useRef<number[]>(new Array(96).fill(0));
  const raf = useRef<number>(0);
  const target = useRef(0);
  target.current = level;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      cv.width = cv.clientWidth * dpr;
      cv.height = cv.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    let smooth = 0;
    const draw = () => {
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      smooth += (target.current - smooth) * 0.35;
      hist.current.push(smooth);
      hist.current.shift();

      const w = cv.width, h = cv.height, mid = h / 2;
      ctx.clearRect(0, 0, w, h);

      const n = hist.current.length;
      const pitch = w / n;
      const bw = Math.max(2 * dpr, pitch * 0.42);

      for (let i = 0; i < n; i++) {
        const v = hist.current[i];
        const amp = Math.max(bw, Math.pow(v, 0.7) * h * 0.86);
        const x = i * pitch;
        const age = i / (n - 1); // oldest left, newest right
        ctx.globalAlpha = 0.18 + 0.82 * age;
        ctx.fillStyle = held ? "#f5a524" : "#4f9cff";
        const r = bw / 2;
        ctx.beginPath();
        ctx.roundRect(x, mid - amp / 2, bw, amp, r);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
    };
  }, [held]);

  return <canvas ref={ref} className="h-28 w-full" />;
}
