import { NextResponse } from "next/server";

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

  url.searchParams.set("max_session_duration_seconds", "1200");

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    if (!res.ok) {

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
