

export interface Grounded {

  value: string;

  quote: string;

  verified: boolean;
}

export interface Brief {
  problem: Grounded | null;
  history: Grounded | null;
  impact: Grounded | null;
  desiredOutcome: Grounded | null;

  facts: Grounded[];

  missing: string[];
  nextAction: string;

  unverified: number;
}

export const EMPTY_BRIEF: Brief = {
  problem: null, history: null, impact: null, desiredOutcome: null,
  facts: [], missing: [], nextAction: "", unverified: 0,
};

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function isGrounded(quote: string, spoken: string): boolean {
  const needle = norm(quote);
  if (needle.length < 3) return false;
  return norm(spoken).includes(needle);
}

interface RawField { value?: unknown; quote?: unknown }

function ground(raw: unknown, spoken: string): Grounded | null {
  if (!raw || typeof raw !== "object") return null;
  const { value, quote } = raw as RawField;
  if (typeof value !== "string" || !value.trim()) return null;
  const q = typeof quote === "string" ? quote.trim() : "";
  return { value: value.trim(), quote: q, verified: isGrounded(q, spoken) };
}

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

export function isActionable(b: Brief): boolean {
  return !!b.problem && (!!b.desiredOutcome || !!b.impact);
}

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
