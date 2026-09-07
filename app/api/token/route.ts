import { NextResponse } from "next/server";

// Browsers can't set headers on a WebSocket handshake, so the permanent API
// key never leaves the server — we mint a short-lived token instead and the
// client passes it as ?token=.
export async function GET() {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ASSEMBLYAI_API_KEY is not set. Add it to .env.local." },
      { status: 500 },
    );
  }

  const url = new URL("https://streaming.assemblyai.com/v3/token");
  url.searchParams.set("expires_in_seconds", "300");

  const res = await fetch(url, { headers: { Authorization: key }, cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json(
      { error: `Token request failed (${res.status}): ${await res.text()}` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as { token: string };
  return NextResponse.json({ token: data.token }, {
    headers: { "Cache-Control": "no-store" },
  });
}
