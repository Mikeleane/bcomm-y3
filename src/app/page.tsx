"use client";

import React, { useEffect, useMemo, useState } from "react";
import { exportInteractiveHtmlFromState } from "@/lib/interactiveExport";
import { exportSocialThreadHtml } from "@/lib/socialThreadExport";

type GlossaryItem = {
  term: string;
  definition: string;
  example?: string;
};

type CheatSheet = {
  summary?: string;
  key_points?: string[];
  exam_tips?: string[];
};

type SelfTestItem = {
  question: string;
  answer: string;
  why_it_matters?: string;
};

type StudyPack = {
  title: string;
  subtitle?: string;
  reading?: {
    standard_markdown?: string;
    adapted_markdown?: string;
  };
  cheat_sheet?: CheatSheet;
  glossary?: GlossaryItem[];
  self_test?: SelfTestItem[];
  _meta?: {
    source?: string;
    model?: string;
  };
};

type SocialConcept = {
  id: string;
  term: string;
  definition: string;
  example?: string;
};

type SocialMessage = {
  id: string;
  speaker: string;
  text: string;
  time?: string;
};

type SocialVariantBlock = {
  messages: SocialMessage[];
};

type SocialThreadPack = {
  title: string;
  subtitle?: string;
  meta?: {
    model?: string;
    source?: string;
  };
  concepts?: SocialConcept[];
  standard: SocialVariantBlock;
  tongue_in_cheek?: SocialVariantBlock;
};

function escapeRegExp(s: string) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeText(x: any) {
  return (x ?? "").toString();
}

export default function Page() {
  const [text, setText] = useState<string>("");
  const [pack, setPack] = useState<StudyPack | null>(null);
  const [tab, setTab] = useState<"standard" | "adapted">("standard");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<null | "interactive" | "social">(null);
  const [err, setErr] = useState<string>("");

  const [pinned, setPinned] = useState<GlossaryItem | null>(null);

  // Social thread controls
  const [tongueInCheek, setTongueInCheek] = useState<boolean>(false);
  const [embedUnpacks, setEmbedUnpacks] = useState<boolean>(true);
  const [stepByStepDefault, setStepByStepDefault] = useState<boolean>(true);

  const glossary: GlossaryItem[] = useMemo(() => {
    return Array.isArray(pack?.glossary) ? (pack!.glossary as GlossaryItem[]) : [];
  }, [pack]);

  const reading = useMemo(() => {
    const std = safeText(pack?.reading?.standard_markdown);
    const adp = safeText(pack?.reading?.adapted_markdown);
    return tab === "adapted" ? adp : std;
  }, [pack, tab]);

  const metaLine = useMemo(() => {
    const m = pack?._meta;
    if (!m) return "";
    const bits = [];
    if (m.model) bits.push(m.model);
    if (m.source) bits.push(m.source);
    return bits.length ? `meta: ${bits.join(" / ")}` : "";
  }, [pack]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function renderHighlightedText(
    txt: string,
    items: GlossaryItem[],
    onPick: (g: GlossaryItem) => void
  ): React.ReactNode {
    const t = safeText(txt);
    if (!t) return null;
    const terms = items
      .map((g) => safeText(g.term).trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    if (!terms.length) return <span>{t}</span>;

    const map = new Map<string, GlossaryItem>();
    for (const g of items) map.set(safeText(g.term).trim().toLowerCase(), g);

    const re = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
    const parts = t.split(re);

    return (
      <span>
        {parts.map((p: string, i: number) => {
          const key = `${i}-${p}`;
          const g = map.get(p.toLowerCase());
          if (!g) return <React.Fragment key={key}>{p}</React.Fragment>;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(g)}
              title={g.definition}
              style={{
                background: "rgba(99,179,237,0.18)",
                border: "1px solid rgba(99,179,237,0.35)",
                color: "rgba(0,0,0,0.85)",
                padding: "0 6px",
                borderRadius: 8,
                cursor: "pointer",
                margin: "0 2px",
                fontWeight: 800,
              }}
            >
              {p}
            </button>
          );
        })}
      </span>
    );
  }

  async function generateStudyPack() {
    setErr("");
    setPinned(null);
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Generate failed (${res.status})`);
      }
      setPack(data as StudyPack);
      setTab("standard");
    } catch (e: any) {
      setErr(e?.message || "Failed to generate.");
    } finally {
      setLoading(false);
    }
  }

  function exportInteractive() {
    setErr("");
    const currentPack = pack;
    const packTitle = currentPack?.title || "BComm Study Pack (Prototype)";

    const standardText = safeText(currentPack?.reading?.standard_markdown || text);
    const adaptedText = safeText(currentPack?.reading?.adapted_markdown || text);

    if (!standardText.trim()) {
      setErr("Nothing to export yet. Paste text or click Generate Study Pack first.");
      return;
    }

    const cheatSheet = currentPack?.cheat_sheet
      ? {
          summary: safeText(currentPack.cheat_sheet.summary || ""),
          key_points: Array.isArray(currentPack.cheat_sheet.key_points) ? currentPack.cheat_sheet.key_points : [],
          exam_tips: Array.isArray(currentPack.cheat_sheet.exam_tips) ? currentPack.cheat_sheet.exam_tips : [],
        }
      : null;

    const selfTest = Array.isArray(currentPack?.self_test)
      ? currentPack!.self_test!.map((q) => ({
          question: safeText(q.question),
          answer: safeText(q.answer),
          why_it_matters: safeText(q.why_it_matters || ""),
        }))
      : null;

    exportInteractiveHtmlFromState({
      title: packTitle,
      subtitle: "Interactive export (Standard + Adapted, read-aloud, sliders, key terms, cheat sheet).",
      standardText,
      adaptedText,
      glossary,
      cheatSheet,
      selfTest,
      a11y: { fontSize: 18, letterSpacing: 0.02, wordSpacing: 0.06, lineHeight: 1.6, maxWidth: 760 },
    });
  }

  async function exportSocialThread() {
    setErr("");
    setPinned(null);
    setExporting("social");
    try {
      const sourceText = safeText(pack?.reading?.standard_markdown).trim() || safeText(text).trim();

      if (!sourceText) {
        throw new Error("Nothing to export yet. Paste text or click Generate Study Pack first.");
      }

      const res = await fetch("/api/social-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, tongueInCheek }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Social thread API failed (${res.status})`);
      }
      const socialPack = data as SocialThreadPack;

      await exportSocialThreadHtml({
        pack: {
          ...socialPack,
          api: { base: "/api/social-thread" }, // lets exported HTML find /unpack when hosted
        },
        precomputeUnpacks: embedUnpacks, // makes Unpack work in file:// exports
        precomputeLens: "debate",
        precomputeLimitPerVariant: 30,
        htmlOptions: {
          defaultLens: "builder",
          defaultAutoVoices: true,
          defaultSpeakEmojis: false,
          defaultShowEmojis: true,
          defaultPace: stepByStepDefault ? "step" : "all",
          initialVisibleCount: 4,
        },
      });
    } catch (e: any) {
      setErr(e?.message || "Failed to export social thread.");
    } finally {
      setExporting(null);
    }
  }

  async function exportInteractiveAsync() {
    setExporting("interactive");
    try {
      exportInteractive();
    } finally {
      setExporting(null);
    }
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 56, fontWeight: 900, margin: "10px 0 18px", letterSpacing: "-0.02em" }}>
        BComm Study Pack (Prototype)
      </h1>

      <section
        style={{
          border: "1px solid rgba(0,0,0,0.15)",
          borderRadius: 14,
          padding: 16,
          background: "white",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Input</div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text, or a URL, or a topic prompt..."
          style={{
            width: "100%",
            minHeight: 220,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.18)",
            resize: "vertical",
            fontSize: 16,
            lineHeight: 1.45,
          }}
        />

        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={generateStudyPack}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.18)",
              background: loading ? "#f2f2f2" : "white",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
              minWidth: 210,
              fontSize: 18,
            }}
          >
            {loading ? "Generating..." : "Generate Study Pack"}
          </button>

          <button
            onClick={exportInteractiveAsync}
            disabled={!pack || exporting === "interactive"}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.18)",
              background: !pack ? "#f2f2f2" : "white",
              fontWeight: 900,
              cursor: !pack ? "not-allowed" : "pointer",
              fontSize: 18,
            }}
            title={!pack ? "Generate a pack first" : "Export a standalone interactive HTML file"}
          >
            {exporting === "interactive" ? "Exporting..." : "Export Interactive HTML"}
          </button>

          <button
            onClick={exportSocialThread}
            disabled={exporting === "social"}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.18)",
              background: exporting === "social" ? "#f2f2f2" : "white",
              fontWeight: 900,
              cursor: exporting === "social" ? "not-allowed" : "pointer",
              fontSize: 18,
            }}
            title="Generate + export a social-thread style HTML"
          >
            {exporting === "social" ? "Building thread..." : "Export Social Thread HTML"}
          </button>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, userSelect: "none" }}>
            <input type="checkbox" checked={tongueInCheek} onChange={(e) => setTongueInCheek(e.target.checked)} />
            Tongue-in-cheek mode
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, userSelect: "none" }}>
            <input
              type="checkbox"
              checked={stepByStepDefault}
              onChange={(e) => setStepByStepDefault(e.target.checked)}
            />
            Step-by-step thread by default
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, userSelect: "none" }}>
            <input type="checkbox" checked={embedUnpacks} onChange={(e) => setEmbedUnpacks(e.target.checked)} />
            Embed â€œUnpackâ€ for offline (file://)
          </label>
        </div>

        {err ? (
          <div style={{ marginTop: 10, color: "#7a1f1f", fontSize: 14, fontWeight: 700 }}>{err}</div>
        ) : null}
      </section>

      {pack ? (
        <section style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 34, fontWeight: 900, marginBottom: 6 }}>{pack.title}</h2>
          {metaLine ? (
            <div style={{ fontSize: 14, color: "rgba(0,0,0,0.55)", marginBottom: 10 }}>{metaLine}</div>
          ) : null}

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <button
              onClick={() => setTab("standard")}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.18)",
                background: tab === "standard" ? "#f0f0f0" : "white",
                fontWeight: 900,
                cursor: "pointer",
                fontSize: 18,
              }}
            >
              Standard
            </button>
            <button
              onClick={() => setTab("adapted")}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.18)",
                background: tab === "adapted" ? "#f0f0f0" : "white",
                fontWeight: 900,
                cursor: "pointer",
                fontSize: 18,
              }}
            >
              Adapted
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              alignItems: "start",
            }}
          >
            <div
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 14,
                padding: 14,
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
                fontSize: 16,
                minHeight: 260,
                background: "white",
              }}
            >
              {renderHighlightedText(reading, glossary, (g) => setPinned(g))}
            </div>

            <div
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 14,
                padding: 14,
                background: "white",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 10, fontSize: 18 }}>Glossary</div>

              {pinned ? (
                <div
                  style={{
                    border: "1px solid rgba(0,0,0,0.12)",
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 12,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{pinned.term}</div>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{pinned.definition}</div>
                  {pinned.example ? (
                    <div style={{ marginTop: 8, fontSize: 14, color: "rgba(0,0,0,0.70)" }}>
                      <b>Example:</b> {pinned.example}
                    </div>
                  ) : null}
                  <button
                    onClick={() => setPinned(null)}
                    style={{
                      marginTop: 10,
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.18)",
                      background: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Clear (Esc)
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: "rgba(0,0,0,0.65)", marginBottom: 12 }}>
                  Click a highlighted term to pin it here. Press <b>Esc</b> to clear.
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {glossary.map((g) => (
                  <button
                    key={g.term}
                    type="button"
                    onClick={() => setPinned(g)}
                    title={g.definition}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.14)",
                      background: "rgba(0,0,0,0.04)",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 900,
                    }}
                  >
                    {g.term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}



