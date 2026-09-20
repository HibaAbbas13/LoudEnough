"use client";

import { useEffect, useRef } from "react";

/**
 * What is being said, while it is being said.
 *
 * Not a chat log: there are no bubbles, no avatars and no timestamps, and only
 * the last few lines survive on screen. The point is to show that the system
 * is hearing you, then get out of the way — the moment worth looking at is the
 * brief, not the backlog.
 *
 * Earlier lines fade toward the top rather than scrolling away, so the screen
 * never fills with text the user has stopped caring about.
 */
export function LiveTranscript({
  said, partial, agentLine, speaking,
}: {
  said: string[];
  partial: string;
  agentLine: string;
  speaking: boolean;
}) {
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [said.length, partial, agentLine]);

  const recent = said.slice(-3);
  const nothingYet = !recent.length && !partial && !agentLine;

  if (nothingYet) {
    return (
      <p className="mx-auto max-w-xl text-center text-[15px] leading-relaxed text-[var(--text-faint)]">
        Talk it out. It doesn&rsquo;t have to come out right.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="space-y-3 text-center">
        {recent.map((line, i) => (
          <p
            key={`${i}-${line.slice(0, 12)}`}
            className="said rise text-[19px] leading-[1.55] transition-opacity duration-700 sm:text-[21px]"
            // Older lines recede instead of scrolling off.
            style={{ opacity: [0.28, 0.55, 1][i + (3 - recent.length)] ?? 1 }}
          >
            {line}
          </p>
        ))}

        {partial && (
          <p className="said text-[19px] leading-[1.55] text-[var(--text-soft)] sm:text-[21px]">
            {partial}
            <span className="caret" />
          </p>
        )}
      </div>

      {agentLine && (
        <p
          className="fade mx-auto mt-7 max-w-md border-t border-[var(--edge)] pt-5 text-center text-[14px] leading-relaxed text-[var(--text-soft)] transition-colors duration-500"
          style={{ color: speaking ? "var(--signal)" : undefined }}
        >
          {agentLine}
        </p>
      )}

      <div ref={end} />
    </div>
  );
}
