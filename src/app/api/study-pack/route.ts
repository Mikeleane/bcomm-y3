import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function badRequest(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text : "";

    if (!process.env.OPENAI_API_KEY) {
      return badRequest("Missing OPENAI_API_KEY in .env.local");
    }
    if (!text.trim()) {
      return badRequest("Missing 'text' (string) in request body");
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    // Strict function schema => reliably structured output
    // (Strict mode requirements: additionalProperties:false and all fields required.) :contentReference[oaicite:3]{index=3}
    const tools: any[] = [
      {
        type: "function",
        name: "emit_study_pack",
        description:
          "Return a structured study pack for the provided source text (standard + adapted + cheat sheet + glossary + self-test).",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },

            reading: {
              type: "object",
              additionalProperties: false,
              properties: {
                standard_markdown: { type: "string" },
                adapted_markdown: { type: "string" },
              },
              required: ["standard_markdown", "adapted_markdown"],
            },

            cheat_sheet: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                key_points: { type: "array", items: { type: "string" } },
                exam_tips: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "key_points", "exam_tips"],
            },

            glossary: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  term: { type: "string" },
                  definition: { type: "string" },
                  example: { type: "string" },
                },
                required: ["term", "definition", "example"],
              },
            },

            self_test: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                  why_it_matters: { type: "string" },
                },
                required: ["question", "answer", "why_it_matters"],
              },
            },
          },
          required: ["title", "reading", "cheat_sheet", "glossary", "self_test"],
        },
      },
    ];

    // Force the model to call our function (tool_choice forced function). :contentReference[oaicite:4]{index=4}
    const response = await client.responses.create({
      model,
      tools,
      tool_choice: { type: "function", name: "emit_study_pack" },
      input: [
        {
          role: "system",
          content: [
            "You are generating an accessible BComm Year 3 study pack for a neurodivergent learner.",
            "The adapted version must keep the same learning target as the standard version (not oversimplified).",
            "Use clear headings, short paragraphs, and explicit signposting.",
            "Return the result by calling emit_study_pack with arguments matching the schema.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `SOURCE TEXT:\n${text}`,
        },
      ],
    });

    const call = (response as any)?.output?.find(
      (it: any) => it?.type === "function_call" && it?.name === "emit_study_pack"
    );

    if (!call?.arguments) {
      return NextResponse.json(
        { ok: false, error: "Model did not return a function_call payload." },
        { status: 500 }
      );
    }

    const pack = JSON.parse(call.arguments);
    return NextResponse.json({ ok: true, pack });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
