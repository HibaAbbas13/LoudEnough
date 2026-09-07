"use client";

import { useMemo, useState } from "react";
import { Waveform } from "@/components/Waveform";
import { useRoomStream } from "@/lib/useRoomStream";

const SPEAKER_COLORS = ["var(--spk-a)", "var(--spk-b)", "var(--spk-c)", "var(--spk-d)"];

export default function Page() {
  const [addressingEnabled, setAddressingEnabled] = useState(true);
  const [agentName] = useState("Echo");
  const [openId, setOpenId] = useState<string | null>(null);

  const room = useRoomStream({ agentName, maxSpeakers: 3, addressingEnabled });

  const colorFor = useMemo(() => {
    const map = new Map<string, string>();
    room.speakers.forEach((s, i) => map.set(s, SPEAKER_COLORS[i % SPEAKER_COLORS.length]));
    return (s: string) => map.get(s) ?? "var(--dim)";
  }, [room.speakers]);

  // Amber means one thing only: the agent decided this was not for it.
  const last = room.utterances[room.utterances.length - 1];
  const holding = !!last && !last.addressed && !room.partial;

  const answered = room.utterances.filter((u) => u.addressed).length;
  const heldBack = room.utterances.length - answered;

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-8 py-12">
      <header className="flex items-start justify-between">
        <div>
          <p className="eyebrow">AssemblyAI Voice Agent Hackathon · 2026</p>
          <h1 className="mt-3 text-5xl font-bold tracking-tight">Loud Enough</h1>
          <p className="mt-2 max-w-lg text-[15px] text-[var(--muted)]">
            Every voice agent assumes one user. This one sits in a room, tracks who is
            speaking, and answers only when it&apos;s actually being spoken to.
          </p>
        </div>
        {room.latencyMs !== null && (
          <div className="text-right">
            <div className="num text-2xl text-[var(--text)]">{room.latencyMs}<span className="text-sm text-[var(--dim)]">ms</span></div>
            <p className="eyebrow mt-1">turn latency</p>
          </div>
        )}
      </header>

      {/* The comparison toggle is the pitch, so it gets the weight. */}
      <section className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium">Addressing detection</p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              {addressingEnabled
                ? "Agent decides whether each turn was meant for it."
                : "Naive mode — the agent answers every single turn, like every other voice agent."}
            </p>
          </div>
          <button
            onClick={() => setAddressingEnabled((v) => !v)}
            role="switch"
            aria-checked={addressingEnabled}
            className="relative flex h-9 w-[188px] shrink-0 rounded-lg border border-[var(--line)] bg-[var(--ground)] p-1 text-[12px] font-medium"
          >
            <span
              className="absolute inset-y-1 w-[88px] rounded-md bg-[var(--surface-2)] transition-transform duration-200"
              style={{
                transitionTimingFunction: "var(--ease)",
                transform: addressingEnabled ? "translateX(90px)" : "translateX(0)",
              }}
            />
            <span className={`relative z-10 grid flex-1 place-items-center ${!addressingEnabled ? "text-[var(--text)]" : "text-[var(--dim)]"}`}>Naive</span>
            <span className={`relative z-10 grid flex-1 place-items-center ${addressingEnabled ? "text-[var(--signal)]" : "text-[var(--dim)]"}`}>Addressed</span>
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 pb-3 pt-5">
        <Waveform level={room.level} held={holding} />

        <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-3">
          <div className="flex items-center gap-2">
            {room.speakers.length === 0 && (
              <span className="text-[13px] text-[var(--dim)]">No speakers detected yet</span>
            )}
            {room.speakers.map((s) => (
              <span
                key={s}
                className="flex items-center gap-1.5 rounded-md border border-[var(--line)] px-2 py-1 text-[12px]"
              >
                <i className="size-1.5 rounded-full" style={{ background: colorFor(s) }} />
                Speaker {s}
              </span>
            ))}
          </div>

          {!room.connected ? (
            <div className="flex items-center gap-2">
              {/* Replay costs nothing — use it for every UI and prompt iteration. */}
              <button
                onClick={() => room.replay("sample-consult")}
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--text)]"
                title="Replay a recorded session — no microphone, no API spend"
              >
                Replay
              </button>
              {room.hasRecording && (
                <button
                  onClick={() => room.exportFixture("sample-consult")}
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--text)]"
                  title="Save this session as a fixture"
                >
                  Save
                </button>
              )}
              <button
                onClick={room.start}
                className="rounded-lg bg-[var(--signal)] px-4 py-2 text-[13px] font-semibold text-[#04101f] transition-opacity hover:opacity-90"
              >
                Start listening
              </button>
            </div>
          ) : (
            <button
              onClick={room.stop}
              className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--text)]"
            >
              Stop
            </button>
          )}
        </div>
      </section>

      {room.error && (
        <p className="mt-4 rounded-lg border border-[var(--miss)]/30 bg-[var(--miss)]/10 px-4 py-3 text-[13px] text-[var(--miss)]">
          {room.error}
        </p>
      )}

      {room.utterances.length > 0 && (
        <p className="mt-8 text-[13px] text-[var(--muted)]">
          <span className="num text-[var(--text)]">{answered}</span> answered ·{" "}
          <span className="num text-[var(--patience)]">{heldBack}</span> held back
        </p>
      )}

      <section className="mt-4 space-y-1">
        {room.utterances.map((u) => (
          <div key={u.id}>
            <button
              onClick={() => setOpenId(openId === u.id ? null : u.id)}
              className="flex w-full gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface)]"
            >
              <span
                className="mt-1.5 size-2 shrink-0 rounded-full"
                style={{
                  background: u.speakerPending ? "transparent" : colorFor(u.speaker),
                  boxShadow: u.speakerPending ? `inset 0 0 0 1.5px ${"var(--dim)"}` : undefined,
                }}
                title={u.speakerPending ? "Speaker not yet resolved" : `Speaker ${u.speaker}`}
              />
              <span className={`flex-1 text-[15px] leading-relaxed ${u.addressed ? "text-[var(--text)]" : "text-[var(--dim)]"}`}>
                {u.text}
              </span>
              <span
                className={`num mt-0.5 shrink-0 text-[11px] ${u.addressed ? "text-[var(--signal)]" : "text-[var(--patience)]"}`}
              >
                {u.addressed ? "ANSWERED" : "HELD"} {(u.addressScore * 100).toFixed(0)}
              </span>
            </button>

            {/* Inline expansion, not a modal — a voice app shouldn't seize the floor. */}
            {openId === u.id && (
              <p className="mb-2 ml-8 border-l border-[var(--line)] pl-3 text-[13px] text-[var(--muted)]">
                {u.reason}
              </p>
            )}
          </div>
        ))}

        {room.partial && (
          <div className="flex gap-3 px-3 py-2.5">
            <span
              className="breathing mt-1.5 size-2 shrink-0 rounded-full"
              style={{ background: colorFor(room.partialSpeaker ?? "A") }}
            />
            <span className="flex-1 text-[15px] leading-relaxed text-[var(--muted)]">{room.partial}</span>
          </div>
        )}
      </section>
    </main>
  );
}
