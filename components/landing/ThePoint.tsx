/**
 * Why this exists, before anyone has to speak.
 *
 * The idle page is otherwise an invitation with no outcome. Judges and
 * visitors should be able to see the job — messy speech in, a sendable
 * message out, with the gaps left as gaps — without starting a session.
 */
const RULES = [
  {
    title: "You can cut in",
    body: "Talk over a reply and playback stops. You don’t wait for it to finish its sentence.",
  },
  {
    title: "It waits for you",
    body: "A pause while you find the words doesn’t end your turn. Silence is held open on purpose.",
  },
  {
    title: "Nothing invented",
    body: "Every claim is checked against what you said. A date you never gave stays a blank.",
  },
];

export function ThePoint() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-4 pt-16 sm:pt-20">
      <p className="label">What you get</p>
      <h2 className="said mt-4 max-w-xl text-[clamp(1.7rem,4vw,2.5rem)] leading-[1.15]">
        A messy explanation in. A message you can send out.
      </h2>
      <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--text-soft)]">
        Most voice apps either cut you off or turn the conversation into a form.
        Talk it through out of order, double back, and interrupt. What comes back
        uses only your words.
      </p>

      <div className="mt-10 grid gap-8 border-t border-[var(--edge)] pt-8 sm:grid-cols-2 sm:gap-12">
        <div>
          <p className="label">What you said</p>
          <p className="said mt-3 text-[17px] italic leading-relaxed text-[var(--text-soft)] sm:text-[18px]">
            &ldquo;There&rsquo;s this leak, I told them three times, and now there&rsquo;s mold,
            and they just — I need them to actually fix it and write me back.&rdquo;
          </p>
        </div>
        <div>
          <p className="label">What you can send</p>
          <p className="mt-3 text-[15px] leading-[1.65] text-[var(--text)]">
            I&rsquo;ve reported a water leak three times. Mold is forming. I&rsquo;m asking
            for a repair and a written reply.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-faint)]">
            The date was never said, so it stays{" "}
            <mark
              className="rounded-[3px] px-1 py-0.5 font-medium"
              style={{ background: "var(--signal-dim)", color: "var(--signal)" }}
            >
              [DATE OF FIRST REPORT]
            </mark>
          </p>
        </div>
      </div>

      <ul className="mt-10 grid gap-6 border-t border-[var(--edge)] pt-8 sm:grid-cols-3">
        {RULES.map((rule) => (
          <li key={rule.title}>
            <p className="text-[15px] text-[var(--text)]">{rule.title}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-faint)]">{rule.body}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-[12.5px] leading-relaxed text-[var(--text-faint)]">
        The demo plays this situation out loud. The transcript and the message are produced live
        from that audio — this is the shape of the result, including the gap.
      </p>
    </section>
  );
}
