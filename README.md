# Loud Enough

**You don't have to know how to say it.**

Most people don't struggle to *feel* a problem. They struggle to say it in a way
that gets a result. Loud Enough is a voice agent you talk at — messily, out of
order, doubling back — that turns what comes out into something you can actually
send.

Built for the AssemblyAI Voice Agent Hackathon 2026.

```bash
cp .env.example .env.local   # add your two keys
npm install
npm run dev
```

Open http://localhost:3000 and press **Start speaking**. No microphone? There's
a demo that streams a recording through the same pipeline.

## The interaction

Speak for as long as you like. The agent doesn't interrupt, doesn't say "that
sounds frustrating", and doesn't ask you five questions. When it can name your
problem and what you want, it says back what it heard, asks at most one thing,
and offers to write the message.

```
messy speech → understanding → clarification → structure → action
```

## What makes it more than speech-to-text

**It decides when to act, and you can see it happen.** The structured brief on
screen is not a second model summarising the conversation — it is the literal
arguments of a `create_communication_brief` tool call, rendered. When the agent
moves from talking to acting, the screen changes because a tool ran.

**It can't tell you something you didn't say.** Every field in that tool call
has to carry a verbatim quote, and each quote is checked against the transcript
before it is displayed ([`lib/brief.ts`](lib/brief.ts)). Anything that doesn't
match is flagged on screen, withheld from the draft, *and reported back to the
agent* in the tool result — so it corrects itself rather than repeating the
claim. Click **your words** on any row to see the quote it rests on.

**The gaps stay gaps.** The drafting route is only ever handed fields that
passed the check, so there is no unverified material in its context to leak
into the message. A date you never gave comes out as `[DATE OF FIRST REPORT]`,
not as a plausible invention.

That last point is the whole design. A message that reads perfectly and
contains one fabricated date is worse than useless — you'd send it.

## Architecture

| Piece | File |
|---|---|
| Voice session: socket, audio, tools, state | [`lib/assembly/useVoiceAgent.ts`](lib/assembly/useVoiceAgent.ts) |
| Wire protocol, typed | [`lib/assembly/protocol.ts`](lib/assembly/protocol.ts) |
| Agent personality + tool schemas | [`lib/assembly/prompt.ts`](lib/assembly/prompt.ts) |
| Grounding: the quote check | [`lib/brief.ts`](lib/brief.ts) |
| Single-use token minting | [`app/api/voice-token/route.ts`](app/api/voice-token/route.ts) |
| Drafting, from verified fields only | [`app/api/draft/route.ts`](app/api/draft/route.ts) |
| Mic capture, resampled to 24 kHz | [`public/voice-capture.js`](public/voice-capture.js) |
| The voice object | [`components/voice/VoiceOrb.tsx`](components/voice/VoiceOrb.tsx) |

The agent is configured **inline** over the WebSocket rather than stored server-side,
so the prompt and tool definitions live in this repo next to the UI they drive,
and the app runs from a clone with no publishing step.

### Notes from the build

Things that cost time and are easy to get wrong:

- **The Voice Agent API wants `Authorization: Bearer <key>`.** The rest of
  AssemblyAI takes the raw key. Mixing them up gives a 401 with no hint.
- **Audio is base64 inside JSON events, not binary frames** — and the field
  names differ by direction: `input.audio` carries `audio`, `reply.audio`
  carries `data`. Copying the former into the latter's handler silently
  produces nothing.
- **Forcing `AudioContext` to 24 kHz only works in Chromium.** Firefox honours
  the rate but routes that context around its echo canceller, so the agent
  hears itself through the speakers and interrupts every one of its own
  replies. Safari ignores the option and runs at 48 kHz, which sounds
  chipmunked. The context runs at the device rate and the worklet resamples.
- **Tool results must be sent when `reply.done` is the newest event**, not when
  the tool finishes. If the user barged in, pending results are dropped.
- **`session.end` before closing the socket.** A bare close leaves a 30-second
  resume window open, and that window bills.

### Turn detection

`min_silence` is set to 900 ms, far longer than a command-style agent would use.
People describing something difficult pause mid-sentence to find the words, and
a short silence window cuts them off constantly. Letting someone finish is a
product decision before it is a parameter.

## The demo

The **Try a demo** button streams a recorded clip into the socket in place of
microphone audio, paced in the same 50 ms frames the mic produces. Everything
downstream is live: AssemblyAI transcribes it, its turn detection decides when
the speaker has finished, the agent replies aloud and calls its tools, and the
quotes are verified against the transcript the model actually returned. The
transcript you see appear is being produced in real time, not replayed — only
the audio source is swapped.

The clip itself is synthesised speech, so it is a recording of a machine talking,
not of a person.

## Accessibility

The voice interaction is the point, but it is not the only way through. Every
state is announced in a live region, the action buttons call the same code path
the agent's tool does, all controls are keyboard reachable with visible focus,
and `prefers-reduced-motion` stops the animation while keeping the state legible.

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `ASSEMBLYAI_API_KEY` | yes | The entire voice interaction. Server-side only. |
| `ANTHROPIC_API_KEY` | yes | Writes the final message. |
| `DRAFT_MODEL` | no | Defaults to `claude-sonnet-5`. |

Nothing is persisted. Close the tab and the conversation is gone.

## License

MIT. See [LICENSE](LICENSE).
