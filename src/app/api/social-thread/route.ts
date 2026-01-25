import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_MODEL_SOCIAL_THREAD || "gpt-4.1-mini";
const API_KEY = process.env.OPENAI_API_KEY;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function callOpenAIChatCompletions(payload: any) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Strip emojis + zero-width joiners etc (Node supports unicode props in modern runtimes)
function stripEmoji(s: string) {
  const x = String(s || "");
  try {
    return x
      .replace(/\p{Extended_Pictographic}/gu, "")
      .replace(/[\u200D\uFE0F]/g, "")
      .trim();
  } catch {
    return x.replace(/[\u200D\uFE0F]/g, "").trim();
  }
}

function normalizeSpeaker(raw: any) {
  const s = stripEmoji(String(raw ?? "")).trim();
  const low = s.toLowerCase();

  if (low.includes("layman")) return "Layman";
  if (low.includes("skeptic")) return "Skeptic";
  if (low.includes("analyst")) return "Analyst";
  if (low.includes("builder")) return "Builder";
  if (low.includes("ethic")) return "Ethicist";

  // fallback: keep simple title-case of whatever came back
  if (!s) return "Analyst";
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

export async function POST(req: Request) {
  if (!API_KEY) return jsonError("Missing OPENAI_API_KEY in environment.", 500);

  const body = await req.json().catch(() => null);
  const text = (body?.text ?? "").toString().trim();
  const tongueInCheek = !!body?.tongueInCheek;

  if (!text) return jsonError("Missing 'text' in JSON body.", 400);

  // OpenAI json_schema validator requirements: include all keys in required
  const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      subtitle: nullableString,

      meta: {
        type: "object",
        additionalProperties: false,
        properties: {
          model: { type: "string" },
          source: { type: "string" },
        },
        required: ["model", "source"],
      },

      concepts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            term: { type: "string" },
            definition: { type: "string" },
            example: nullableString,
          },
          required: ["id", "term", "definition", "example"],
        },
      },

      standard: {
        type: "object",
        additionalProperties: false,
        properties: {
          messages: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                speaker: { type: "string" },
                text: { type: "string" },
                time: nullableString,
              },
              required: ["id", "speaker", "text", "time"],
            },
          },
        },
        required: ["messages"],
      },

      tongue_in_cheek: {
        type: "object",
        additionalProperties: false,
        properties: {
          messages: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                speaker: { type: "string" },
                text: { type: "string" },
                time: nullableString,
              },
              required: ["id", "speaker", "text", "time"],
            },
          },
        },
        required: ["messages"],
      },
    },

    required: ["title", "subtitle", "meta", "concepts", "standard", "tongue_in_cheek"],
  };

  const system = [
    "You generate a social-media-style study thread for a university student.",
    "Goal: access + retention + critical understanding. Accurate > funny.",
    "",
    "CRITICAL FORMAT RULES:",
    "- The speaker field must be PLAIN TEXT ONLY. NO emojis in speaker names.",
    "- Use exactly these speaker names (choose 3–5 total):",
    "  Layman, Analyst, Skeptic, Builder, Ethicist",
    "- Emojis (if any) go in message text, not speaker.",
    "",
    "CONTENT RULES:",
    "- Stay grounded in the input. Do NOT invent facts.",
    "- Include Layman at least twice (asks simple questions + restates in plain English).",
    "- Include at least one skeptical challenge and at least one analytical clarification.",
    "",
    "EMOJI RULES:",
    "- Standard: max 0–3 emojis total across the whole thread.",
    "- Tongue-in-cheek: max 6–10 emojis total. Still readable.",
    "",
    "Output must match the JSON schema exactly.",
  ].join("\n");

  const user = [
    "Turn the following input into a chat-style exchange that teaches the material.",
    "",
    "Rules:",
    "- Concepts must come FROM the input.",
    "- Provide 6–10 concepts with clear definitions (examples can be null).",
    "- standard.messages: 12–18 short messages.",
    "- tongue_in_cheek.messages:",
    "  - If requested: 18–26 messages, more informal, a bit cheeky, a few emojis.",
    "  - If not requested: return an empty array for tongue_in_cheek.messages.",
    "- Flow: hook → explanation → quick example → common confusion → summary.",
    "",
    `tongue_in_cheek requested: ${tongueInCheek ? "YES" : "NO"}`,
    "",
    "Input:",
    text,
  ].join("\n");

  const payload: any = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "SocialThreadPack", strict: true, schema },
    },
  };

  const r = await callOpenAIChatCompletions(payload);
  if (!r.ok) {
    const msg = r.data?.error?.message || r.data?.error || `OpenAI error (${r.status})`;
    return jsonError(msg, 500);
  }

  const content = r.data?.choices?.[0]?.message?.content || "";
  const parsed = safeParseJson(content);
  if (!parsed) return jsonError("Model did not return valid JSON for SocialThreadPack.", 500);

  // Belt + braces
  parsed.meta = parsed.meta || { model: MODEL, source: "openai" };
  parsed.meta.model = parsed.meta.model || MODEL;
  parsed.meta.source = parsed.meta.source || "openai";

  parsed.subtitle = parsed.subtitle ?? null;
  parsed.concepts = Array.isArray(parsed.concepts) ? parsed.concepts : [];
  parsed.standard = parsed.standard || { messages: [] };
  parsed.standard.messages = Array.isArray(parsed.standard.messages) ? parsed.standard.messages : [];
  parsed.tongue_in_cheek = parsed.tongue_in_cheek || { messages: [] };
  parsed.tongue_in_cheek.messages = Array.isArray(parsed.tongue_in_cheek.messages) ? parsed.tongue_in_cheek.messages : [];

  // Sanitize speakers (no emoji, stable set)
  for (const m of parsed.standard.messages) m.speaker = normalizeSpeaker(m.speaker);
  for (const m of parsed.tongue_in_cheek.messages) m.speaker = normalizeSpeaker(m.speaker);

  return NextResponse.json(parsed);
}
