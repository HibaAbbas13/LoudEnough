"use client";

import { useState } from "react";
import { useVoiceAgent, type Draft } from "@/lib/assembly/useVoiceAgent";
import { VoiceOrb } from "@/components/voice/VoiceOrb";
import { StatusLine } from "@/components/voice/StatusLine";
import { LiveTranscript } from "@/components/voice/LiveTranscript";
import { BriefView } from "@/components/brief/BriefView";
import { ActionPanel } from "@/components/brief/ActionPanel";
import { MessageView } from "@/components/brief/MessageView";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ThePoint } from "@/components/landing/ThePoint";

/**
 * One page, four moments: the invitation, the listening, the understanding,
 * and the thing you can send.
 *
 * They are not routes and not tabs. The wordmark shrinks, the orb moves up,
 * and the brief rises underneath it — so the transition reads as the same
 * conversation continuing rather than a wizard advancing. Nothing here is a
 * dashboard, because at no point is the user administering anything.
 */
export default function Page() {
  const v = useVoiceAgent();
  // Which draft the user has stepped back from. Comparing against the current
  // one means a newly written draft shows itself without an effect to sync it.
  const [dismissed, setDismissed] = useState<Draft | null>(null);

  // Once a session has begun the huge type gets out of the way.
  const opened = v.phase !== "idle" || v.said.length > 0 || v.stage !== "open";

  // "One thing I need to know…" — inferred from the agent actually asking.
  const clarifying = v.agentLine.trim().endsWith("?");

  const level = v.phase === "speaking" ? v.agentLevel : v.micLevel;
  const showBrief = !!v.brief.problem;
  const showMessage = !!v.draft && v.draft !== dismissed;
  // Stepping back from a written draft has to land on the options again, so
  // this keys off having an actionable brief rather than off the furthest
  // stage reached — otherwise "something else" is a dead end.
  const showActions =
    (v.stage === "action" || v.stage === "complete") && !v.drafting && !showMessage;
  // What the user is actually looking at, which after stepping back is no
  // longer the same as how far they have got.
  const viewStage = showMessage ? "complete" : showActions ? "action" : v.stage;

  return (
    <>
      <main
        className={`relative z-10 flex min-h-dvh flex-col items-center px-6 pb-16 ${
          opened ? "justify-start pt-10 sm:pt-14" : "justify-center py-10"
        }`}
      >
        {/* Wordmark. Enormous until there is something more important on screen. */}
        <header
          className="w-full text-center transition-all duration-[900ms] ease-[var(--ease)]"
          style={{
            maxWidth: opened ? "100%" : "56rem",
            marginBottom: opened ? "0.5rem" : "0",
          }}
        >
          {opened ? (
            <button
              type="button"
              onClick={v.reset}
              className="label transition-colors hover:text-[var(--text-soft)]"
              aria-label="Loud Enough — start over"
            >
              Loud Enough
            </button>
          ) : (
            <>
              <h1 className="fade font-medium leading-[0.84] tracking-[-0.045em] text-[clamp(3rem,min(16vw,13vh),8.5rem)]">
                LOUD
                <br />
                ENOUGH
              </h1>
              <p className="said fade mt-5 text-[clamp(16px,2.4vh,21px)] italic leading-snug text-[var(--text-soft)]">
                You don&rsquo;t have to know how to say it.
              </p>
              <p className="fade mx-auto mt-2.5 max-w-sm text-[13.5px] leading-relaxed text-[var(--text-faint)]">
                Say it badly. Leave with something you can send.
              </p>
            </>
          )}
        </header>

        {/* The voice object. Always the centre of the composition. */}
        <div
          className="flex shrink-0 flex-col items-center"
          style={{ marginTop: opened ? "0.75rem" : "clamp(1rem, 3vh, 2rem)" }}
        >
          <VoiceOrb
            phase={v.phase}
            level={level}
            disabled={v.phase === "connecting"}
            onClick={() => (v.connected ? v.stop() : void v.start())}
          />
          <div className="mt-5">
            <StatusLine
              phase={v.phase}
              stage={viewStage}
              clarifying={clarifying}
              drafting={v.drafting}
              cutIn={v.cutIn}
            />
          </div>
        </div>

        {/* Entry controls, only before anything has been said. */}
        {!opened && (
          <div className="fade mt-6 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void v.start()}
              className="rounded-md px-7 py-3 text-[15px] font-medium text-[var(--void)] transition-opacity hover:opacity-90"
              style={{ background: "var(--signal)" }}
            >
              Start speaking
            </button>
            <button
              type="button"
              onClick={v.startDemo}
              className="text-[13px] text-[var(--text-faint)] underline underline-offset-4 transition-colors hover:text-[var(--text-soft)]"
            >
              Try a demo &mdash; no microphone needed
            </button>
          </div>
        )}

        {/* Errors, in human language, with a way out of every one. */}
        {v.error && (
          <div
            role="alert"
            className="fade mt-8 w-full max-w-md rounded-lg border px-5 py-4 text-center"
            style={{ borderColor: "rgba(212,113,90,0.35)", background: "rgba(212,113,90,0.06)" }}
          >
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--warn)" }}>
              {v.error}
            </p>
            <div className="mt-3 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => void v.start()}
                className="text-[13px] underline underline-offset-4"
                style={{ color: "var(--warn)" }}
              >
                Try again
              </button>
              {v.micDenied && (
                <button
                  type="button"
                  onClick={v.startDemo}
                  className="text-[13px] text-[var(--text-faint)] underline underline-offset-4 hover:text-[var(--text-soft)]"
                >
                  Continue without a microphone
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live transcript, while the understanding is still forming. */}
        {opened && !showBrief && !v.error && (
          <div className="mt-12 w-full">
            <LiveTranscript
              said={v.said}
              partial={v.partial}
              agentLine={v.agentLine}
              speaking={v.phase === "speaking"}
              cutIn={v.cutIn}
            />
          </div>
        )}

        {/* What the agent said, kept on screen once the brief takes over the
            transcript. Without this, everything the agent contributes is
            audio-only, and the product stops working for anyone who can't
            hear it. */}
        {v.agentLine && showBrief && (
          <div className="fade mx-auto mt-9 max-w-md text-center">
            <p
              className="text-[14px] leading-relaxed transition-colors duration-500"
              style={{ color: v.phase === "speaking" ? "var(--signal)" : "var(--text-soft)" }}
            >
              {v.agentLine}
            </p>
            {v.cutIn && <p className="label mt-3">You cut in</p>}
          </div>
        )}

        {/* The understanding. */}
        {showBrief && !showMessage && (
          <div className="mt-10 w-full">
            <BriefView brief={v.brief} />
          </div>
        )}

        {showActions && (
          <div className="mt-14 w-full border-t border-[var(--edge)] pt-12">
            <ActionPanel onChoose={v.chooseAction} onReset={v.reset} busy={v.drafting} />
          </div>
        )}

        {showMessage && v.draft && (
          <div className="mt-14 w-full">
            <MessageView
              draft={v.draft}
              onReset={v.reset}
              onBack={() => setDismissed(v.draft)}
            />
          </div>
        )}

        {/* Proof the tools are real, not decorative. */}
        {v.toolLog.length > 0 && (
          <p className="label mt-10 text-center">
            {v.toolLog.length} tool {v.toolLog.length === 1 ? "call" : "calls"} ·{" "}
            {v.toolLog.map((t) => t.name).join(" · ")}
          </p>
        )}

        {v.connected && opened && (
          <div className="mt-10 flex flex-col items-center gap-3">
            {v.phase === "listening" && (
              <button
                type="button"
                onClick={v.finishTurn}
                className="rounded-md px-7 py-3 text-[15px] font-medium text-[var(--void)] transition-opacity hover:opacity-90"
                style={{ background: "var(--signal)" }}
              >
                I&rsquo;m done talking
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setDismissed(null);
                v.reset();
              }}
              className="text-[13px] text-[var(--text-faint)] underline underline-offset-4 transition-colors hover:text-[var(--text-soft)]"
            >
              Start over
            </button>
          </div>
        )}
      </main>

      {!opened && (
        <div className="relative z-10 border-t border-[var(--edge)]">
          <ThePoint />
          <HowItWorks />
        </div>
      )}
    </>
  );
}
