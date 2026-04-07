import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

export async function POST(req: Request) {
  try {
    const openai = getOpenAI();
    const body = await req.json().catch(() => ({}));

    // ✅ PUT YOUR EXISTING STUDY-PACK GENERATION LOGIC HERE
    // Use `openai` only inside this handler (never at top-level).
    // Example placeholder response:
    return NextResponse.json({ ok: true, receivedKeys: Object.keys(body || {}) });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/study-pack" });
}
