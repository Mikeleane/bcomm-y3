import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type StudyPack = {
  title: string;
  reading: {
    standard_markdown: string;
    adapted_markdown: string;
  };
  cheat_sheet: {
    summary: string;
    key_points: string[];
    exam_tips: string[];
  };
  glossary: { term: string; definition: string; example: string }[];
  self_test: { question: string; answer: string; why_it_matters: string }[];
};

const ADAPTED_RULES = `
ADAPTED = same learning target + same key content + same terminology, but lower cognitive load.
It must NOT "simplify" by removing ideas.

Hard rules:
1) Preserve academic core: keep all key concepts, technical terms, claims, numbers, names.
2) Reduce cognitive load via structure: chunking, headings, signposts, shorter sentences, lists.
3) Do NOT synonym-swap technical terms. Prefer consistent wording.
4) Allowed to remove fluff/repetition. Not allowed to remove qualifiers that change meaning.
5) REQUIRED sections in adapted_markdown, in this order:
   ## Goal
   ## Key terms
   ## Reading (chunked)
   ## Checkpoints
   ## Exam moves
6) Coverage: Adapted must be within ~70%+ of Standard length (or include the same reading chunked).
7) Glossary: 10–16 terms that are specific to the input topic (avoid generic always-the-same terms).
8) No content drift: do not add new claims or theories not supported by the source.
`.trim();

function clamp(s: string, n: number) {
  const t = (s || "").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

function cleanSource(raw: string) {
  let t = (raw || "").replace(/\r\n/g, "\n");

  // common paste-noise
  t = t.replace(/^\s*skip to main content.*$/gim, "");
  t = t.replace(/^\s*skip to navigation.*$/gim, "");
  t = t.replace(/^\s*cookies.*$/gim, "");
  t = t.replace(/\n{3,}/g, "\n\n").trim();

  return t;
}

function inferTitle(text: string) {
  const t = (text || "").trim();
  const firstLine = t
    .split(/\r?\n/)
    .map((x) => x.trim())
    .find(Boolean) || "Study Pack";

  if (/^https?:\/\//i.test(firstLine)) return "Study Pack";
  return clamp(firstLine.replace(/^#+\s*/, ""), 72) || "Study Pack";
}

function escapeRegExp(s: string) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chunkAsParagraphs(text: string) {
  const raw = (text || "").trim();
  const paras = raw
    .split(/\r?\n\s*\r?\n/g)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paras.length <= 1) {
    const sentences = raw
      .split(/(?<=[.!?])\s+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const out: string[] = [];
    let buf: string[] = [];
    for (const s of sentences) {
      buf.push(s);
      if (buf.join(" ").length >= 420) {
        out.push(buf.join(" "));
        buf = [];
      }
    }
    if (buf.length) out.push(buf.join(" "));
    return out.length ? out : [raw];
  }
  return paras;
}

function extractKeyTerms(text: string, max = 12) {
  const stop = new Set([
    "the","a","an","and","or","but","if","then","else","so","to","of","in","on","for","with","as","at","by",
    "from","into","about","over","under","between","within","without","is","are","was","were","be","been","being",
    "it","this","that","these","those","we","you","they","i","he","she","them","our","your","their","can","could",
    "should","would","may","might","will","just","also","than","more","most","less","very","not","no","yes"
  ]);

  const words = (text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s\-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 5 && !stop.has(w) && !/^\d+$/.test(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w)
    .map((w) => w.replace(/^\w/, (c) => c.toUpperCase()));
}

function validatePack(pack: StudyPack) {
  const reasons: string[] = [];
  const standard = String(pack?.reading?.standard_markdown || "");
  const adapted = String(pack?.reading?.adapted_markdown || "");

  if (!standard.trim()) reasons.push("missing_standard");
  if (!adapted.trim()) reasons.push("missing_adapted");

  // required headings in order (loose check: must appear)
  const mustHave = ["goal", "key terms", "reading", "checkpoints", "exam moves"];
  const aLower = adapted.toLowerCase();
  for (const h of mustHave) {
    if (!aLower.includes(h)) reasons.push(`missing_section_${h.replace(/\s+/g, "_")}`);
  }

  // length guardrail (only if both non-empty)
  if (standard.trim() && adapted.trim()) {
    const minLen = Math.floor(standard.length * 0.70);
    if (adapted.length < minLen) reasons.push("adapted_too_short");
  }

  // glossary-term coverage (not absolute, but should be decent)
  const terms = (pack?.glossary || [])
    .map((g) => String(g?.term || "").trim())
    .filter((t) => t.length >= 2);

  if (terms.length >= 6 && adapted.trim()) {
    let hit = 0;
    const missing: string[] = [];
    for (const term of terms) {
      const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
      if (re.test(adapted)) hit++;
      else missing.push(term);
    }
    const ratio = hit / terms.length;
    if (ratio < 0.60) reasons.push(`low_term_coverage_${Math.round(ratio * 100)}pct (missing e.g. ${missing.slice(0, 6).join(", ")})`);
  }

  return { ok: reasons.length === 0, reasons };
}

function localFallback(text: string): StudyPack {
  const title = inferTitle(text);
  const paras = chunkAsParagraphs(text);
  const keyTerms = extractKeyTerms(text, 12);

  const glossary = keyTerms.map((term) => ({
    term,
    definition: "Key term drawn from the source text. (Enable OpenAI for a precise definition.)",
    example: `Example: Use "${term}" correctly in a sentence that matches the reading.`,
  }));

  const standard = `# ${title}\n\n${paras.join("\n\n")}\n`;

  const adapted =
`# ${title}

## Goal
Be able to explain the main idea(s), use the key terms accurately, and answer exam-style prompts without losing the plot.

## Key terms
${keyTerms.map(t => `- ${t}`).join("\n")}

## Reading (chunked)
${paras.map((p, i) => `### Chunk ${i + 1}\n${p}\n\n**Gist (1 sentence):** …`).join("\n\n")}

## Checkpoints
- What was the main claim / point in Chunk 1?
- Which term(s) are doing the most work here?
- What assumption is being made (explicit or hidden)?

## Exam moves
- Define 2 key terms using the glossary.
- Compare two ideas from different chunks.
- Apply the concept to a simple real-world example.
`;

  const cheat_sheet = {
    summary:
      "Cheet Sheet mode: skim this, then do 3 chunks of the reading. Your brain gets points for staying on the rails.",
    key_points: [
      "Write the main claim in 1 sentence.",
      "Underline assumptions (they love hiding).",
      "Separate: facts vs inferences vs opinions.",
      "Use the same technical terms (don’t synonym-swap).",
      "After each chunk: 1-sentence gist + 1 question.",
      "Link every point to an exam verb: define / compare / apply / evaluate.",
      "If stuck: explain it to a first-year student without losing accuracy.",
      "Finish with: ‘So what?’ (implication).",
    ],
    exam_tips: [
      "Define + distinguish 2 key terms, then give a 1-line example each.",
      "Use ‘because’ sentences: claim because evidence.",
      "Add one limitation: when does the argument fail?",
      "If asked ‘evaluate’: give 2 strengths + 1 weakness.",
      "If asked ‘apply’: name context → apply concept → predict outcome.",
      "If asked ‘compare’: same/different + why it matters.",
    ],
  };

  const self_test = [
    {
      question: "What is the central claim / purpose of the text?",
      answer: "State it in one sentence.",
      why_it_matters: "If you can’t name it, you can’t evaluate it.",
    },
    {
      question: "Name two key terms and explain how they connect.",
      answer: "Term A affects Term B because …",
      why_it_matters: "Connection is where marks live.",
    },
    {
      question: "What’s one assumption the text relies on?",
      answer: "Assumption: …",
      why_it_matters: "Assumptions are exam-grade critique fuel.",
    },
    {
      question: "Give one possible limitation or counterpoint.",
      answer: "Limitation: …",
      why_it_matters: "Evaluation questions want balance.",
    },
    {
      question: "Write one exam-style question this text prepares you for.",
      answer: "Example prompt: …",
      why_it_matters: "This trains transfer, not memorization.",
    },
  ];

  return { title, reading: { standard_markdown: standard, adapted_markdown: adapted }, cheat_sheet, glossary, self_test };
}

async function generateWithOpenAI(client: OpenAI, model: string, source: string) {
  const prompt =
`You generate a StudyPack JSON object for a BCom Year 3 student.

${ADAPTED_RULES}

SOURCE TEXT:
"""
${source}
"""

Return JSON with EXACT keys:
{
  "title": string,
  "reading": { "standard_markdown": string, "adapted_markdown": string },
  "cheat_sheet": { "summary": string, "key_points": string[], "exam_tips": string[] },
  "glossary": { "term": string, "definition": string, "example": string }[],
  "self_test": { "question": string, "answer": string, "why_it_matters": string }[]
}

Extra requirements:
- Standard: study-friendly markdown, keep paragraph breaks.
- Adapted: MUST include the REQUIRED sections in order, and include the SAME key content as Standard.
- Glossary: 10–16 terms SPECIFIC to THIS source (avoid generic repeats unless central here).
- Cheat sheet: make it 'cheetier' (high-utility cram): short summary + 6–10 key points + 6 exam tips.
- Self-test: 6 questions.
`;

  const resp = await client.chat.completions.create({
    model,
    temperature: 0.25,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You output only valid JSON matching the requested schema." },
      { role: "user", content: prompt },
    ],
  });

  const content = resp.choices?.[0]?.message?.content || "";
  return JSON.parse(content) as StudyPack;
}

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const rawText = typeof body?.text === "string" ? body.text : "";
  const source = cleanSource(rawText);

  if (!source.trim()) {
    return NextResponse.json({ error: "Missing 'text' in JSON body." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  // no key -> never crash
  if (!apiKey) {
    const pack = localFallback(source);
    const v = validatePack(pack);
    return NextResponse.json({ ...pack, _meta: { source: "local", reason: "missing_OPENAI_API_KEY", validated: v.ok, validation_reasons: v.reasons } });
  }

  const client = new OpenAI({ apiKey });

  try {
    // Attempt 1
    let pack = await generateWithOpenAI(client, model, source);
    let v = validatePack(pack);

    // Auto-repair once if adapted violates rules
    if (!v.ok) {
      const repairSource = `${source}\n\n(Repair notes: Previous output failed: ${v.reasons.join("; ")})`;
      pack = await generateWithOpenAI(client, model, repairSource);
      v = validatePack(pack);
      return NextResponse.json({ ...pack, _meta: { source: "openai", model, attempts: 2, validated: v.ok, validation_reasons: v.reasons } });
    }

    return NextResponse.json({ ...pack, _meta: { source: "openai", model, attempts: 1, validated: v.ok, validation_reasons: v.reasons } });
  } catch (err: any) {
    console.error("API /api/generate error:", err?.message || err);

    const pack = localFallback(source);
    const v = validatePack(pack);
    return NextResponse.json({
      ...pack,
      _meta: { source: "local", reason: "openai_error", error: String(err?.message || err), validated: v.ok, validation_reasons: v.reasons },
    });
  }
}