"use client";

import type { Phase, Stage } from "@/lib/assembly/useVoiceAgent";

export function StatusLine({
  phase, stage, clarifying, drafting, cutIn,
}: {
  phase: Phase;
  stage: Stage;

  clarifying: boolean;
  drafting: boolean;

  cutIn: boolean;
}) {
  let text: string;

  if (phase === "error") text = "Something interrupted the conversation.";
  else if (phase === "idle") text = stage === "complete" ? "You're ready to send." : "Ready when you are.";
  else if (phase === "connecting") text = "Connecting…";
  else if (drafting) text = "Putting it into words…";
  else if (phase === "speaking") text = clarifying ? "One thing I need to know…" : "Speaking — talk over it to cut in.";
  else if (cutIn && phase === "listening") text = "Stopped. Go ahead.";
  else if (phase === "thinking") text = "Making sense of that…";
  else if (stage === "complete") text = "You're ready to send.";
  else if (stage === "action") text = "What should we do with it?";
  else text = "Listening — pause when you're done.";

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
