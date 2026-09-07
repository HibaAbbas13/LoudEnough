# Loud Enough

**Every voice agent assumes exactly one user.** Put three people in a room and
they all collapse — they answer when two humans are talking *to each other*,
lose track of who asked what, and have no concept of whether they were even
addressed.

Loud Enough is a voice agent built for a room instead of a headset. It uses
AssemblyAI's streaming diarization to track who is speaking in real time, and
an addressing engine to decide, per turn, whether it was spoken to at all.

Built for the AssemblyAI Voice Agent Hackathon 2026.

## What's actually novel here

Most submissions use AssemblyAI as a microphone: speech in, text out, discard
everything else. This uses the parts that make it different — live
`speaker_label`s, per-word timings and confidence — as the product itself.

The addressing engine (`lib/addressing.ts`) scores each finalised turn on cheap,
explainable signals: direct address by name, imperatives, question form, second
person, whether the agent just spoke, and whether the last few turns look like a
human-to-human exchange. It's decisive at the edges at ~0ms and escalates only
the genuinely ambiguous middle band to a model — so latency is spent only where
it buys something.

Every decision is inspectable in the UI. Click any line to see why it was
answered or held back.

## Setup

```bash
cp .env.local.example .env.local   # add your AssemblyAI key
npm install
npm run dev
```

## Architecture

| Piece | File |
|---|---|
| Mic capture → PCM16 @ 16kHz | `public/pcm-processor.js` |
| Temporary token minting (keeps the API key server-side) | `app/api/token/route.ts` |
| Streaming socket + turn handling | `lib/useRoomStream.ts` |
| Addressing engine | `lib/addressing.ts` |
| Amplitude-driven waveform | `components/Waveform.tsx` |

The waveform is driven by real mic amplitude, never a CSS animation.
