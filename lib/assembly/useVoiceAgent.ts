"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AGENT_WS, SAMPLE_RATE, humanError, isFatal,
  type ClientEvent, type ServerEvent,
} from "./protocol";
import { GREETING, SYSTEM_PROMPT, TOOLS } from "./prompt";
import {
  EMPTY_BRIEF, groundedOnly, isActionable, verifyBrief, type Brief,
} from "../brief";

/** What the voice session is doing right now. Drives the orb. */
export type Phase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
/** How far the understanding has got. Drives the page layout. */
export type Stage = "open" | "understood" | "action" | "complete";

export type DraftKind = "formal_message" | "phone_script" | "summary";

export interface Draft {
  kind: DraftKind;
  subject: string;
  body: string;
  placeholders: string[];
}

const b64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  // Chunked: String.fromCharCode(...bytes) blows the call stack on long buffers.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

/**
 * The demo streams a recorded clip into the socket in place of the microphone.
 *
 * Everything downstream is the live system: AssemblyAI transcribes it, its
 * turn detection decides when the speaker has finished, the agent replies out
 * loud and calls its tools, and the quotes it produces are checked against the
 * transcript the model actually returned. Nothing is replayed from a script —
 * only the audio source is swapped, which is what a demo recording is.
 */
const DEMO_CLIP = "/demo/landlord.mp3";

export function useVoiceAgent() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState<Stage>("open");
  const [error, setError] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);

  const [partial, setPartial] = useState("");
  const [said, setSaid] = useState<string[]>([]);
  const [agentLine, setAgentLine] = useState("");

  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [toolLog, setToolLog] = useState<{ name: string; at: number }[]>([]);

  const [micLevel, setMicLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);

  const ws = useRef<WebSocket | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const node = useRef<AudioWorkletNode | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const sinkGain = useRef<GainNode | null>(null);
  const ready = useRef(false);
  const alive = useRef(false);
  const playhead = useRef(0);
  const playing = useRef<AudioBufferSourceNode[]>([]);
  const raf = useRef(0);

  // Everything the user has actually said, for the grounding check.
  const spoken = useRef("");
  const briefRef = useRef<Brief>(EMPTY_BRIEF);
  // Tool results must be sent only when reply.done is the newest event seen.
  const lastEvent = useRef<string>("");
  // Demo mode: a recorded clip is streamed in place of live microphone audio.
  const clip = useRef<string | null>(null);
  const clipStop = useRef<(() => void) | null>(null);
  const pending = useRef<{ call_id: string; result: unknown; is_error?: boolean }[]>([]);

  // Amplitude arrives ~60x a second. Rendering the page that often to move a
  // canvas nobody diffs is waste, so values are quantised and only committed
  // when they actually change a visible step.
  const step = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 40) / 40;
  const setMic = useCallback((v: number) => {
    setMicLevel((p) => (step(p) === step(v) ? p : step(v)));
  }, []);
  const setAgent = useCallback((v: number) => {
    setAgentLevel((p) => (step(p) === step(v) ? p : step(v)));
  }, []);

  const send = useCallback((e: ClientEvent) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(e));
  }, []);

  /** Cut playback dead. Called on barge-in so no stale agent speech survives. */
  const flushPlayback = useCallback(() => {
    for (const s of playing.current) { try { s.stop(); } catch {} }
    playing.current = [];
    playhead.current = ctx.current?.currentTime ?? 0;
    setAgentLevel(0);
  }, []);

  const cleanup = useCallback(() => {
    alive.current = false;
    clipStop.current?.();
    clipStop.current = null;
    cancelAnimationFrame(raf.current);
    flushPlayback();
    node.current?.disconnect();
    node.current = null;
    analyser.current = null;
    sinkGain.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    ctx.current?.close().catch(() => {});
    ctx.current = null;
    const socket = ws.current;
    ws.current = null;
    ready.current = false;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN) {
        try { socket.send(JSON.stringify({ type: "session.end" })); } catch {}
      }
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        try { socket.close(); } catch {}
      }
    }
    setMicLevel(0);
    setAgentLevel(0);
    setPartial("");
  }, [flushPlayback]);

  const flushTools = useCallback(() => {
    if (lastEvent.current !== "reply.done" || !pending.current.length) return;
    for (const t of pending.current) {
      send({
        type: "tool.result",
        call_id: t.call_id,
        result: JSON.stringify(t.result),
        is_error: t.is_error,
      });
    }
    pending.current = [];
  }, [send]);

  /** Writes the message from the verified brief only. */
  const runDraft = useCallback(async (kind: DraftKind, recipient?: string) => {
    const b = briefRef.current;
    if (!b.problem) {
      return { ok: false, error: "No brief recorded yet. Call create_communication_brief first." };
    }
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, recipient, brief: groundedOnly(b) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't write the message.");
      setDraft({ kind, ...data.draft });
      setStage("complete");
      return {
        ok: true,
        placeholders: data.draft.placeholders ?? [],
        note: "The draft is on screen. Tell the user it's ready and mention any bracketed details they still need to fill in. Do not read the whole message aloud.",
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return { ok: false, error: `Drafting failed: ${msg}. Tell the user it didn't go through and offer to try again.` };
    } finally {
      setDrafting(false);
    }
  }, []);

  const onTool = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      setToolLog((l) => [...l, { name, at: Date.now() }]);

      if (name === "create_communication_brief") {
        const verified = verifyBrief(args, spoken.current);
        briefRef.current = verified;
        setBrief(verified);
        setStage((s) => (s === "open" ? "understood" : s));
        if (isActionable(verified)) setStage((s) => (s === "complete" ? s : "action"));

        // Hand the grounding result back so the agent can correct itself rather
        // than repeat an unverifiable claim.
        const bad = ([
          ["problem", verified.problem], ["history", verified.history],
          ["impact", verified.impact], ["desired_outcome", verified.desiredOutcome],
        ] as const)
          .filter(([, f]) => f && !f.verified)
          .map(([k]) => k);

        return {
          recorded: true,
          unverified_fields: bad,
          note: bad.length
            ? `These quotes were not found in the transcript and are flagged on screen as unverified: ${bad.join(", ")}. Do not repeat those claims as fact. Re-send the brief with the user's actual words, or move the item to missing_information.`
            : "All fields verified against the transcript and shown on screen.",
          still_missing: verified.missing,
        };
      }

      if (name === "draft_message") {
        const kind = (["formal_message", "phone_script", "summary"] as const).includes(
          args.kind as DraftKind,
        )
          ? (args.kind as DraftKind)
          : "formal_message";
        return runDraft(kind, typeof args.recipient === "string" ? args.recipient : undefined);
      }

      return { ok: false, error: `Unknown tool: ${name}` };
    },
    [runDraft],
  );

  /**
   * Streams a recorded clip into the socket at real time, in the same 50 ms
   * PCM16 frames the microphone produces.
   *
   * Pacing matters: dumping the whole file at once would give the server 23
   * seconds of audio in one burst, and its turn detection would have nothing
   * to measure a pause against. Sent at the rate it was spoken, the clip is
   * indistinguishable from a live speaker, which is the point — the demo
   * exercises the real transcription and turn-taking path, not a shortcut
   * around it.
   */
  const streamClip = useCallback(async (url: string) => {
    const c = ctx.current;
    const socket = ws.current;
    if (!c || !socket) return;

    let samples: Float32Array;
    try {
      const bytes = await fetch(url).then((r) => r.arrayBuffer());
      // Decoding in a 24 kHz context resamples the clip for us.
      const off = new OfflineAudioContext(1, 1, SAMPLE_RATE);
      const buf = await off.decodeAudioData(bytes);
      samples = buf.getChannelData(0);
    } catch {
      setError("Couldn't load the demo clip. Try starting a conversation instead.");
      setPhase("error");
      return;
    }

    const FRAME = SAMPLE_RATE / 20; // 50 ms
    let i = 0;
    let cancelled = false;
    clipStop.current = () => { cancelled = true; };

    while (i < samples.length && !cancelled) {
      if (socket.readyState !== WebSocket.OPEN) break;
      const slice = samples.subarray(i, i + FRAME);
      const pcm = new Int16Array(slice.length);
      let peak = 0;
      for (let n = 0; n < slice.length; n++) {
        const v = Math.max(-1, Math.min(1, slice[n]));
        pcm[n] = Math.round(v * 32767);
        const a = Math.abs(v);
        if (a > peak) peak = a;
      }
      socket.send(JSON.stringify({ type: "input.audio", audio: b64(pcm.buffer) }));
      setMic(peak);
      i += FRAME;
      await new Promise((r) => setTimeout(r, 50));
    }

    clipStop.current = null;
    if (!cancelled) setMic(0);
  }, [setMic]);

  const handle = useCallback(
    (msg: ServerEvent) => {
      if (!alive.current) return;
      if (process.env.NODE_ENV !== "production" && msg.type !== "reply.audio") {
        console.debug("[va]", msg.type, msg);
      }
      switch (msg.type) {
        case "session.ready": {
          ready.current = true;
          setPhase("listening");
          const url = clip.current;
          if (url) {
            clip.current = null;
            void streamClip(url);
          }
          break;
        }

        case "input.speech.started":
          lastEvent.current = "input.speech.started";
          // A non-fatal error left the banner up while the session carried on.
          // Speaking again is the user retrying, so the warning goes.
          setError(null);
          setPhase("listening");
          break;

        case "transcript.user.delta":
          // `text` is the full transcript so far for this item — replace, never append.
          setPartial(msg.text);
          break;

        case "transcript.user":
          if (msg.text.trim()) {
            spoken.current += " " + msg.text;
            setSaid((s) => [...s, msg.text]);
          }
          setPartial("");
          setPhase("thinking");
          break;

        case "reply.started":
          lastEvent.current = "reply.started";
          setAgentLine("");
          setPhase("thinking");
          break;

        case "reply.audio": {
          const c = ctx.current;
          if (!c) break;
          // `reply.audio` carries audio in `data`; `input.audio` uses `audio`.
          const raw = atob(msg.data);
          const pcm = new Int16Array(raw.length / 2);
          for (let i = 0; i < pcm.length; i++) {
            pcm[i] = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
          }
          const f32 = new Float32Array(pcm.length);
          for (let i = 0; i < pcm.length; i++) f32[i] = pcm[i] / 32768;

          const buf = c.createBuffer(1, f32.length, SAMPLE_RATE);
          buf.getChannelData(0).set(f32);
          const src = c.createBufferSource();
          src.buffer = buf;
          src.connect(analyser.current ?? c.destination);
          playhead.current = Math.max(playhead.current, c.currentTime);
          src.start(playhead.current);
          playhead.current += buf.duration;
          playing.current.push(src);
          src.onended = () => {
            playing.current = playing.current.filter((s) => s !== src);
          };
          setPhase("speaking");
          break;
        }

        case "transcript.agent.delta":
          setAgentLine((t) => (t ? t + " " : "") + msg.delta);
          break;

        case "transcript.agent":
          setAgentLine(msg.text);
          break;

        case "reply.done":
          lastEvent.current = "reply.done";
          if (msg.status === "interrupted") {
            flushPlayback();
            pending.current = []; // the agent moved on; stale results would confuse it
          } else {
            flushTools();
          }
          setPhase(ready.current ? "listening" : "idle");
          break;

        case "tool.call":
          void (async () => {
            const result = await onTool(msg.name, msg.arguments);
            const failed = typeof result === "object" && result !== null && "ok" in result
              && (result as { ok: boolean }).ok === false;
            pending.current.push({ call_id: msg.call_id, result, is_error: failed });
            // The tool may have finished after reply.done already fired.
            flushTools();
          })();
          break;

        case "session.error":
          setError(humanError(msg.code, msg.message));
          if (isFatal(msg.code)) { setPhase("error"); cleanup(); }
          break;

        case "error":
          setError(msg.message || "Something interrupted the conversation.");
          break;

        case "session.ended":
          cleanup();
          setPhase("idle");
          break;
      }
    },
    [cleanup, flushPlayback, flushTools, onTool, streamClip],
  );

  const start = useCallback(async (opts: { mic?: boolean; clip?: string } = {}) => {
    if (phase !== "idle" && phase !== "error") return;
    const useMic = opts.mic !== false;
    clip.current = opts.clip ?? null;
    setError(null);
    setMicDenied(false);
    setPhase("connecting");

    let token: string;
    try {
      const res = await fetch("/api/voice-token");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start the session.");
      token = data.token;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the session.");
      setPhase("error");
      return;
    }

    if (useMic) {
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            // Without this the agent hears itself through the speakers and
            // interrupts every one of its own replies.
            echoCancellation: true,
            // The server denoises already; a second pass costs accuracy.
            noiseSuppression: false,
            autoGainControl: true,
          },
        });
      } catch (e) {
        const denied =
          e instanceof DOMException &&
          (e.name === "NotAllowedError" || e.name === "SecurityError");
        setMicDenied(denied);
        setError(
          denied
            ? "Loud Enough needs your microphone to hear you. Allow access in your browser's address bar, then start again."
            : "No microphone was found. Check that one is connected, or try the no-microphone demo.",
        );
        setPhase("error");
        return;
      }
    }

    // Device-default rate, resampled in the worklet: the only pipeline that
    // keeps echo cancellation intact on Firefox and correct pitch on Safari.
    const c = new AudioContext();
    ctx.current = c;
    await c.resume();
    if (useMic) await c.audioWorklet.addModule("/voice-capture.js");

    const an = c.createAnalyser();
    an.fftSize = 256;
    an.smoothingTimeConstant = 0.75;
    an.connect(c.destination);
    analyser.current = an;
    playhead.current = c.currentTime;

    const socket = new WebSocket(`${AGENT_WS}?token=${encodeURIComponent(token)}`);
    ws.current = socket;
    alive.current = true;

    socket.onopen = () => {
      // Sent immediately, before session.ready. Inline config rather than a
      // stored agent so the prompt and tools live in this repo, versioned with
      // the UI they drive, and the app runs from a clone with no publish step.
      send({
        type: "session.update",
        session: {
          system_prompt: SYSTEM_PROMPT,
          // In demo mode the clip starts immediately, so a greeting would
          // just talk over it.
          ...(opts.clip ? {} : { greeting: GREETING }),
          tools: TOOLS,
          input: {
            format: { encoding: "audio/pcm" },
            turn_detection: {
              // People telling a difficult story pause mid-sentence to find the
              // words. A short silence window would cut them off constantly, so
              // this waits considerably longer than a command-and-control agent
              // would before deciding a turn is over.
              min_silence: 900,
              max_silence: 3500,
              interrupt_response: true,
            },
          },
          output: { voice: "vera", format: { encoding: "audio/pcm" } },
        },
      });
    };

    socket.onmessage = (ev) => {
      try { handle(JSON.parse(ev.data) as ServerEvent); } catch {}
    };

    socket.onerror = () => {
      setError("The connection to the voice service dropped.");
      setPhase("error");
    };

    socket.onclose = (ev) => {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[va] close", ev.code, ev.reason);
      }
      if (ready.current) { cleanup(); setPhase("idle"); }
    };

    if (useMic && stream.current) {
      const src = c.createMediaStreamSource(stream.current);
      const worklet = new AudioWorkletNode(c, "voice-capture", {
        processorOptions: { inputSampleRate: c.sampleRate, targetSampleRate: SAMPLE_RATE },
      });
      node.current = worklet;

      worklet.port.onmessage = (e: MessageEvent<{ peak: number; audio: ArrayBuffer | null }>) => {
        setMic(e.data.peak);
        if (e.data.audio && ready.current && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "input.audio", audio: b64(e.data.audio) }));
        }
      };

      // A worklet only runs while something pulls it, so it needs a sink —
      // muted, or the user hears their own voice on a half-second delay.
      const mute = c.createGain();
      mute.gain.value = 0;
      sinkGain.current = mute;
      src.connect(worklet).connect(mute).connect(c.destination);
    }

    // Agent output amplitude, read from the real playback graph.
    const bins = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      an.getByteTimeDomainData(bins);
      let peak = 0;
      for (let i = 0; i < bins.length; i++) {
        const v = Math.abs(bins[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      setAgent(peak);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [phase, send, handle, cleanup, setMic, setAgent]);

  const stop = useCallback(() => {
    cleanup();
    setPhase("idle");
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    spoken.current = "";
    briefRef.current = EMPTY_BRIEF;
    lastEvent.current = "";
    pending.current = [];
    setBrief(EMPTY_BRIEF);
    setDraft(null);
    setSaid([]);
    setAgentLine("");
    setToolLog([]);
    setError(null);
    setStage("open");
    setPhase("idle");
  }, [cleanup]);

  /**
   * A real session with a recorded clip in place of the microphone, for anyone
   * without a working mic — or evaluating on a machine where speaking aloud
   * isn't practical. The transcript on screen is produced live by AssemblyAI
   * from that audio, not read from a file.
   */
  const startDemo = useCallback(() => {
    void start({ mic: false, clip: DEMO_CLIP });
  }, [start]);

  /** Manual action buttons use the same path the spoken request does. */
  const chooseAction = useCallback((kind: DraftKind) => { void runDraft(kind); }, [runDraft]);

  useEffect(() => {
    // pagehide fires on tab close and navigation, and unlike beforeunload it is
    // reliable on mobile Safari. Must be synchronous — an await never lands.
    const bye = () => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: "session.end" }));
      }
    };
    window.addEventListener("pagehide", bye);
    return () => {
      window.removeEventListener("pagehide", bye);
      bye();
      cleanup();
    };
  }, [cleanup]);

  const connected = phase !== "idle" && phase !== "error" && phase !== "connecting";

  return {
    phase, stage, connected, error, micDenied,
    partial, said, agentLine,
    brief, draft, drafting, toolLog,
    micLevel, agentLevel,
    start, startDemo, stop, reset, chooseAction,
  };
}
