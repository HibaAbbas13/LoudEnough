import type { ServerMessage } from "./types";

/**
 * Recorded sessions, so the whole pipeline can be developed and evaluated
 * without spending a cent on streaming.
 *
 * Three weeks of iterating on the summary prompt and the UI against a live
 * microphone costs far more than the demo itself ever will. Record a real
 * consultation once, then replay the exact same server messages through the
 * exact same handler as many times as you like. It also makes the eval
 * reproducible: same input, same decisions, every run.
 */
export interface Fixture {
  name: string;
  recordedAt: string;
  notes?: string;
  /** Server messages with the offset (ms from session start) they arrived at. */
  events: { t: number; msg: ServerMessage }[];
}

export function toFixture(
  name: string,
  events: { t: number; msg: ServerMessage }[],
  notes?: string,
): Fixture {
  return { name, recordedAt: new Date().toISOString(), notes, events };
}

/** Replays a fixture through `onMessage`, preserving original timing. */
export function replayFixture(
  fx: Fixture,
  onMessage: (m: ServerMessage) => void,
  opts: { speed?: number; onDone?: () => void } = {},
): () => void {
  const speed = opts.speed ?? 1;
  const timers: ReturnType<typeof setTimeout>[] = [];

  for (const { t, msg } of fx.events) {
    timers.push(setTimeout(() => onMessage(msg), t / speed));
  }

  const last = fx.events.at(-1)?.t ?? 0;
  if (opts.onDone) timers.push(setTimeout(opts.onDone, last / speed + 50));

  return () => timers.forEach(clearTimeout);
}

export async function loadFixture(name: string): Promise<Fixture> {
  const res = await fetch(`/fixtures/${name}.json`);
  if (!res.ok) throw new Error(`Fixture "${name}" not found`);
  return (await res.json()) as Fixture;
}
