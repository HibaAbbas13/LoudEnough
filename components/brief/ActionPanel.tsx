"use client";

import type { DraftKind } from "@/lib/assembly/useVoiceAgent";

/**
 * The turn from understanding into something usable.
 *
 * These buttons exist because the voice path shouldn't be the only path —
 * they call exactly the same function the agent's draft_message tool calls,
 * so a judge with a broken microphone still reaches the same output. Saying
 * "write it up" out loud and clicking here are the same code path.
 */
const OPTIONS: { kind: DraftKind; title: string; sub: string; primary?: boolean }[] = [
  { kind: "formal_message", title: "Prepare a formal message", sub: "An email you can send as it is", primary: true },
  { kind: "phone_script", title: "Create a phone script", sub: "What to say, in order, out loud" },
  { kind: "summary", title: "Make a clear summary", sub: "The situation, plainly stated" },
];

export function ActionPanel({
  onChoose, onReset, busy,
}: {
  onChoose: (kind: DraftKind) => void;
  onReset: () => void;
  busy: boolean;
}) {
  return (
    <section aria-labelledby="action" className="mx-auto w-full max-w-xl">
      <h2 id="action" className="said fade text-center text-[26px] leading-tight sm:text-[32px]">
        You&rsquo;ve been heard.
      </h2>
      <p className="mt-2 text-center text-[14px] text-[var(--text-soft)]">
        What should we do with it?
      </p>

      <div className="mt-7 space-y-2">
        {OPTIONS.map((o, i) => (
          <button
            key={o.kind}
            type="button"
            onClick={() => onChoose(o.kind)}
            disabled={busy}
            className="rise group flex w-full items-center justify-between gap-4 rounded-lg border px-5 py-4 text-left transition-all duration-300 disabled:opacity-40"
            style={{
              animationDelay: `${i * 70}ms`,
              borderColor: o.primary ? "var(--signal)" : "var(--edge)",
              background: o.primary ? "var(--signal-dim)" : "transparent",
            }}
          >
            <span>
              <span className="block text-[16px] leading-snug text-[var(--text)]">{o.title}</span>
              <span className="mt-0.5 block text-[13px] text-[var(--text-faint)]">{o.sub}</span>
            </span>
            <span
              aria-hidden="true"
              className="shrink-0 text-[var(--text-faint)] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-[var(--signal)]"
            >
              &rarr;
            </span>
          </button>
        ))}
      </div>

      <p className="mt-5 text-center text-[12.5px] text-[var(--text-faint)]">
        Or just say it &mdash; &ldquo;write it up for me&rdquo; &mdash; while the mic is still open.
      </p>

      <button
        type="button"
        onClick={onReset}
        className="mx-auto mt-6 block text-[13px] text-[var(--text-faint)] underline underline-offset-4 transition-colors hover:text-[var(--text-soft)]"
      >
        Start over
      </button>
    </section>
  );
}
