"use client";

import type { Phase, Stage } from "@/lib/assembly/useVoiceAgent";

/**
 * One line of text that always says what the system is doing.
 *
 * It is also the screen-reader channel for the whole voice interaction, which
 * is why it is a live region: someone who can't see the orb breathing still
 * needs to know whether they are being heard.
 */
export function StatusLine({
  phase, stage, clarifying, drafting,
}: {
  phase: Phase;
  stage: Stage;
  /** The agent's last reply was a question. */
  clarifying: boolean;
  drafting: boolean;
}) {
  let text: string;

  if (phase === "error") text = "Something interrupted the conversation.";
  else if (phase === "idle") text = stage === "complete" ? "You're ready to send." : "Ready when you are.";
  else if (phase === "connecting") text = "Connecting…";
  else if (drafting) text = "Putting it into words…";
  else if (phase === "speaking") text = clarifying ? "One thing I need to know…" : "Loud Enough is speaking…";
  else if (phase === "thinking") text = "Making sense of that…";
  else if (stage === "complete") text = "You're ready to send.";
  else if (stage === "action") text = "What should we do with it?";
  else text = "Listening…";

  return (
    <p
      role="status"
      aria-live="polite"
      className="label h-4 text-center transition-colors duration-500"
      style={{ color: phase === "error" ? "var(--warn)" : undefined }}
    >
      {text}
    </p>
  );
}
