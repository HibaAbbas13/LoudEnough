import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fingerprint, readCache, writeCache, recordSpend } from "@/lib/spend";

export const maxDuration = 45;

const MODEL = process.env.DRAFT_MODEL ?? "claude-sonnet-5";

const DraftSchema = z.object({
  subject: z.string().describe("Subject line. Empty string for a phone script."),
  body: z.string().describe("The message itself, as plain text with line breaks."),
  placeholders: z
    .array(z.string())
    .describe("Each [BRACKETED] placeholder left in the body, listed verbatim without brackets."),
});

const SYSTEM = `You write short, effective messages on behalf of someone who has explained a problem out loud.

You are given a verified brief: only facts the person actually said, already checked against a transcript. That brief is the complete set of things you know.

RULES

1. Use only what is in the brief. Never add a date, name, amount, address, reference number, legal claim, or event that is not there. Not as an example, not as a plausible default, not as filler.
2. Where a message would normally carry a detail you were not given, write a placeholder in square brackets and capitals: [DATE OF FIRST REPORT]. Never invent the value. Never quietly omit a detail that changes the message's force — a landlord reading "I have reported this several times" should still see [DATE OF FIRST REPORT] rather than a made-up date.
3. Do not assert consequences, rights, or legal positions the person did not raise. "This may breach your obligations" is not yours to write unless they said it.
4. Tone: firm, civil, unemotional. The person wants a result, not a fight and not an apology. No pleading, no threats, no "I would really appreciate it if you could possibly". State the facts, state what you want, state the timeframe if you were given one.
5. Length: as short as the job allows. A maintenance escalation is five or six sentences.

FORMAT BY KIND
- formal_message: a subject line and an email body. Open with the ask or the issue, not with pleasantries. Sign off with a plain closing and no invented name — use [YOUR NAME].
- phone_script: no subject. What to say out loud, in the first person, in short spoken sentences. Include a line for the opening and one for what to do if they deflect.
- summary: no subject. A plain factual account of the situation in a short paragraph or two. No addressee.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Drafting isn't configured. Add ANTHROPIC_API_KEY to .env.local and restart." },
      { status: 500 },
    );
  }

  let payload: { kind?: string; recipient?: string; brief?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const kind = ["formal_message", "phone_script", "summary"].includes(payload.kind ?? "")
    ? payload.kind!
    : "formal_message";

  const brief = payload.brief;
  if (!brief || typeof brief !== "object") {
    return NextResponse.json({ error: "There's nothing to write from yet." }, { status: 400 });
  }

  const recipient = (payload.recipient ?? "").trim();
  const input = [
    `KIND: ${kind}`,
    recipient ? `ADDRESSED TO: ${recipient}` : "ADDRESSED TO: not stated — use a neutral opening",
    "",
    "VERIFIED BRIEF (the complete set of facts you have):",
    JSON.stringify(brief, null, 2),
  ].join("\n");

  const key = fingerprint([MODEL, SYSTEM, input]);
  const cached = await readCache<{ draft: unknown }>(key);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  try {
    const res = await new Anthropic().messages.parse({
      model: MODEL,
      max_tokens: 2000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: input }],
      output_config: { format: zodOutputFormat(DraftSchema) },
    });

    if (!res.parsed_output) {
      return NextResponse.json({ error: "Couldn't put that into words. Try again." }, { status: 502 });
    }

    const draft = res.parsed_output;
    await recordSpend(
      MODEL,
      {
        input: res.usage.input_tokens,
        output: res.usage.output_tokens,
        cacheRead: res.usage.cache_read_input_tokens ?? 0,
      },
      `draft ${kind}`,
    );
    await writeCache(key, { draft });

    return NextResponse.json({ draft, cached: false });
  } catch (e) {
    console.error("[draft]", e);
    if (e instanceof Anthropic.APIError && e.status === 429) {
      return NextResponse.json(
        { error: "The writing service is busy. Try that again in a moment." },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "Couldn't write the message. Try again." }, { status: 502 });
  }
}
