import type { Utterance, SpeakerLabel } from "./types";

/**
 * "Was that meant for me?"
 *
 * Single-user voice agents never ask this — anything you say is for them. In a
 * room with other people it's the whole problem: the agent has to sit through
 * humans talking to each other and speak only when it's actually addressed.
 *
 * Cheap, explainable heuristics run on every turn. They're decisive at the
 * edges, and when they land in the uncertain middle we escalate to the model
 * (see needsAdjudication). That keeps the common case at ~0ms and spends
 * latency only on genuinely ambiguous turns.
 */

export interface AddressContext {
  /** What the user named the agent during setup. Lower-cased. */
  agentName: string;
  /** Speaker label -> human name, collected at calibration. */
  speakerNames: Map<SpeakerLabel, string>;
  /** Most recent utterances, newest last. */
  recent: Utterance[];
  /** Did the agent itself speak most recently? */
  agentSpokeLast: boolean;
  /** ms since the previous utterance ended. */
  gapMs: number;
}

export interface AddressVerdict {
  score: number;      // 0..1
  reason: string;
  certain: boolean;   // false => worth asking the model
}

const SECOND_PERSON = /\b(you|your|you're|yours)\b/i;
const QUESTION_LEAD =
  /^\s*(what|where|when|why|who|whom|whose|which|how|can|could|would|will|should|do|does|did|is|are|was|were|am|may|might|has|have|had)\b/i;
const IMPERATIVE_LEAD =
  /^\s*(tell|show|find|search|look|play|stop|pause|open|close|set|add|remove|remind|call|send|write|read|explain|summari[sz]e|translate|convert|calculate|check)\b/i;
const BACKCHANNEL =
  /^\s*(mm+|mhm+|uh huh|uh-huh|yeah|yep|yup|right|sure|okay|ok|got it|exactly|true|nice|wow|oh|hmm+)[\s.,!?]*$/i;

/** Strip filler so short utterances aren't judged on "um". */
function core(text: string): string {
  return text.replace(/\b(um|uh|er|like|you know|i mean)\b/gi, " ").replace(/\s+/g, " ").trim();
}

function mentionsAgent(text: string, agentName: string): boolean {
  if (!agentName) return false;
  return new RegExp(`\\b${escapeRe(agentName)}\\b`, "i").test(text);
}

/** Someone addressing another *human* by name is the strongest negative we have. */
function mentionsOtherHuman(text: string, names: Iterable<string>): string | null {
  for (const n of names) {
    if (!n) continue;
    if (new RegExp(`\\b${escapeRe(n)}\\b`, "i").test(text)) return n;
  }
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Are the last few turns a back-and-forth between two humans? */
function inHumanDialogue(recent: Utterance[]): boolean {
  const tail = recent.slice(-4).filter((u) => !u.addressed);
  if (tail.length < 3) return false;
  const speakers = new Set(tail.map((u) => u.speaker));
  return speakers.size >= 2;
}

export function scoreAddressing(text: string, ctx: AddressContext): AddressVerdict {
  const t = core(text);

  if (!t || t.length < 2) {
    return { score: 0, reason: "Empty after filler removal.", certain: true };
  }

  // Backchannels are never addressed to the agent — they're the sound of
  // someone listening to a human.
  if (BACKCHANNEL.test(t)) {
    return { score: 0.02, reason: "Backchannel — someone acknowledging another speaker.", certain: true };
  }

  // Direct address by name. Effectively decisive.
  if (mentionsAgent(t, ctx.agentName)) {
    return { score: 0.97, reason: `Called "${ctx.agentName}" by name.`, certain: true };
  }

  // Addressing a named human beats every positive signal below — "Sarah, what
  // do you think?" is second person AND a question AND not for us.
  const other = mentionsOtherHuman(t, ctx.speakerNames.values());
  if (other) {
    return { score: 0.06, reason: `Addressed ${other} by name.`, certain: true };
  }

  // Everything from here is soft evidence, accumulated.
  let score = 0.28;
  const why: string[] = [];

  if (ctx.agentSpokeLast && ctx.gapMs < 4000) {
    score += 0.3;
    why.push("follows the agent's own turn");
  }

  if (QUESTION_LEAD.test(t) || t.trimEnd().endsWith("?")) {
    score += 0.16;
    why.push("phrased as a question");
  }

  if (IMPERATIVE_LEAD.test(t)) {
    score += 0.2;
    why.push("gives an instruction");
  }

  if (SECOND_PERSON.test(t)) {
    score += 0.1;
    why.push("uses second person");
  }

  if (inHumanDialogue(ctx.recent)) {
    score -= 0.26;
    why.push("mid human-to-human exchange");
  }

  // Long, discursive turns are usually people talking to each other; requests
  // to an assistant tend to be short.
  const words = t.split(/\s+/).length;
  if (words > 28) {
    score -= 0.12;
    why.push("long conversational turn");
  }

  score = Math.max(0, Math.min(1, score));

  // The uncertain middle is where the model earns its latency.
  const certain = score >= 0.72 || score <= 0.22;

  return {
    score,
    reason: why.length ? cap(why.join(", ")) + "." : "No strong signal either way.",
    certain,
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function needsAdjudication(v: AddressVerdict): boolean {
  return !v.certain;
}

export const ADDRESS_THRESHOLD = 0.5;
