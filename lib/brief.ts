/**
 * The structured representation of what the user actually said.
 *
 * The whole product rests on one rule: nothing reaches this object that the
 * user did not say out loud. The agent proposes; this module verifies. Every
 * populated field has to carry a verbatim `quote`, and we check that quote
 * really appears in the transcript of what was spoken. A field whose quote
 * can't be found is kept but flagged — never silently promoted to fact, and
 * never allowed into a drafted message.
 *
 * Marking rather than deleting is deliberate: a dropped field looks like the
 * agent simply missed something, while a flagged one shows the check working.
 */

export interface Grounded {
  /** The agent's phrasing — short, neutral, for display. */
  value: string;
  /** Words the user actually spoke, copied verbatim. */
  quote: string;
  /** Whether `quote` was found in the spoken transcript. */
  verified: boolean;
}

export interface Brief {
  problem: Grounded | null;
  history: Grounded | null;
  impact: Grounded | null;
  desiredOutcome: Grounded | null;
  /** Specific details worth carrying into a message: names, counts, dates. */
  facts: Grounded[];
  /** Absences. Not grounded in anything — that is the point of them. */
  missing: string[];
  nextAction: string;
  /** How many items failed the quote check. Surfaced in the UI. */
  unverified: number;
}

export const EMPTY_BRIEF: Brief = {
  problem: null, history: null, impact: null, desiredOutcome: null,
  facts: [], missing: [], nextAction: "", unverified: 0,
};

/** Loose match: speech transcripts vary in punctuation and casing, not words. */
const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * A quote counts as grounded if it appears in what was actually transcribed.
 * Substring on the normalised text: strict about words, forgiving about the
 * punctuation a speech model invents.
 */
export function isGrounded(quote: string, spoken: string): boolean {
  const needle = norm(quote);
  if (needle.length < 3) return false;
  return norm(spoken).includes(needle);
}

/** Shape of one field as the agent's tool call delivers it. */
interface RawField { value?: unknown; quote?: unknown }

function ground(raw: unknown, spoken: string): Grounded | null {
  if (!raw || typeof raw !== "object") return null;
  const { value, quote } = raw as RawField;
  if (typeof value !== "string" || !value.trim()) return null;
  const q = typeof quote === "string" ? quote.trim() : "";
  return { value: value.trim(), quote: q, verified: isGrounded(q, spoken) };
}

/**
 * Turn a `create_communication_brief` tool call into a verified Brief.
 * `spoken` is every word the user has actually said this session.
 */
export function verifyBrief(args: Record<string, unknown>, spoken: string): Brief {
  const problem = ground(args.problem, spoken);
  const history = ground(args.history, spoken);
  const impact = ground(args.impact, spoken);
  const desiredOutcome = ground(args.desired_outcome, spoken);

  const facts = (Array.isArray(args.facts) ? args.facts : [])
    .map((f) => ground(f, spoken))
    .filter((f): f is Grounded => f !== null)
    .slice(0, 8);

  const missing = (Array.isArray(args.missing_information) ? args.missing_information : [])
    .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
    .map((m) => m.trim())
    .slice(0, 5);

  const unverified = [problem, history, impact, desiredOutcome, ...facts]
    .filter((f) => f !== null && !f.verified).length;

  return {
    problem, history, impact, desiredOutcome, facts, missing,
    nextAction: typeof args.next_action === "string" ? args.next_action.trim() : "",
    unverified,
  };
}

/** Enough to be worth acting on. Drives the move into ACTION state. */
export function isActionable(b: Brief): boolean {
  return !!b.problem && (!!b.desiredOutcome || !!b.impact);
}

/**
 * The subset a drafted message is allowed to draw on: verified only.
 * Anything the check rejected simply isn't available to the writer.
 */
export function groundedOnly(b: Brief) {
  const keep = (g: Grounded | null) => (g && g.verified ? g.value : null);
  return {
    problem: keep(b.problem),
    history: keep(b.history),
    impact: keep(b.impact),
    desired_outcome: keep(b.desiredOutcome),
    facts: b.facts.filter((f) => f.verified).map((f) => f.value),
    missing_information: b.missing,
  };
}
