"use client";

import { useState } from "react";
import type { Draft } from "@/lib/assembly/useVoiceAgent";

/**
 * The finished thing, with its gaps left visible.
 *
 * Placeholders are rendered as gaps rather than filled with plausible defaults,
 * and they are highlighted rather than hidden. A message that invents "March
 * 14th" reads better and is worse — the user would send a date they never gave
 * us. Marking the hole is the honest version, and it also tells them exactly
 * what to do before hitting send.
 */
const TITLES: Record<Draft["kind"], string> = {
  formal_message: "Ready to send",
  phone_script: "Ready to say",
  summary: "Your summary",
};

/** Splits on [BRACKETED] runs so they can be styled as real gaps. */
function marked(body: string) {
  return body.split(/(\[[^\]]+\])/g).map((part, i) =>
    part.startsWith("[") && part.endsWith("]") ? (
      <mark
        key={i}
        className="rounded-[3px] px-1 py-0.5 font-medium"
        style={{ background: "var(--signal-dim)", color: "var(--signal)" }}
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function MessageView({
  draft, onReset, onBack,
}: {
  draft: Draft;
  onReset: () => void;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = draft.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : draft.body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="ready" className="mx-auto w-full max-w-xl">
      <h2 id="ready" className="said fade text-center text-[30px] leading-tight sm:text-[38px]">
        {TITLES[draft.kind]}
      </h2>

      <article className="fade mt-8 rounded-lg border border-[var(--edge)] bg-[var(--raised)] p-6 sm:p-7">
        {draft.subject && (
          <>
            <p className="label">Subject</p>
            <p className="mt-1.5 text-[17px] leading-snug text-[var(--text)]">{draft.subject}</p>
            <hr className="my-5 border-[var(--edge)]" />
          </>
        )}
        <div className="whitespace-pre-wrap text-[15.5px] leading-[1.7] text-[var(--text-soft)]">
          {marked(draft.body)}
        </div>
      </article>

      {draft.placeholders.length > 0 && (
        <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-faint)]">
          <span style={{ color: "var(--signal)" }}>
            {draft.placeholders.length} {draft.placeholders.length === 1 ? "detail" : "details"} to fill in.
          </span>{" "}
          These weren&rsquo;t in what you told me, so they were left blank rather than guessed.
        </p>
      )}

      <div className="no-print mt-7 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-md px-5 py-2.5 text-[14px] font-medium text-[var(--void)] transition-opacity hover:opacity-90"
          style={{ background: "var(--signal)" }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-[var(--edge)] px-5 py-2.5 text-[14px] text-[var(--text-soft)] transition-colors hover:text-[var(--text)]"
        >
          Something else
        </button>
        <button
          type="button"
          onClick={onReset}
          className="ml-auto text-[13px] text-[var(--text-faint)] underline underline-offset-4 transition-colors hover:text-[var(--text-soft)]"
        >
          Start over
        </button>
      </div>
    </section>
  );
}
