

export const AGENT_WS = "wss://agents.assemblyai.com/v1/ws";
export const SAMPLE_RATE = 24_000;

export interface ToolDef {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface SessionConfig {
  system_prompt: string;
  greeting?: string;
  tools?: ToolDef[];
  input?: {
    format?: { encoding: "audio/pcm" };
    keyterms?: string[];
    transcription_mode?: "min_latency" | "balanced" | "max_accuracy";
    turn_detection?: {
      vad_threshold?: number;
      min_silence?: number;
      max_silence?: number;
      interrupt_response?: boolean;
      interruption_delay?: number;
    };
  };
  output?: { voice?: string; format?: { encoding: "audio/pcm" }; volume?: number };
}

export type ClientEvent =
  | { type: "session.update"; session: SessionConfig }
  | { type: "input.audio"; audio: string }
  | { type: "tool.result"; call_id: string; result: string; is_error?: boolean }
  | { type: "conversation.message"; role: "user" | "system"; content: string }
  | { type: "reply.create"; instructions?: string }
  | { type: "session.end" };

export type ServerEvent =
  | { type: "session.ready"; session_id: string; expires_at?: number; config?: unknown }
  | { type: "session.updated"; config?: unknown }
  | { type: "session.ended"; session_duration_seconds: number; audio_duration_seconds: number | null }
  | { type: "input.speech.started" }
  | { type: "input.speech.stopped" }
  | { type: "transcript.user.delta"; item_id: string; text: string }
  | { type: "transcript.user"; item_id: string; text: string }
  | { type: "reply.started"; reply_id: string; item_id: string }
  | { type: "reply.audio"; data: string }
  | { type: "transcript.agent.delta"; reply_id: string; delta: string }
  | { type: "transcript.agent"; reply_id: string; text: string; interrupted: boolean }
  | { type: "reply.done"; reply_id: string; status: "completed" | "interrupted" }
  | { type: "tool.call"; call_id: string; name: string; arguments: Record<string, unknown> }
  | { type: "session.error"; code: string; message: string }
  | { type: "error"; message: string };

export function isFatal(code: string): boolean {
  return [
    "unauthorized", "forbidden", "server_error", "internal_error",
    "session_not_found", "session_forbidden", "session_expired",
    "agent_init_failed", "agent_timeout",
  ].includes(code.toLowerCase());
}

export function humanError(code: string, message: string): string {
  switch (code.toLowerCase()) {
    case "unauthorized":
    case "forbidden":
      return "This session couldn't be authorised. The connection key may have expired — try starting again.";
    case "server_error":
      return "The voice service is at capacity right now. Give it a moment and try again.";
    case "agent_timeout":
    case "agent_init_failed":
      return "The agent didn't come online in time. Try starting again.";
    case "session_not_found":
    case "session_expired":
    case "session_forbidden":
      return "That conversation has expired. Start a new one.";
    default:
      return message || "Something interrupted the conversation.";
  }
}
