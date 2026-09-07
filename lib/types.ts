export type SpeakerLabel = string; // "A", "B", "C", ... from AssemblyAI

export interface Word {
  text: string;
  start: number;
  end: number;
  confidence: number;
  word_is_final: boolean;
  speaker?: SpeakerLabel;
}

/** Server messages from the AssemblyAI streaming socket (v3). */
export type ServerMessage =
  | { type: "Begin"; id: string; expires_at: number; configuration?: unknown }
  | { type: "SpeechStarted" }
  | {
      type: "Turn";
      turn_order: number;
      end_of_turn: boolean;
      transcript: string;
      speaker_label?: SpeakerLabel;
      end_of_turn_confidence: number;
      words: Word[];
    }
  | { type: "SpeakerRevision"; [k: string]: unknown }
  | { type: "Termination"; audio_duration_seconds: number; session_duration_seconds: number };

/** A completed utterance, after we've decided who said it and who it was for. */
export interface Utterance {
  id: string;
  turnOrder: number;
  speaker: SpeakerLabel;
  text: string;
  words: Word[];
  /** Whether the agent judged itself to be the addressee. */
  addressed: boolean;
  /** 0..1 — how sure we are. Drives the UI's hedging. */
  addressScore: number;
  /** Human-readable reason, shown on the inline expand. */
  reason: string;
  at: number;
}

export type AgentState =
  | "idle"
  | "listening"   // hearing speech, not addressed
  | "addressed"   // decided this was for us
  | "thinking"
  | "speaking";
