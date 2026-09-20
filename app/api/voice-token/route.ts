import { NextResponse } from "next/server";

/**
 * Mints a short-lived Voice Agent token so the permanent key never reaches
 * the browser. A WebSocket handshake can't carry an Authorization header, so
 * the client passes this as ?token= instead.
 *
 * Two things differ from the rest of AssemblyAI and both are easy to get
 * wrong: this product wants `Authorization: Bearer <key>` (the streaming STT
 * API takes the raw key), and the tokens are single-use — one token opens
 * exactly one session, so the client refetches on every connect.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "The voice service isn't configured. Add ASSEMBLYAI_API_KEY to .env.local and restart." },
      { status: 500 },
    );
  }

  const url = new URL("https://agents.assemblyai.com/v1/token");
  url.searchParams.set("expires_in_seconds", "300");
  // A conversation that gets abandoned with the tab open shouldn't bill for
  // three hours. Twenty minutes is far longer than anyone needs here.
  url.searchParams.set("max_session_duration_seconds", "1200");

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    if (!res.ok) {
      // The upstream body can contain account detail — log it, don't ship it.
      console.error(`[voice-token] ${res.status}: ${await res.text()}`);
      return NextResponse.json(
        { error: "Couldn't reach the voice service. Try again in a moment." },
        { status: 502 },
      );
    }

    const { token } = (await res.json()) as { token: string };
    return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[voice-token]", e);
    return NextResponse.json(
      { error: "Couldn't reach the voice service. Check your connection and try again." },
      { status: 502 },
    );
  }
}
