"use client";

import React, { useMemo, useRef, useState } from "react";
import { buildCheatSheet, extractKeyTerms, normalizeText } from "../lib/text";

type GlossaryItem = { term: string; definition: string };

const MODULES = [
  { id: "core", label: "General (auto)" },
  { id: "dmu", label: "Decision-Making Under Uncertainty" },
  { id: "corpfin", label: "Corporate Finance" },
  { id: "analytics", label: "Business Analytics" },
  { id: "strategy", label: "Strategy & Competitive Advantage" },
  { id: "law", label: "Business Law / Governance" }
];

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function buildStandaloneHtml(data: any) {
  const json = JSON.stringify(data).replaceAll("</script>", "<\\/script>");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(data.title || "BCom Y3 Study Pack")}</title>
<style>
  :root{
    --fontSize:${data.a11y.fontSize}px;
    --letterSpacing:${data.a11y.letterSpacing}em;
    --wordSpacing:${data.a11y.wordSpacing}em;
    --lineHeight:${data.a11y.lineHeight};
    --maxWidth: ${data.a11y.maxWidth}px;
  }
  body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin:0; background:#0b0f19; color:#e9eefc; }
  .wrap{ max-width:1100px; margin:0 auto; padding:18px; }
  .card{ background:#101a33; border:1px solid rgba(255,255,255,0.12); border-radius:18px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,0.35); }
  .row{ display:grid; grid-template-columns: 1.2fr 0.8fr; gap:14px; }
  @media (max-width: 920px){ .row{ grid-template-columns:1fr; } }
  .h{ font-size:18px; font-weight:700; margin:0 0 10px; }
  .sub{ opacity:0.8; margin:0 0 14px; }
  .toolbar{ display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 12px; }
  button{ background:#1a2a52; color:#e9eefc; border:1px solid rgba(255,255,255,0.16); padding:8px 10px; border-radius:12px; cursor:pointer; }
  button:hover{ filter:brightness(1.07); }
  button.active{ outline:2px solid rgba(165,190,255,0.9); }
  .sl{ display:grid; grid-template-columns: 150px 1fr 60px; gap:10px; align-items:center; margin:8px 0; }
  input[type="range"]{ width:100%; }
  .reading{
    background: rgba(0,0,0,0.18);
    border:1px solid rgba(255,255,255,0.14);
    border-radius:14px;
    padding:14px;
  }
  .reading .text{
    font-size: var(--fontSize);
    letter-spacing: var(--letterSpacing);
    word-spacing: var(--wordSpacing);
    line-height: var(--lineHeight);
    max-width: var(--maxWidth);
    color:#f1f5ff;
    white-space: pre-wrap;
  }
  .pill{ display:inline-block; padding:3px 8px; border-radius:999px; background:rgba(255,255,255,0.12); margin-right:6px; }
  .small{ font-size:13px; opacity:0.85; }
  .list{ margin:8px 0 0; padding-left:18px; }
  .muted{ opacity:0.75; }
  .grid2{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
  @media (max-width: 720px){ .grid2{ grid-template-columns:1fr; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <p class="h">${escapeHtml(data.title || "BCom Y3 Study Pack")}</p>
    <p class="sub">${escapeHtml(data.subtitle || "")}</p>

    <div class="toolbar">
      <button id="tabStd" class="active">Standard</button>
      <button id="tabAdp">Adapted</button>
      <button id="speak">Read aloud</button>
      <button id="stop">Stop</button>
    </div>

    <div class="grid2">
      <div class="card reading" style="background:rgba(0,0,0,0.12); border-radius:14px;">
        <div class="small muted">Reading view</div>
        <div id="readingText" class="text"></div>
      </div>

      <div class="card" style="background:rgba(0,0,0,0.12); border-radius:14px;">
        <div class="h" style="font-size:15px;">Controls (dyslexia-friendly)</div>
        <div class="sl"><div>Font size</div><input id="fontSize" type="range" min="14" max="28" step="1"><div id="v_fontSize"></div></div>
        <div class="sl"><div>Letter spacing</div><input id="letterSpacing" type="range" min="0" max="0.14" step="0.01"><div id="v_letterSpacing"></div></div>
        <div class="sl"><div>Word spacing</div><input id="wordSpacing" type="range" min="0" max="0.35" step="0.01"><div id="v_wordSpacing"></div></div>
        <div class="sl"><div>Line height</div><input id="lineHeight" type="range" min="1.2" max="2.2" step="0.05"><div id="v_lineHeight"></div></div>
        <div class="sl"><div>Max width</div><input id="maxWidth" type="range" min="520" max="920" step="10"><div id="v_maxWidth"></div></div>

        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.12); margin:12px 0;" />

        <div class="h" style="font-size:15px;">Cheat sheet</div>
        <div class="small"><span class="pill">TL;DR</span> <span id="tldr"></span></div>
        <div style="height:8px;"></div>
        <div class="small"><span class="pill">Key points</span></div>
        <ul id="points" class="list small"></ul>
        <div class="small"><span class="pill">Prompts</span></div>
        <ul id="prompts" class="list small"></ul>

        <div style="height:8px;"></div>
        <div class="h" style="font-size:15px;">Key terms</div>
        <div id="terms" class="small"></div>
      </div>
    </div>
  </div>
</div>

<script>
const DATA = ${json};

function $(id){ return document.getElementById(id); }
function setVar(k, v){ document.documentElement.style.setProperty(k, v); }

let tab = "standard";
function render(){
  const text = tab === "standard" ? DATA.standardText : DATA.adaptedText;
  $("readingText").textContent = text || "";
  $("tldr").textContent = DATA.cheat?.tldr || "";
  $("points").innerHTML = (DATA.cheat?.keyPoints || []).map(x => "<li>"+escapeHtml(x)+"</li>").join("");
  $("prompts").innerHTML = (DATA.cheat?.prompts || []).map(x => "<li>"+escapeHtml(x)+"</li>").join("");
  $("terms").innerHTML = (DATA.glossary || []).map(g => "<span class='pill' title='"+escapeHtml(g.definition)+"'>"+escapeHtml(g.term)+"</span>").join(" ");
}
function escapeHtml(s){
  return (s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function bindSlider(id, varName, suffix, fmt){
  const el = $(id);
  const out = $("v_"+id);
  el.value = DATA.a11y[id];
  function upd(){
    const v = parseFloat(el.value);
    const show = fmt ? fmt(v) : (v + (suffix||""));
    out.textContent = show;
    setVar(varName, v + (suffix||""));
    DATA.a11y[id] = v;
  }
  el.addEventListener("input", upd);
  upd();
}

$("tabStd").onclick = () => {
  tab="standard";
  $("tabStd").classList.add("active"); $("tabAdp").classList.remove("active");
  render();
};
$("tabAdp").onclick = () => {
  tab="adapted";
  $("tabAdp").classList.add("active"); $("tabStd").classList.remove("active");
  render();
};

bindSlider("fontSize", "--fontSize", "px");
bindSlider("letterSpacing", "--letterSpacing", "em", v => v.toFixed(2)+"em");
bindSlider("wordSpacing", "--wordSpacing", "em", v => v.toFixed(2)+"em");
bindSlider("lineHeight", "--lineHeight", "", v => v.toFixed(2));
bindSlider("maxWidth", "--maxWidth", "px");

$("speak").onclick = () => {
  const synth = window.speechSynthesis;
  if (!synth) return alert("SpeechSynthesis not supported in this browser.");
  synth.cancel();
  const u = new SpeechSynthesisUtterance($("readingText").textContent || "");
  u.rate = 1.0;
  u.pitch = 1.0;
  synth.speak(u);
};
$("stop").onclick = () => {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
};

render();
</script>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

export default function Home() {
  const [moduleId, setModuleId] = useState("core");

  const [inputMode, setInputMode] = useState<"text"|"url"|"file">("text");
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<string>("");

  const [standardText, setStandardText] = useState("");
  const [adaptedText, setAdaptedText] = useState("");
  const [glossary, setGlossary] = useState<GlossaryItem[]>([]);
  const [cheat, setCheat] = useState<{tldr:string; keyPoints:string[]; prompts:string[]} | null>(null);

  const [fontSize, setFontSize] = useState(18);
  const [letterSpacing, setLetterSpacing] = useState(0.02);
  const [wordSpacing, setWordSpacing] = useState(0.06);
  const [lineHeight, setLineHeight] = useState(1.6);
  const [maxWidth, setMaxWidth] = useState(760);

  const [tab, setTab] = useState<"standard"|"adapted">("standard");
  const speakingRef = useRef(false);

  const currentText = tab === "standard" ? standardText : adaptedText;

  const readingStyle = useMemo(() => ({
    fontSize: `${fontSize}px`,
    letterSpacing: `${letterSpacing}em`,
    wordSpacing: `${wordSpacing}em`,
    lineHeight: String(lineHeight),
    maxWidth: `${maxWidth}px`,
    whiteSpace: "pre-wrap" as const,
  }), [fontSize, letterSpacing, wordSpacing, lineHeight, maxWidth]);

  async function extractFromFile(file: File) {
    setStatus("Extracting…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Extraction failed");
      setRawText(normalizeText(j.text || ""));
      setStatus(`Extracted ${j.kind} (${j.chars} chars)`);
      setInputMode("text");
    } catch (e: any) {
      setStatus(`Extraction error: ${e.message || e}`);
    }
  }

  async function fetchFromUrl() {
    setStatus("Fetching…");
    try {
      const res = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Fetch failed");
      setRawText(normalizeText(j.text || ""));
      setStatus(`Fetched (${j.chars} chars)`);
      setInputMode("text");
    } catch (e: any) {
      setStatus(`Fetch error: ${e.message || e}`);
    }
  }

  function generatePack() {
    const text = normalizeText(rawText);
    if (!text) {
      setStatus("No text yet — paste text, fetch a URL, or upload a pdf/docx/txt.");
      return;
    }

    const keyTerms = extractKeyTerms(text, 14).map(x => x.term);
    const g: GlossaryItem[] = keyTerms.map(term => ({
      term,
      definition: `Working definition: "${term}" is a key term extracted from the text. (Next step: plug in AI / curated course glossary.)`
    }));

    const cs = buildCheatSheet(text, keyTerms);

    setGlossary(g);
    setCheat(cs);
    setStandardText(text);

    const adapted =
      `ADAPTED SUPPORTS (same content, lower cognitive load):\n` +
      `• Use the sliders to tune readability.\n` +
      `• Check the Key Terms panel while reading.\n` +
      `• Try Read Aloud if your brain prefers audio.\n\n` +
      text;

    setAdaptedText(adapted);
    setStatus("Generated Standard + Adapted pack.");
  }

  function readAloud() {
    const synth = window.speechSynthesis;
    if (!synth) {
      setStatus("SpeechSynthesis not supported in this browser.");
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(currentText || "");
    u.rate = 1.0;
    u.pitch = 1.0;
    u.onend = () => { speakingRef.current = false; };
    speakingRef.current = true;
    synth.speak(u);
  }

  function stopReadAloud() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    speakingRef.current = false;
  }

  function exportHtml() {
    const title = `BCom Y3 Study Pack — ${MODULES.find(m => m.id === moduleId)?.label || "General"}`;
    const payload = {
      title,
      subtitle: `Generated from your inputs • Standard + Adapted • Dyslexia tools • Key terms`,
      moduleId,
      standardText,
      adaptedText,
      glossary,
      cheat,
      a11y: { fontSize, letterSpacing, wordSpacing, lineHeight, maxWidth }
    };
    const html = buildStandaloneHtml(payload);
    download("bcomm-y3-study-pack.html", html);
    setStatus("Exported standalone HTML.");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-5">
      <div className="max-w-6xl mx-auto grid gap-4">
        <header className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <div className="text-xl font-bold">BCom Y3 (UCC) — Neurodivergent Study Pack Generator</div>
          <div className="text-sm opacity-80">
            Inputs → module-aware scaffolding → Standard + Adapted interactive HTML (plus export).
          </div>
        </header>

        <section className="grid lg:grid-cols-[1fr_1fr] gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm opacity-80">Module:</label>
              <select
                className="bg-slate-950/70 border border-white/10 rounded-xl px-3 py-2"
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
              >
                {MODULES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>

              <div className="ml-auto flex gap-2">
                <button className={`px-3 py-2 rounded-xl border border-white/10 ${inputMode==="text" ? "bg-slate-700/40" : "bg-slate-950/40"}`} onClick={() => setInputMode("text")}>Paste Text</button>
                <button className={`px-3 py-2 rounded-xl border border-white/10 ${inputMode==="url" ? "bg-slate-700/40" : "bg-slate-950/40"}`} onClick={() => setInputMode("url")}>Paste Link</button>
                <button className={`px-3 py-2 rounded-xl border border-white/10 ${inputMode==="file" ? "bg-slate-700/40" : "bg-slate-950/40"}`} onClick={() => setInputMode("file")}>Upload File</button>
              </div>
            </div>

            <div className="mt-3">
              {inputMode === "text" && (
                <textarea
                  className="w-full min-h-[240px] bg-slate-950/60 border border-white/10 rounded-2xl p-3 outline-none"
                  placeholder="Paste lecture notes, reading, case study text, etc…"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
              )}

              {inputMode === "url" && (
                <div className="grid gap-2">
                  <input
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl p-3 outline-none"
                    placeholder="Paste a URL (article, course page, blog, etc.)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <button className="px-3 py-2 rounded-xl border border-white/10 bg-slate-800/40" onClick={fetchFromUrl}>Fetch & extract text</button>
                  <div className="text-xs opacity-70">Some sites block scraping. If it fails, copy/paste the text instead.</div>
                </div>
              )}

              {inputMode === "file" && (
                <div className="grid gap-2">
                  <input
                    type="file"
                    className="block w-full text-sm"
                    accept=".pdf,.docx,.txt,.md,.csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) extractFromFile(f);
                    }}
                  />
                  <div className="text-xs opacity-70">Supported now: PDF, DOCX, TXT/MD/CSV. Screenshots (OCR) is next.</div>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button className="px-3 py-2 rounded-xl border border-white/10 bg-slate-800/40" onClick={generatePack}>Generate pack</button>
              <button className="px-3 py-2 rounded-xl border border-white/10 bg-slate-800/40" onClick={exportHtml}>Export HTML</button>
            </div>

            <div className="mt-3 text-sm opacity-80">{status}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm opacity-80">View:</div>
              <button className={`px-3 py-2 rounded-xl border border-white/10 ${tab==="standard" ? "bg-slate-700/40" : "bg-slate-950/40"}`} onClick={() => setTab("standard")}>Standard</button>
              <button className={`px-3 py-2 rounded-xl border border-white/10 ${tab==="adapted" ? "bg-slate-700/40" : "bg-slate-950/40"}`} onClick={() => setTab("adapted")}>Adapted</button>

              <div className="ml-auto flex gap-2">
                <button className="px-3 py-2 rounded-xl border border-white/10 bg-slate-800/40" onClick={readAloud}>Read aloud</button>
                <button className="px-3 py-2 rounded-xl border border-white/10 bg-slate-950/40" onClick={stopReadAloud}>Stop</button>
              </div>
            </div>

            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              <Slider label="Font size" min={14} max={28} step={1} value={fontSize} onChange={setFontSize} unit="px" />
              <Slider label="Line height" min={1.2} max={2.2} step={0.05} value={lineHeight} onChange={setLineHeight} />
              <Slider label="Letter spacing" min={0} max={0.14} step={0.01} value={letterSpacing} onChange={setLetterSpacing} unit="em" />
              <Slider label="Word spacing" min={0} max={0.35} step={0.01} value={wordSpacing} onChange={setWordSpacing} unit="em" />
              <Slider label="Max width" min={520} max={920} step={10} value={maxWidth} onChange={setMaxWidth} unit="px" />
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs opacity-70 mb-2">Reading view (uses the sliders above)</div>
              <div style={readingStyle}>{currentText || "Generate a pack to see content here."}</div>
            </div>

            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-semibold">Cheat sheet</div>
                <div className="text-sm opacity-80 mt-2"><span className="font-semibold">TL;DR: </span>{cheat?.tldr}</div>
                <div className="text-sm mt-3 font-semibold">Key points</div>
                <ul className="text-sm opacity-85 list-disc ml-5">
                  {(cheat?.keyPoints || []).map((x, i) => <li key={i}>{x}</li>)}
                </ul>
                <div className="text-sm mt-3 font-semibold">Prompts</div>
                <ul className="text-sm opacity-85 list-disc ml-5">
                  {(cheat?.prompts || []).map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-semibold">Key terms (hover for definition)</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {glossary.length === 0 && <span className="text-sm opacity-70">No terms yet.</span>}
                  {glossary.map((g) => (
                    <span
                      key={g.term}
                      title={g.definition}
                      className="text-sm px-2 py-1 rounded-full bg-white/10 border border-white/10"
                    >
                      {g.term}
                    </span>
                  ))}
                </div>
                <div className="text-xs opacity-70 mt-3">
                  Next upgrade: per-module curated glossaries + AI-assisted definitions + links to lecture slides.
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="text-xs opacity-70 px-1">
          MVP spine: ingest → extract → generate → support → export (standalone HTML).
        </footer>
      </div>
    </main>
  );
}

function Slider(props: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between text-sm">
        <div className="opacity-80">{props.label}</div>
        <div className="opacity-80 tabular-nums">
          {props.value.toFixed(props.step < 1 ? 2 : 0)}{props.unit || ""}
        </div>
      </div>
      <input
        className="w-full mt-2"
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}