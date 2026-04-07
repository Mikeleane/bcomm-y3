"use client";

/**
 * Social Thread standalone HTML export (BComm Y3)
 * - Standard / Tongue-in-cheek
 * - Lens dropdown
 * - Unpack ðŸ§© (tap-to-reveal hidden convo). Works:
 *    - Online: fetches /api/social-thread/unpack
 *    - Offline (file://): ONLY if unpacks were precomputed + embedded at export time
 * - Read-aloud with multi-voice (auto voices per speaker) + emoji stripping for TTS
 * - Emoji display toggle (visual), and "speak emojis" toggle (TTS)
 * - Optional "pace" mode: show all vs step-by-step reveal
 */

export type SocialConcept = {
  id: string;
  term: string;
  definition: string;
  example?: string | null;
};

export type SocialMessage = {
  id: string;
  speaker: string;
  text: string;
  time?: string | null;
};

export type SocialVariantBlock = {
  messages: SocialMessage[];
};

export type SocialThreadPack = {
  title: string;
  subtitle?: string | null;
  meta?: { model?: string; source?: string | null };
  concepts?: SocialConcept[];
  standard: SocialVariantBlock;
  tongue_in_cheek?: SocialVariantBlock;

  /**
   * Optional embedded unpacks for offline exports.
   * Keying format: `${variant}|${lens}|${messageId}`
   */
  unpacks?: Record<string, UnpackResult>;

  /**
   * Optional API config for hosted mode.
   * base should be "/api/social-thread" in your Next app.
   */
  api?: { base?: string };
};

export type Lens = "debate" | "skeptic" | "analyst" | "builder" | "ethicist";

export type UnpackResult = {
  core: {
    claim: string | null;
    evidence: string | null;
    assumptions: string | null;
    implications: string | null;
  };
  steps: Array<{ speaker: string; text: string }>;
};

export type BuildSocialThreadHtmlOptions = {
  apiBase?: string; // default: "/api/social-thread"
  defaultLens?: Lens; // default: "builder" (nice for business)
  defaultVariant?: "standard" | "tongue_in_cheek"; // default: "standard"
  defaultPace?: "all" | "step"; // default: "all"
  initialVisibleCount?: number; // when pace=step, default 4

  // UI defaults
  defaultAutoVoices?: boolean; // default true
  defaultSpeakEmojis?: boolean; // default false
  defaultShowEmojis?: boolean; // default true

  // If true, include a small API base input box in Tools panel
  showApiBaseControl?: boolean; // default true
};

export type ExportSocialThreadHtmlOptions = {
  pack: SocialThreadPack;
  filename?: string;
  htmlOptions?: BuildSocialThreadHtmlOptions;

  /**
   * If true, compute unpacks (for standard + optional tongue) and embed them.
   * This makes Unpack work even when you open the exported HTML via file://
   */
  precomputeUnpacks?: boolean;

  /**
   * Which lens to precompute unpacks for (offline exports). Default "debate".
   * Online users can still switch lens and fetch new ones when hosted.
   */
  precomputeLens?: Lens;

  /**
   * Safety valve: limit number of messages to precompute (per variant).
   * Default: Infinity (all messages).
   */
  precomputeLimitPerVariant?: number;
};

// -------------------- Public helpers --------------------

export async function exportSocialThreadHtml(opts: ExportSocialThreadHtmlOptions) {
  const pack = structuredCloneOrFallback(opts.pack);

  if (opts.precomputeUnpacks) {
    const lens: Lens = opts.precomputeLens || "debate";
    const limit = Number.isFinite(opts.precomputeLimitPerVariant as any)
      ? Number(opts.precomputeLimitPerVariant)
      : Infinity;

    pack.unpacks = pack.unpacks || {};
    const computed = await precomputeUnpacks(pack, { lens, limitPerVariant: limit });
    pack.unpacks = { ...(pack.unpacks || {}), ...computed };
  }

  const html = buildSocialThreadHtml(pack, opts.htmlOptions);

  const fname =
    opts.filename ||
    safeFilename(pack.title || "social-thread") +
      "-social-thread-" +
      new Date().toISOString().slice(0, 10) +
      ".html";

  downloadTextFile(fname, html, "text/html;charset=utf-8");
}

export function buildSocialThreadHtml(pack: SocialThreadPack, options?: BuildSocialThreadHtmlOptions) {
  const o: Required<BuildSocialThreadHtmlOptions> = {
    apiBase: options?.apiBase ?? pack.api?.base ?? "/api/social-thread",
    defaultLens: options?.defaultLens ?? "builder",
    defaultVariant: options?.defaultVariant ?? "standard",
    defaultPace: options?.defaultPace ?? "all",
    initialVisibleCount: options?.initialVisibleCount ?? 1,
    defaultAutoVoices: options?.defaultAutoVoices ?? true,
    defaultSpeakEmojis: options?.defaultSpeakEmojis ?? false,
    defaultShowEmojis: options?.defaultShowEmojis ?? true,
    showApiBaseControl: options?.showApiBaseControl ?? true,
  };

  // Safer embed (avoid closing script tag issues)
  const packJson = jsonForScriptTag(pack);

  const apiBaseEsc = escapeHtmlAttr(o.apiBase);
  const lensEsc = escapeHtmlAttr(o.defaultLens);
  const variantEsc = escapeHtmlAttr(o.defaultVariant);
  const paceEsc = escapeHtmlAttr(o.defaultPace);

  // Build HTML
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(pack.title || "Social thread")}</title>
<style>
  :root{
    --bg:#070b14;
    --panel:rgba(255,255,255,0.04);
    --panel2:rgba(255,255,255,0.06);
    --line:rgba(255,255,255,0.10);
    --text:rgba(255,255,255,0.92);
    --muted:rgba(255,255,255,0.65);
    --muted2:rgba(255,255,255,0.50);
    --accent:rgba(99, 179, 237, 0.95);
    --good:rgba(72, 187, 120, 0.95);
    --warn:rgba(237, 137, 54, 0.95);
    --shadow:0 12px 40px rgba(0,0,0,0.45);
    --radius:18px;
    --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
  }
  html,body{height:100%;}
  body{
    margin:0;
    font-family:var(--sans);
    background: radial-gradient(1200px 700px at 10% 0%, rgba(99,179,237,0.10), transparent 45%),
                radial-gradient(1000px 650px at 95% 10%, rgba(237,137,54,0.08), transparent 45%),
                var(--bg);
    color:var(--text);
  }
  .wrap{max-width:1200px;margin:0 auto;padding:24px;}
  .card{
    border:1px solid var(--line);
    background:linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
    border-radius:var(--radius);
    box-shadow:var(--shadow);
    overflow:hidden;
  }
  header{
    padding:18px 18px 14px 18px;
    border-bottom:1px solid var(--line);
  }
  h1{margin:0;font-size:28px;letter-spacing:-0.02em}
  .sub{margin-top:6px;color:var(--muted);font-size:14px}

  .toolbar{
    margin-top:14px;
    display:flex;
    flex-wrap:wrap;
    gap:10px;
    align-items:center;
  }
  .btn{
    appearance:none;
    border:1px solid var(--line);
    background:rgba(255,255,255,0.04);
    color:var(--text);
    padding:10px 12px;
    border-radius:999px;
    cursor:pointer;
    font-weight:800;
    font-size:13px;
  }
  .btn:hover{background:rgba(255,255,255,0.07);}
  .btn.on{
    border-color:rgba(99,179,237,0.55);
    box-shadow:0 0 0 2px rgba(99,179,237,0.18) inset;
    background:rgba(99,179,237,0.08);
  }

  .pillbox{
    border:1px solid var(--line);
    background:rgba(0,0,0,0.18);
    border-radius:999px;
    padding:10px 12px;
    display:flex;
    align-items:center;
    gap:10px;
  }
  .pillbox label{color:var(--muted);font-weight:900;font-size:12px;white-space:nowrap}
  .pillbox input, .pillbox select{
    width:100%;
    background:transparent;
    border:0;
    outline:none;
    color:var(--text);
    font-size:14px;
  }
  .pillbox select{appearance:none}

  .meta{
    margin-top:10px;
    font-size:12px;
    color:var(--muted2);
  }

  .grid{
    display:grid;
    grid-template-columns: 1fr 360px;
    gap:16px;
    padding:16px;
  }
  @media (max-width: 980px){
    .grid{grid-template-columns:1fr;}
  }

  .panel{
    border:1px solid var(--line);
    border-radius:var(--radius);
    background:rgba(255,255,255,0.03);
    overflow:hidden;
  }
  .panel .ph{
    padding:12px 12px;
    border-bottom:1px solid var(--line);
    font-weight:900;
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:10px;
  }
  .panel .pb{padding:12px;}

  .msg{
    display:flex;
    gap:12px;
    margin-bottom:12px;
  }
  .avatar{
    width:36px;height:36px;border-radius:999px;
    background:rgba(255,255,255,0.06);
    border:1px solid var(--line);
    flex:0 0 auto;
    display:flex;align-items:center;justify-content:center;
    color:rgba(255,255,255,0.85);
    font-weight:1000;
  }
  .bubble{
    flex:1;
    border:1px solid var(--line);
    border-radius:16px;
    background:rgba(255,255,255,0.04);
    padding:10px 12px;
  }
  .topline{
    display:flex;align-items:baseline;justify-content:space-between;gap:10px;
    margin-bottom:6px;
  }
  .speaker{font-weight:1000}
  .badgeEmoji{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:18px;height:18px;
    border-radius:6px;
    background:rgba(255,255,255,0.06);
    border:1px solid var(--line);
    margin-left:8px;
    font-size:12px;
    line-height:1;
  }
  .time{color:var(--muted2);font-size:12px}
  .text{line-height:1.5;white-space:pre-wrap}
  mark{
    background:rgba(237, 137, 54, 0.20);
    color:var(--text);
    padding:0 4px;
    border-radius:6px;
  }

  .actions{margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;}
  .miniBtn{
    appearance:none;
    border:1px solid var(--line);
    background:rgba(255,255,255,0.04);
    color:var(--text);
    padding:7px 10px;
    border-radius:999px;
    cursor:pointer;
    font-weight:1000;
    font-size:12px;
  }
  .miniBtn:hover{ background:rgba(255,255,255,0.08); }
  .miniBtn.good{ border-color:rgba(72,187,120,0.45); background:rgba(72,187,120,0.08); }
  .miniBtn.warn{ border-color:rgba(237,137,54,0.45); background:rgba(237,137,54,0.08); }

  .pillrow{display:flex;flex-wrap:wrap;gap:8px}
  .pill{
    border:1px solid var(--line);
    background:rgba(255,255,255,0.04);
    border-radius:999px;
    padding:8px 10px;
    cursor:pointer;
    font-weight:900;
    font-size:13px;
  }
  .pill:hover{background:rgba(255,255,255,0.07)}
  .conceptBox{
    border:1px solid var(--line);
    border-radius:16px;
    background:rgba(0,0,0,0.18);
    padding:12px;
  }
  .conceptTerm{font-weight:1000;font-size:16px}
  .conceptDef{margin-top:8px;color:var(--muted);line-height:1.5}
  .conceptEx{margin-top:10px;border-top:1px dashed var(--line);padding-top:10px;color:var(--muted);font-size:13px}

  .toolBox{
    border:1px solid var(--line);
    border-radius:16px;
    background:rgba(0,0,0,0.18);
    padding:12px;
  }
  .row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    margin-top:10px;
    color:var(--muted);
    font-size:13px;
  }
  .row input[type="text"], .row select{
    width:100%;
    background:rgba(255,255,255,0.03);
    border:1px solid var(--line);
    color:var(--text);
    border-radius:12px;
    padding:8px 10px;
    outline:none;
  }
  .row label{display:flex;align-items:center;gap:8px;cursor:pointer}

  .unpack{
    margin-top:10px;
    border:1px solid var(--line);
    border-radius:16px;
    background:rgba(0,0,0,0.18);
    overflow:hidden;
  }
  .unpackHead{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding:10px 12px;
    border-bottom:1px solid var(--line);
  }
  .unpackTitle{ font-weight:1000; font-size:13px; }
  .unpackSub{ color:var(--muted2); font-size:12px; margin-top:2px; }
  .unpackBody{ padding:10px 12px; }

  .coreBox{
    border:1px dashed var(--line);
    border-radius:14px;
    padding:10px;
    background:rgba(255,255,255,0.03);
  }
  .coreRow{ margin-top:6px; color:var(--muted); line-height:1.45; font-size:13px; }
  .coreRow b{ color:var(--text); }

  .miniThread{ margin-top:10px; display:flex; flex-direction:column; gap:8px; }
  .miniMsg{
    border:1px solid var(--line);
    border-radius:14px;
    background:rgba(255,255,255,0.03);
    padding:9px 10px;
  }
  .miniTop{ display:flex; justify-content:space-between; gap:10px; margin-bottom:4px; }
  .miniSpeaker{ font-weight:1000; font-size:12px; }
  .miniText{ color:var(--text); line-height:1.5; font-size:13px; white-space:pre-wrap; }

  .loader{
    display:inline-flex;
    align-items:center;
    gap:8px;
    color:var(--muted);
    font-size:13px;
  }
  .dot{ width:6px; height:6px; border-radius:999px; background:rgba(255,255,255,0.35); animation:pulse 1.2s infinite; }
  .dot:nth-child(2){ animation-delay:0.2s; }
  .dot:nth-child(3){ animation-delay:0.4s; }
  @keyframes pulse{ 0%,100%{opacity:.3} 50%{opacity:1} }

  .hint{
    margin-top:10px;
    color:var(--muted2);
    font-size:12px;
    line-height:1.35;
  }

  /* Hide emoji decorations when "show emojis" is off */
  body.noEmoji .badgeEmoji { display:none; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <header>
      <h1 id="title"></h1>
      <div class="sub" id="subtitle"></div>

      <div class="toolbar">
        <button class="btn" id="btnStd">Standard</button>
        <button class="btn" id="btnCheeky">Tongue-in-cheek</button>

        <button class="btn" id="btnRead">Read aloud</button>
        <button class="btn" id="btnStop">Stop</button>

        <div class="pillbox" style="max-width:240px;flex:0 0 auto;">
          <label>Lens</label>
          <select id="lens">
            <option value="debate">Debate</option>
            <option value="skeptic">Skeptic</option>
            <option value="analyst">Analyst</option>
            <option value="builder">Builder</option>
            <option value="ethicist">Ethicist</option>
          </select>
        </div>

        <div class="pillbox" style="max-width:200px;flex:0 0 auto;">
          <label>Pace</label>
          <select id="pace">
            <option value="all">All</option>
            <option value="step">Step-by-step</option>
          </select>
        </div>

        <div class="pillbox" style="flex:1;min-width:220px;">
          <label>Search</label>
          <input id="search" placeholder="Search the thread..." />
        </div>

        <button class="btn" id="btnClear">Clear</button>
      </div>

      <div class="meta" id="meta"></div>
    </header>

    <div class="grid">
      <section class="panel">
        <div class="ph">
          <span>Thread</span>
          <span style="display:flex;gap:8px;align-items:center">
            <button class="miniBtn good" id="btnNext" title="Reveal next message">Next ðŸ‘‰</button>
            <button class="miniBtn" id="btnAll" title="Show all messages">Show all ðŸ“œ</button>
          </span>
        </div>
        <div class="pb" id="thread"></div>
      </section>

      <aside class="panel">
        <div class="ph">Tools</div>
        <div class="pb">

          <div class="toolBox">
            <div style="font-weight:1000">Read-aloud voices</div>
            <div class="hint">Auto voices assigns a different voice per speaker when available. Emojis are stripped from spoken text unless you enable â€œSpeak emojisâ€.</div>

            ${o.showApiBaseControl ? `
            <div class="row">
              <span style="min-width:70px">API base</span>
              <input id="apiBase" type="text" value="${apiBaseEsc}" />
            </div>` : ""}

            <div class="row">
              <span style="min-width:70px">Voice</span>
              <select id="voice"></select>
            </div>

            <div class="row">
              <label><input type="checkbox" id="autoVoices" /> Auto voices per speaker</label>
            </div>

            <div class="row">
              <label><input type="checkbox" id="showEmojis" /> Show emojis</label>
            </div>

            <div class="row">
              <label><input type="checkbox" id="speakEmojis" /> Speak emojis (TTS)</label>
            </div>

            <div class="hint" id="offlineHint" style="display:none"></div>
          </div>

          <div style="height:14px"></div>

          <div class="pillrow" id="terms"></div>
          <div style="height:12px"></div>
          <div class="conceptBox" id="conceptBox">
            <div style="color:var(--muted);font-size:13px">
              Tap a term to view its definition here.
            </div>
          </div>

        </div>
      </aside>
    </div>
  </div>
</div>

<script>
  const PACK = ${packJson};

  // Defaults
  const DEFAULT_VARIANT = "${variantEsc}";
  const DEFAULT_LENS = "${lensEsc}";
  const DEFAULT_PACE = "${paceEsc}";
  const DEFAULT_VISIBLE = ${Number(o.initialVisibleCount)};

  const DEFAULT_AUTO_VOICES = ${o.defaultAutoVoices ? "true" : "false"};
  const DEFAULT_SHOW_EMOJIS = ${o.defaultShowEmojis ? "true" : "false"};
  const DEFAULT_SPEAK_EMOJIS = ${o.defaultSpeakEmojis ? "true" : "false"};

  // DOM
  const titleEl = document.getElementById("title");
  const subEl = document.getElementById("subtitle");
  const metaEl = document.getElementById("meta");
  const threadEl = document.getElementById("thread");
  const termsEl = document.getElementById("terms");
  const conceptBox = document.getElementById("conceptBox");

  const btnStd = document.getElementById("btnStd");
  const btnCheeky = document.getElementById("btnCheeky");
  const btnRead = document.getElementById("btnRead");
  const btnStop = document.getElementById("btnStop");
  const btnClear = document.getElementById("btnClear");
  const btnNext = document.getElementById("btnNext");
  const btnAll = document.getElementById("btnAll");

  const searchEl = document.getElementById("search");
  const lensEl = document.getElementById("lens");
  const paceEl = document.getElementById("pace");

  const apiBaseEl = document.getElementById("apiBase");
  const voiceEl = document.getElementById("voice");
  const autoVoicesEl = document.getElementById("autoVoices");
  const showEmojisEl = document.getElementById("showEmojis");
  const speakEmojisEl = document.getElementById("speakEmojis");
  const offlineHint = document.getElementById("offlineHint");

  // State
  let variant = DEFAULT_VARIANT || "standard";
  let lens = DEFAULT_LENS || "builder";
  let pace = DEFAULT_PACE || "all";
  let q = "";
  let activeConceptId = null;
  let visibleCount = DEFAULT_VISIBLE;

  // Unpack state: mid -> {status, shown, data, error}
  const unpackState = Object.create(null);

  // Voices
  let voices = [];
  let selectedVoiceURI = "";
  let autoVoices = DEFAULT_AUTO_VOICES;
  let showEmojis = DEFAULT_SHOW_EMOJIS;
  let speakEmojis = DEFAULT_SPEAK_EMOJIS;

  // Utils
  function safeText(x){ return (x ?? "").toString(); }
  function escHtml(s){
    return safeText(s)
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function isHttpHosted(){
    return location && (location.protocol === "http:" || location.protocol === "https:");
  }

  function getApiBase(){
    const fromPack = (PACK && PACK.api && PACK.api.base) ? PACK.api.base : "";
    const fromInput = apiBaseEl ? (apiBaseEl.value || "") : "";
    return (fromInput || fromPack || "/api/social-thread").trim();
  }

  function highlight(text){
    const src = safeText(text);
    if(!q) return escHtml(src);
    const i = src.toLowerCase().indexOf(q.toLowerCase());
    if(i < 0) return escHtml(src);
    const a = src.slice(0,i);
    const b = src.slice(i,i+q.length);
    const c = src.slice(i+q.length);
    return escHtml(a) + "<mark>" + escHtml(b) + "</mark>" + escHtml(c);
  }

  // Emoji handling (visual vs TTS)
  function stripEmoji(s){
    const str = safeText(s);
    try {
      // Modern browsers
      return str.replace(/\\p{Extended_Pictographic}/gu, "").replace(/\\s{2,}/g," ").trim();
    } catch {
      // Fallback: crude but serviceable
      return str.replace(/[\\u{1F300}-\\u{1FAFF}]/gu, "").replace(/\\s{2,}/g," ").trim();
    }
  }
  function splitSpeakerEmoji(speaker){
    const raw = safeText(speaker).trim();
    let emoji = "";
    // Grab last pictographic char if present
    try{
      const m = raw.match(/(\\p{Extended_Pictographic})\\s*$/u);
      if(m){ emoji = m[1]; }
    }catch{
      const m = raw.match(/([\\u{1F300}-\\u{1FAFF}])\\s*$/u);
      if(m){ emoji = m[1]; }
    }
    const name = emoji ? stripEmoji(raw) : raw;
    return { name: name || raw, emoji };
  }
  function ttsClean(s){
    // strip emojis unless user wants them spoken
    return speakEmojis ? safeText(s) : stripEmoji(s);
  }

  function avatarLetter(name){
    const n = (name || "").trim();
    if(!n) return "â€¢";
    return n[0].toUpperCase();
  }

  // Data selection
  function hasCheeky(){
    return PACK.tongue_in_cheek && Array.isArray(PACK.tongue_in_cheek.messages) && PACK.tongue_in_cheek.messages.length > 0;
  }
  function getBlock(){
    if(variant === "tongue_in_cheek" && hasCheeky()) return PACK.tongue_in_cheek;
    return PACK.standard;
  }

  // Concepts panel
  function renderConceptPanel(){
    const concepts = Array.isArray(PACK.concepts) ? PACK.concepts : [];
    if(!concepts.length){
      termsEl.innerHTML = "";
      conceptBox.innerHTML = '<div style="color:rgba(255,255,255,0.55);font-size:13px">No concepts provided.</div>';
      return;
    }

    termsEl.innerHTML = concepts.map(c => (
      '<button class="pill" data-id="'+escHtml(c.id)+'">'+escHtml(c.term)+'</button>'
    )).join("");

    const active = concepts.find(c => c.id === activeConceptId) || null;
    if(!active){
      conceptBox.innerHTML = '<div style="color:rgba(255,255,255,0.55);font-size:13px">Tap a term pill to view its definition here.</div>';
      return;
    }

    conceptBox.innerHTML =
      '<div class="conceptTerm">'+escHtml(active.term)+'</div>' +
      '<div class="conceptDef">'+escHtml(active.definition)+'</div>' +
      (active.example ? '<div class="conceptEx"><b>Example:</b> '+escHtml(active.example)+'</div>' : '');

    termsEl.querySelectorAll("button[data-id]").forEach(btn => {
      btn.addEventListener("click", () => {
        activeConceptId = btn.getAttribute("data-id");
        renderConceptPanel();
      });
    });
  }

  // Voices
  function loadVoices(){
    try{ voices = window.speechSynthesis.getVoices() || []; } catch(e){ voices = []; }
  }
  function voiceLabel(v){ return v.lang ? (v.name + " (" + v.lang + ")") : v.name; }

  function hashStr(s){
    const str = safeText(s);
    let h = 0;
    for(let i=0;i<str.length;i++){ h = ((h<<5)-h) + str.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  function pickVoiceForSpeaker(speaker){
    if(!voices.length) return null;
    if(!autoVoices){
      if(selectedVoiceURI){
        const v = voices.find(x => x.voiceURI === selectedVoiceURI);
        return v || voices[0];
      }
      return voices[0];
    }
    // auto voices: stable mapping by speaker key
    const idx = hashStr(speaker) % voices.length;
    return voices[idx] || voices[0];
  }

  function populateVoiceDropdown(){
    if(!voiceEl) return;
    const opts = ['<option value="">System default</option>']
      .concat(voices.map(v => '<option value="'+escHtml(v.voiceURI)+'">'+escHtml(voiceLabel(v))+'</option>'));
    voiceEl.innerHTML = opts.join("");
    voiceEl.value = selectedVoiceURI || "";
  }

  function stopSpeak(){ try{ window.speechSynthesis.cancel(); }catch(e){} }

  function speakLine(speaker, text){
    stopSpeak();
    const sp = ttsClean(speaker);
    const tx = ttsClean(text);
    const full = (sp ? (sp + ". ") : "") + tx;
    if(!full.trim()) return;

    const u = new SpeechSynthesisUtterance(full);
    const v = pickVoiceForSpeaker(sp || speaker);
    if(v) u.voice = v;
    u.rate = 1;
    u.pitch = 1;
    try{ window.speechSynthesis.speak(u); }catch(e){}
  }

  function readAll(){
    stopSpeak();
    const block = getBlock();
    const msgs = Array.isArray(block.messages) ? block.messages : [];
    let i = 0;

    const run = () => {
      if(i >= msgs.length) return;
      const m = msgs[i++];

      const sp = ttsClean(m.speaker);
      const tx = ttsClean(m.text);
      const full = (sp ? (sp + ". ") : "") + tx;
      if(!full.trim()) return run();

      const u = new SpeechSynthesisUtterance(full);
      const v = pickVoiceForSpeaker(sp || m.speaker);
      if(v) u.voice = v;
      u.rate = 1;
      u.pitch = 1;
      u.onend = run;
      try{ window.speechSynthesis.speak(u); }catch(e){}
    };

    run();
  }

  // Unpack
  function unpackKey(mid){ return variant + "|" + lens + "|" + mid; }

  async function fetchUnpack(mid){
    // Offline guard: file:// can't fetch, so we do not try
    if(!isHttpHosted()){
      return { error: "Offline mode: Unpack needs hosted mode (http/https) OR embedded unpacks at export time." };
    }

    const base = getApiBase();
    if(!base) return { error: "No API base set." };

    const block = getBlock();
    const msgs = Array.isArray(block.messages) ? block.messages : [];
    const idx = msgs.findIndex(m => m.id === mid);
    const before = idx > 0 ? msgs.slice(Math.max(0, idx-2), idx).map(m => ({speaker:m.speaker, text:m.text})) : [];
    const target = idx >= 0 ? {speaker: msgs[idx].speaker, text: msgs[idx].text} : null;
    const after  = idx >= 0 ? msgs.slice(idx+1, Math.min(msgs.length, idx+3)).map(m => ({speaker:m.speaker, text:m.text})) : [];

    const payload = {
      title: PACK.title,
      subtitle: PACK.subtitle || "",
      variant,
      lens,
      messageId: mid,
      context: { before, target, after },
      concepts: (Array.isArray(PACK.concepts) ? PACK.concepts : []).map(c => ({ id:c.id, term:c.term, definition:c.definition })),
    };

    const url = base.replace(/\\/$/,"") + "/unpack";
    const res = await fetch(url, {
      method:"POST",
      headers:{ "content-type":"application/json" },
      body: JSON.stringify(payload)
    });

    if(!res.ok){
      return { error: "Unpack error: " + res.status };
    }
    const data = await res.json();
    return { data };
  }

  function renderUnpack(mid){
    const st = unpackState[mid];
    if(!st) return "";

    if(st.status === "loading"){
      return (
        '<div class="unpack">' +
          '<div class="unpackHead">' +
            '<div><div class="unpackTitle">Hidden conversation ðŸ§©</div>' +
            '<div class="unpackSub">Generatingâ€¦</div></div>' +
            '<button class="miniBtn" data-action="close_unpack" data-mid="'+escHtml(mid)+'">Close</button>' +
          '</div>' +
          '<div class="unpackBody"><div class="loader"><span class="dot"></span><span class="dot"></span><span class="dot"></span> thinking</div></div>' +
        '</div>'
      );
    }

    if(st.status === "error"){
      return (
        '<div class="unpack">' +
          '<div class="unpackHead">' +
            '<div><div class="unpackTitle">Unpack unavailable ðŸ˜µ</div>' +
            '<div class="unpackSub">'+escHtml(st.error || "Unknown error")+'</div></div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<button class="miniBtn warn" data-action="regen_unpack" data-mid="'+escHtml(mid)+'">Try again ðŸ”</button>' +
              '<button class="miniBtn" data-action="close_unpack" data-mid="'+escHtml(mid)+'">Close</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }

    const data = st.data || {};
    const core = data.core || {};
    const steps = Array.isArray(data.steps) ? data.steps : [];
    const shown = Math.max(0, Math.min(st.shown || 0, steps.length));
    const visible = steps.slice(0, shown);

    const coreHtml =
      '<div class="coreBox">' +
        '<div style="font-weight:1000">Core ðŸ§ </div>' +
        (core.claim ? '<div class="coreRow"><b>Claim:</b> '+highlight(core.claim)+'</div>' : '') +
        (core.evidence ? '<div class="coreRow"><b>Evidence:</b> '+highlight(core.evidence)+'</div>' : '') +
        (core.assumptions ? '<div class="coreRow"><b>Assumption:</b> '+highlight(core.assumptions)+'</div>' : '') +
        (core.implications ? '<div class="coreRow"><b>Implication:</b> '+highlight(core.implications)+'</div>' : '') +
      '</div>';

    const miniThreadHtml =
      '<div class="miniThread" data-action="tap_reveal" data-mid="'+escHtml(mid)+'">' +
        visible.map(x => (
          '<div class="miniMsg">' +
            '<div class="miniTop">' +
              '<div class="miniSpeaker">'+escHtml(stripEmoji(x.speaker || "Voice"))+'</div>' +
              '<button class="miniBtn" data-action="read_unpack_line" data-speaker="'+escHtml(x.speaker||"")+'">ðŸ”Š</button>' +
            '</div>' +
            '<div class="miniText">'+highlight(x.text || "")+'</div>' +
          '</div>'
        )).join("") +
      '</div>';

    const controlsHtml =
      '<div class="actions">' +
        '<button class="miniBtn good" data-action="reveal_next" data-mid="'+escHtml(mid)+'">Reveal next ðŸ‘‰</button>' +
        '<button class="miniBtn" data-action="reveal_all" data-mid="'+escHtml(mid)+'">Reveal all ðŸ“œ</button>' +
        '<button class="miniBtn warn" data-action="regen_unpack" data-mid="'+escHtml(mid)+'">Regenerate ðŸ”</button>' +
        '<button class="miniBtn" data-action="close_unpack" data-mid="'+escHtml(mid)+'">Close</button>' +
      '</div>';

    return (
      '<div class="unpack">' +
        '<div class="unpackHead">' +
          '<div><div class="unpackTitle">Hidden conversation ðŸŽ­</div>' +
          '<div class="unpackSub">'+escHtml(shown)+'/'+escHtml(steps.length)+' revealed</div></div>' +
          '<button class="miniBtn" data-action="close_unpack" data-mid="'+escHtml(mid)+'">Close</button>' +
        '</div>' +
        '<div class="unpackBody">' + coreHtml + miniThreadHtml + controlsHtml + '</div>' +
      '</div>'
    );
  }

  async function ensureUnpack(mid, force){
    const st = unpackState[mid];
    if(st && st.status === "ready" && !force) return;

    unpackState[mid] = { status:"loading", shown:0, data:null, error:null };
    renderThread();

    // 1) embedded unpacks first
    const key = unpackKey(mid);
    const embedded = PACK.unpacks && PACK.unpacks[key] ? PACK.unpacks[key] : null;
    if(embedded && !force){
      unpackState[mid] = { status:"ready", shown:0, data:embedded, error:null };
      renderThread();
      return;
    }

    // 2) fetch if hosted
    const out = await fetchUnpack(mid);
    if(out.error){
      unpackState[mid] = { status:"error", shown:0, data:null, error: out.error };
      renderThread();
      return;
    }

    const data = out.data;
    // store embedded-like (in-memory only)
    PACK.unpacks = PACK.unpacks || {};
    PACK.unpacks[key] = data;

    unpackState[mid] = { status:"ready", shown:0, data, error:null };
    renderThread();
  }

  function revealNext(mid){
    const st = unpackState[mid];
    if(!st || st.status !== "ready") return;
    const steps = Array.isArray(st.data?.steps) ? st.data.steps : [];
    st.shown = Math.min(steps.length, (st.shown || 0) + 1);
    renderThread();
  }
  function revealAll(mid){
    const st = unpackState[mid];
    if(!st || st.status !== "ready") return;
    const steps = Array.isArray(st.data?.steps) ? st.data.steps : [];
    st.shown = steps.length;
    renderThread();
  }

  // Thread rendering
  function renderThread(){
    const block = getBlock();
    const msgs = Array.isArray(block.messages) ? block.messages : [];

    const filtered = !q ? msgs : msgs.filter(m => {
      const t = safeText(m.text).toLowerCase();
      const s = stripEmoji(safeText(m.speaker)).toLowerCase();
      const qq = q.toLowerCase();
      return t.includes(qq) || s.includes(qq);
    });

    let shownMsgs = filtered;
    if(pace === "step"){
      shownMsgs = filtered.slice(0, Math.max(0, visibleCount));
    }

    threadEl.innerHTML = shownMsgs.map(m => {
      const { name, emoji } = splitSpeakerEmoji(m.speaker);
      const displaySpeaker = stripEmoji(name);
      const mid = m.id;

      const hasUnpack = !!unpackState[mid];

      return (
        '<div class="msg">' +
          '<div class="avatar">'+escHtml(avatarLetter(displaySpeaker))+'</div>' +
          '<div class="bubble">' +
            '<div class="topline">' +
              '<div class="speaker">'+escHtml(displaySpeaker) +
                (emoji ? '<span class="badgeEmoji" title="speaker emoji">'+escHtml(emoji)+'</span>' : '') +
              '</div>' +
              (m.time ? '<div class="time">'+escHtml(m.time)+'</div>' : '<div class="time"></div>') +
            '</div>' +
            '<div class="text">'+ highlight(m.text) +'</div>' +

            '<div class="actions">' +
              '<button class="miniBtn good" data-action="unpack" data-mid="'+escHtml(mid)+'">Unpack ðŸ§©</button>' +
              '<button class="miniBtn" data-action="read_one" data-mid="'+escHtml(mid)+'">Read ðŸ”Š</button>' +
              (hasUnpack ? '<button class="miniBtn" data-action="close_unpack" data-mid="'+escHtml(mid)+'">Hide ðŸ™ˆ</button>' : '') +
            '</div>' +

            (hasUnpack ? renderUnpack(mid) : '') +
          '</div>' +
        '</div>'
      );
    }).join("");

    if(!shownMsgs.length){
      threadEl.innerHTML = '<div style="color:rgba(255,255,255,0.60)">No matches.</div>';
    }
  }

  function renderHeader(){
    titleEl.textContent = safeText(PACK.title || "Social thread");
    subEl.textContent = safeText(PACK.subtitle || "");
    const meta = PACK.meta || {};
    const metaBits = [];
    if(meta.model) metaBits.push("meta: " + meta.model);
    if(meta.source) metaBits.push(meta.source);
    metaEl.textContent = metaBits.filter(Boolean).join(" / ");

    // hide cheeky button if none
    btnCheeky.style.display = hasCheeky() ? "inline-block" : "none";
  }

  function setVariant(v){
    variant = v;
    btnStd.classList.toggle("on", variant==="standard");
    btnCheeky.classList.toggle("on", variant==="tongue_in_cheek");
    visibleCount = DEFAULT_VISIBLE;
    renderThread();
  }

  function applyEmojiMode(){
    document.body.classList.toggle("noEmoji", !showEmojis);
  }

  function updateOfflineHint(){
    const offline = !isHttpHosted();
    if(!offlineHint) return;
    if(offline){
      offlineHint.style.display = "block";
      offlineHint.textContent =
        "Offline mode (file://): Unpack only works if unpacks were embedded during export. Otherwise, open this file via the app (http://localhost or deployed) to fetch unpacks.";
    }else{
      offlineHint.style.display = "none";
      offlineHint.textContent = "";
    }
  }

  // Wire UI
  btnStd.addEventListener("click", ()=> setVariant("standard"));
  btnCheeky.addEventListener("click", ()=> setVariant("tongue_in_cheek"));

  btnRead.addEventListener("click", readAll);
  btnStop.addEventListener("click", stopSpeak);

  btnClear.addEventListener("click", ()=>{
    q = "";
    searchEl.value = "";
    visibleCount = DEFAULT_VISIBLE;
    renderThread();
  });

  searchEl.addEventListener("input", (e)=>{
    q = e.target.value || "";
    visibleCount = DEFAULT_VISIBLE;
    renderThread();
  });

  lensEl.value = lens;
  lensEl.addEventListener("change", ()=>{
    lens = lensEl.value || "debate";
    // lens changes only affect unpack; keep thread stable
    renderThread();
  });

  paceEl.value = pace;
  paceEl.addEventListener("change", ()=>{
    pace = paceEl.value || "all";
    visibleCount = DEFAULT_VISIBLE;
    renderThread();
  });

  btnNext.addEventListener("click", ()=>{
    if(pace !== "step") pace = "step";
    paceEl.value = "step";
    visibleCount = visibleCount + 1;
    renderThread();
  });

  btnAll.addEventListener("click", ()=>{
    pace = "all";
    paceEl.value = "all";
    renderThread();
  });

  // Tools controls
  autoVoicesEl.checked = autoVoices;
  autoVoicesEl.addEventListener("change", ()=>{
    autoVoices = !!autoVoicesEl.checked;
    try{ localStorage.setItem("tts:autoVoices", autoVoices ? "1" : "0"); }catch(e){}
  });

  showEmojisEl.checked = showEmojis;
  showEmojisEl.addEventListener("change", ()=>{
    showEmojis = !!showEmojisEl.checked;
    applyEmojiMode();
    try{ localStorage.setItem("ui:showEmojis", showEmojis ? "1" : "0"); }catch(e){}
  });

  speakEmojisEl.checked = speakEmojis;
  speakEmojisEl.addEventListener("change", ()=>{
    speakEmojis = !!speakEmojisEl.checked;
    try{ localStorage.setItem("tts:speakEmojis", speakEmojis ? "1" : "0"); }catch(e){}
  });

  if(voiceEl){
    voiceEl.addEventListener("change", ()=>{
      selectedVoiceURI = voiceEl.value || "";
      try{ localStorage.setItem("tts:voiceURI", selectedVoiceURI); }catch(e){}
    });
  }

  if(apiBaseEl){
    apiBaseEl.addEventListener("change", ()=>{
      try{ localStorage.setItem("api:base", apiBaseEl.value || ""); }catch(e){}
    });
  }

  // Thread click delegation
  threadEl.addEventListener("click", async (e) => {
    const t = e.target && e.target.closest ? e.target.closest("[data-action]") : null;
    if(!t) return;

    const action = t.getAttribute("data-action");
    const mid = t.getAttribute("data-mid");

    if(action === "read_unpack_line"){
      const sp = t.getAttribute("data-speaker") || "Voice";
      const box = t.closest(".miniMsg");
      const txtEl = box ? box.querySelector(".miniText") : null;
      const tx = txtEl ? txtEl.textContent : "";
      speakLine(sp, tx);
      return;
    }

    if(action === "tap_reveal"){
      if(mid) revealNext(mid);
      return;
    }

    if(!mid) return;

    if(action === "unpack"){ await ensureUnpack(mid, false); return; }
    if(action === "regen_unpack"){ await ensureUnpack(mid, true); return; }
    if(action === "close_unpack"){ delete unpackState[mid]; renderThread(); return; }
    if(action === "reveal_next"){ revealNext(mid); return; }
    if(action === "reveal_all"){ revealAll(mid); return; }
    if(action === "read_one"){
      const block = getBlock();
      const msgs = Array.isArray(block.messages) ? block.messages : [];
      const m = msgs.find(x => x.id === mid);
      if(m) speakLine(stripEmoji(m.speaker), m.text);
      return;
    }
  });

  // Init
  function loadPrefs(){
    try{
      const av = localStorage.getItem("tts:autoVoices");
      if(av != null) autoVoices = (av === "1");

      const se = localStorage.getItem("tts:speakEmojis");
      if(se != null) speakEmojis = (se === "1");

      const sh = localStorage.getItem("ui:showEmojis");
      if(sh != null) showEmojis = (sh === "1");

      const v = localStorage.getItem("tts:voiceURI");
      if(v != null) selectedVoiceURI = v || "";

      const ab = localStorage.getItem("api:base");
      if(ab != null && apiBaseEl) apiBaseEl.value = ab || apiBaseEl.value;
    }catch(e){}
  }

  loadPrefs();
  applyEmojiMode();

  // set defaults
  setVariant(variant);

  lensEl.value = lens;
  paceEl.value = pace;
  autoVoicesEl.checked = autoVoices;
  showEmojisEl.checked = showEmojis;
  speakEmojisEl.checked = speakEmojis;

  renderHeader();
  renderConceptPanel();
  updateOfflineHint();

  // voices init
  function initVoices(){
    loadVoices();
    populateVoiceDropdown();
  }
  initVoices();
  try{
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      initVoices();
    });
  }catch(e){}
</script>
</body>
</html>`;
}

export async function precomputeUnpacks(
  pack: SocialThreadPack,
  opts?: { lens?: Lens; limitPerVariant?: number }
): Promise<Record<string, UnpackResult>> {
  const lens: Lens = opts?.lens || "debate";
  const limit = Number.isFinite(opts?.limitPerVariant as any) ? Number(opts?.limitPerVariant) : Infinity;

  const out: Record<string, UnpackResult> = {};
  const base = (pack.api?.base || "/api/social-thread").replace(/\/$/, "");

  async function oneVariant(variant: "standard" | "tongue_in_cheek", block?: SocialVariantBlock) {
    const msgs = Array.isArray(block?.messages) ? block!.messages : [];
    const capped = msgs.slice(0, limit);

    for (let i = 0; i < capped.length; i++) {
      const m = capped[i];
      const before = capped.slice(Math.max(0, i - 2), i).map((x) => ({ speaker: x.speaker, text: x.text }));
      const target = { speaker: m.speaker, text: m.text };
      const after = capped.slice(i + 1, Math.min(capped.length, i + 3)).map((x) => ({ speaker: x.speaker, text: x.text }));

      const payload = {
        title: pack.title,
        subtitle: pack.subtitle || "",
        variant,
        lens,
        messageId: m.id,
        context: { before, target, after },
        concepts: (Array.isArray(pack.concepts) ? pack.concepts : []).map((c) => ({
          id: c.id,
          term: c.term,
          definition: c.definition,
        })),
      };

      const res = await fetch(base + "/unpack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) continue;
      const data = (await res.json()) as UnpackResult;
      out[`${variant}|${lens}|${m.id}`] = data;
    }
  }

  await oneVariant("standard", pack.standard);
  if (pack.tongue_in_cheek?.messages?.length) {
    await oneVariant("tongue_in_cheek", pack.tongue_in_cheek);
  }

  return out;
}

// -------------------- internal helpers --------------------

function structuredCloneOrFallback<T>(x: T): T {
  try {
    // @ts-ignore
    if (typeof structuredClone === "function") return structuredClone(x);
  } catch {}
  return JSON.parse(JSON.stringify(x));
}

function safeFilename(name: string) {
  const base = String(name || "export")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
  return base || "export";
}

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

function jsonForScriptTag(obj: any) {
  // Prevent accidental </script> injection by escaping "<"
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function escapeHtml(s: string) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(s: string) {
  return escapeHtml(s).replaceAll("\n", " ").replaceAll("\r", " ");
}


