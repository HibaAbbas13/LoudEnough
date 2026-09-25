/**
 * The architecture, for anyone evaluating it.
 *
 * Kept to four steps and one sentence each. A judge should be able to work out
 * what is actually happening in about fifteen seconds without the page turning
 * into documentation.
 */
const STEPS = [
  {
    n: "01",
    title: "Listen",
    body: "Speech in and speech out over one WebSocket. Trailing off mid-thought doesn't end your turn — and the moment you talk over a reply, playback stops, so it stays a conversation instead of a recording.",
  },
  {
    n: "02",
    title: "Understand",
    body: "The agent calls a real tool the moment it can name the problem and what you want. That call is what draws the brief on screen — the structure you see is the tool's arguments, not a second model summarising the first.",
  },
  {
    n: "03",
    title: "Verify",
    body: "Every field arrives with a verbatim quote, and each quote is checked against the transcript before it is displayed. Anything that doesn't match is flagged on screen and withheld from the draft — the agent is told, so it can correct itself.",
  },
  {
    n: "04",
    title: "Act",
    body: "A second tool writes the message from verified fields only. Details you never gave become bracketed gaps rather than plausible inventions, so nothing goes out that you didn't say.",
  },
];

const BUILT_WITH = [
  { name: "AssemblyAI Voice Agent API", note: "speech, turn-taking, tool calling" },
  { name: "Claude Sonnet 5", note: "drafting, from verified fields only" },
  { name: "Next.js · TypeScript", note: "app, token minting, drafting route" },
  { name: "Web Audio API", note: "capture, resampling, playback, amplitude" },
];

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16 sm:pt-20">
      <p className="label">How it works</p>

      <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.n}>
            <div className="flex items-baseline gap-3">
              <span
                className="text-[11px] font-medium tracking-[0.14em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
              >
                {s.n}
              </span>
              <h3 className="text-[19px] leading-none">{s.title}</h3>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-soft)]">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 border-t border-[var(--edge)] pt-8">
        <p className="label">Built with</p>
        <ul className="mt-4 grid gap-x-10 gap-y-2.5 sm:grid-cols-2">
          {BUILT_WITH.map((b) => (
            <li key={b.name} className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
              <span className="text-[var(--text)]">{b.name}</span>
              <span className="text-[13px] text-[var(--text-faint)]">{b.note}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-10 text-[12.5px] leading-relaxed text-[var(--text-faint)]">
        The permanent API key stays on the server; the browser connects with a single-use token
        minted per session. Nothing is stored — close the tab and the conversation is gone.
      </p>
    </section>
  );
}
