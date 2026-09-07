"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentState, ServerMessage, SpeakerLabel, Utterance } from "./types";
import { ADDRESS_THRESHOLD, scoreAddressing, type AddressContext } from "./addressing";

const WS_BASE = "wss://streaming.assemblyai.com/v3/ws";
const SAMPLE_RATE = 16000;

export interface RoomOptions {
  agentName: string;
  maxSpeakers: number;
  /** When false, every utterance is treated as addressed — the "naive agent"
      baseline the demo toggles against. */
  addressingEnabled: boolean;
}

export function useRoomStream(opts: RoomOptions) {
  const [state, setState] = useState<AgentState>("idle");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState("");
  const [partialSpeaker, setPartialSpeaker] = useState<SpeakerLabel | null>(null);
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [speakers, setSpeakers] = useState<SpeakerLabel[]>([]);
  const [level, setLevel] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastVoiceAt = useRef<number>(0);
  const lastEndAt = useRef<number>(0);
  const utterRef = useRef<Utterance[]>([]);
  const namesRef = useRef<Map<SpeakerLabel, string>>(new Map());
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const nameSpeaker = useCallback((label: SpeakerLabel, name: string) => {
    namesRef.current.set(label, name);
    setUtterances((prev) => [...prev]); // re-render labels
  }, []);

  const stop = useCallback(() => {
    try { wsRef.current?.send(JSON.stringify({ type: "Terminate" })); } catch {}
    wsRef.current?.close();
    wsRef.current = null;
    nodeRef.current?.disconnect();
    nodeRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setConnected(false);
    setState("idle");
    setLevel(0);
    setPartial("");
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/token");
      if (!res.ok) throw new Error((await res.json()).error ?? "Token request failed");
      const { token } = (await res.json()) as { token: string };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false, // keep it off: it smears overlapping speakers
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const params = new URLSearchParams({
        speech_model: "universal-3-5-pro",
        encoding: "pcm_s16le",
        sample_rate: String(SAMPLE_RATE),
        speaker_labels: "true",
        max_speakers: String(optsRef.current.maxSpeakers),
        format_turns: "true",
        token,
      });

      const ws = new WebSocket(`${WS_BASE}?${params}`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onerror = () => setError("Streaming connection failed.");
      ws.onclose = () => setConnected(false);
      ws.onmessage = (ev) => handleMessage(JSON.parse(ev.data) as ServerMessage);

      // 16 kHz context means the browser resamples for us — no manual SRC.
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      ctxRef.current = ctx;
      await ctx.audioWorklet.addModule("/pcm-processor.js");

      const src = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pcm-processor");
      nodeRef.current = node;

      node.port.onmessage = (e: MessageEvent<{ audio: ArrayBuffer; peak: number }>) => {
        const { audio, peak } = e.data;
        setLevel(peak);
        if (peak > 0.02) lastVoiceAt.current = performance.now();
        if (ws.readyState === WebSocket.OPEN) ws.send(audio);
      };

      src.connect(node);
      // Worklets need a sink to be pulled; a muted gain keeps it silent.
      const sink = ctx.createGain();
      sink.gain.value = 0;
      node.connect(sink).connect(ctx.destination);

      setState("listening");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      stop();
    }
  }, [stop]);

  function handleMessage(msg: ServerMessage) {
    if (msg.type === "Turn") {
      const label = msg.speaker_label ?? "A";

      setSpeakers((prev) => (prev.includes(label) ? prev : [...prev, label]));

      if (!msg.end_of_turn) {
        setPartial(msg.transcript);
        setPartialSpeaker(label);
        setState("listening");
        return;
      }

      // Time from last detected voice energy to a finalised turn — the number
      // that actually matters, and the one shown in the corner.
      if (lastVoiceAt.current) {
        setLatencyMs(Math.round(performance.now() - lastVoiceAt.current));
      }

      const ctx: AddressContext = {
        agentName: optsRef.current.agentName.toLowerCase(),
        speakerNames: namesRef.current,
        recent: utterRef.current,
        agentSpokeLast: false,
        gapMs: lastEndAt.current ? performance.now() - lastEndAt.current : Infinity,
      };

      const verdict = optsRef.current.addressingEnabled
        ? scoreAddressing(msg.transcript, ctx)
        : { score: 1, reason: "Addressing disabled — naive agent answers everything.", certain: true };

      const u: Utterance = {
        id: `${msg.turn_order}-${Date.now()}`,
        turnOrder: msg.turn_order,
        speaker: label,
        text: msg.transcript,
        words: msg.words ?? [],
        addressed: verdict.score >= ADDRESS_THRESHOLD,
        addressScore: verdict.score,
        reason: verdict.reason,
        at: Date.now(),
      };

      utterRef.current = [...utterRef.current, u].slice(-80);
      setUtterances(utterRef.current);
      setPartial("");
      setPartialSpeaker(null);
      lastEndAt.current = performance.now();
      setState(u.addressed ? "addressed" : "listening");
    }
  }

  return {
    state, connected, error, partial, partialSpeaker,
    utterances, speakers, level, latencyMs,
    start, stop, nameSpeaker,
  };
}
