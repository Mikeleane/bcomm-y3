"use client";

import { useMemo, useState } from "react";

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

export default function HomePage() {
  const [text, setText] = useState(
    "Managers rarely make decisions with perfect information. Instead, they operate under uncertainty..."
  );
  const [pack, setPack] = useState<StudyPack | null>(null);
  const [tab, setTab] = useState<"standard" | "adapted">("standard");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reading = useMemo(() => {
    if (!pack) return "";
    return tab === "standard"
      ? pack.reading.standard_markdown
      : pack.reading.adapted_markdown;
  }, [pack, tab]);

  async function generate() {
    setLoading(true);
    setErr(null);
    setPack(null);
    try {
      const r = await fetch("/api/study-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Request failed");
      setPack(j.pack);
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        BComm Study Pack (Prototype)
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Paste your course text here..."
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ddd",
            fontFamily: "inherit",
            lineHeight: 1.5,
          }}
        />

        <button
          onClick={generate}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: loading ? "#f5f5f5" : "white",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
            width: 220,
          }}
        >
          {loading ? "Generating..." : "Generate Study Pack"}
        </button>

        {err && (
          <div style={{ color: "crimson", fontWeight: 600 }}>
            Error: {err}
          </div>
        )}
      </div>

      {pack && (
        <section style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{pack.title}</h2>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setTab("standard")}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                fontWeight: 600,
                background: tab === "standard" ? "#f5f5f5" : "white",
              }}
            >
              Standard
            </button>
            <button
              onClick={() => setTab("adapted")}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                fontWeight: 600,
                background: tab === "adapted" ? "#f5f5f5" : "white",
              }}
            >
              Adapted
            </button>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 14,
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
            }}
          >
            {reading}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
              <h3 style={{ marginTop: 0 }}>Cheat Sheet</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{pack.cheat_sheet.summary}</p>
              <h4>Key points</h4>
              <ul>
                {pack.cheat_sheet.key_points.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
              <h4>Exam tips</h4>
              <ul>
                {pack.cheat_sheet.exam_tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>

            <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
              <h3 style={{ marginTop: 0 }}>Glossary</h3>
              <ul>
                {pack.glossary.map((g, i) => (
                  <li key={i}>
                    <b>{g.term}</b>: {g.definition}
                    <div style={{ opacity: 0.8, marginTop: 4 }}>
                      Example: {g.example}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
            <h3 style={{ marginTop: 0 }}>Self-test</h3>
            <ol>
              {pack.self_test.map((q, i) => (
                <li key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700 }}>{q.question}</div>
                  <div><b>Answer:</b> {q.answer}</div>
                  <div style={{ opacity: 0.85 }}><b>Why it matters:</b> {q.why_it_matters}</div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </main>
  );
}
