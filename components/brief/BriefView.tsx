"use client";

import { useState } from "react";
import type { Brief, Grounded } from "@/lib/brief";

function Row({ label, field, delay }: { label: string; field: Grounded | null; delay: number }) {
  const [open, setOpen] = useState(false);
  if (!field) return null;

  return (
    <div className="rise border-t border-[var(--edge)] py-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="label shrink-0">{label}</p>
        {field.verified ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="label text-[9px] text-[var(--text-faint)] transition-colors hover:text-[var(--signal)]"
          >
            {open ? "Hide" : "Your words"}
          </button>
        ) : (
          <span className="label text-[9px]" style={{ color: "var(--warn)" }}>
            Unverified
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[17px] leading-snug text-[var(--text)] sm:text-[19px]">
        {field.value}
      </p>

      {open && field.verified && (
        <p className="said fade mt-2.5 border-l border-[var(--signal)] pl-3 text-[15px] italic leading-relaxed text-[var(--text-soft)]">
          &ldquo;{field.quote}&rdquo;
        </p>
      )}

      {!field.verified && (
        <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--warn)" }}>
          This didn&rsquo;t match anything you said, so it won&rsquo;t be used in anything we write.
        </p>
      )}
    </div>
  );
}

export function BriefView({ brief }: { brief: Brief }) {
  const verifiedFacts = brief.facts.filter((f) => f.verified);

  return (
    <section aria-labelledby="heard" className="mx-auto w-full max-w-xl">
      <h2 id="heard" className="said fade text-center text-[34px] leading-none sm:text-[44px]">
        I heard you.
      </h2>
      <p className="label mt-3 text-center">Based on what you told me</p>

      <div className="mt-8">
        <Row label="Problem" field={brief.problem} delay={0} />
        <Row label="History" field={brief.history} delay={70} />
        <Row label="Impact" field={brief.impact} delay={140} />
        <Row label="Desired outcome" field={brief.desiredOutcome} delay={210} />

        {verifiedFacts.length > 0 && (
          <div className="rise border-t border-[var(--edge)] py-4" style={{ animationDelay: "280ms" }}>
            <p className="label">Details</p>
            <ul className="mt-2 space-y-1.5">
              {verifiedFacts.map((f, i) => (
                <li key={i} className="flex gap-2.5 text-[15px] leading-snug text-[var(--text-soft)]">
                  <span aria-hidden="true" className="mt-[9px] size-1 shrink-0 rounded-full bg-[var(--signal)]" />
                  {f.value}
                </li>
              ))}
            </ul>
          </div>
        )}

        {brief.missing.length > 0 && (
          <div className="rise border-t border-[var(--edge)] py-4" style={{ animationDelay: "350ms" }}>
            <p className="label">Missing</p>
            <ul className="mt-2 space-y-1.5">
              {brief.missing.map((m, i) => (
                <li key={i} className="flex gap-2.5 text-[15px] leading-snug text-[var(--text-faint)]">
                  <span
                    aria-hidden="true"
                    className="mt-[8px] size-1 shrink-0 rounded-full border border-[var(--text-faint)]"
                  />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}

        {brief.nextAction && (
          <div className="rise border-t border-[var(--edge)] py-4" style={{ animationDelay: "420ms" }}>
            <p className="label">Next action</p>
            <p className="mt-1.5 text-[17px] leading-snug">{brief.nextAction}</p>
          </div>
        )}
      </div>

      <p className="mt-5 border-t border-[var(--edge)] pt-4 text-[12.5px] leading-relaxed text-[var(--text-faint)]">
        {brief.unverified > 0 ? (
          <>
            {brief.unverified} {brief.unverified === 1 ? "item" : "items"} couldn&rsquo;t be matched to
            your words and {brief.unverified === 1 ? "is" : "are"} marked above. Nothing unverified goes
            into a message.
          </>
        ) : (
          <>Every line above was matched to something you actually said.</>
        )}
      </p>
    </section>
  );
}
