"use client";

/**
 * Standalone interactive HTML export for the BComm Y3 prototype.
 * Features:
 * - Standard / Adapted tabs
 * - Optional "one paragraph at a time" mode
 * - Read-aloud (paragraph or all), karaoke highlighting via speechSynthesis boundary events (when supported)
 * - Term highlighting + click-to-pin definitions
 * - A11y sliders (font size, spacing, line height, max width)
 * - Cheat sheet (from API if provided; otherwise a fallback)
 * - Self-test (Q/A)
 */

export type GlossaryEntry = { term: string; definition: string; example?: string };
export type CheatSheet = { summary: string; key_points: string[]; exam_tips: string[] };
export type SelfTestQA = { question: string; answer: string; why_it_matters?: string };

export type InteractiveExportOptions = {
  title: string;
  subtitle?: string;
  moduleId?: string;
  standardText: string;
  adaptedText: string;
  glossary: GlossaryEntry[];
  cheatSheet?: CheatSheet | null;
  selfTest?: SelfTestQA[] | null;
  a11y?: {
    fontSize?: number; // px
    letterSpacing?: number; // em
    wordSpacing?: number; // em
    lineHeight?: number; // unitless
    maxWidth?: number; // px
  };
};

function safeFilename(name: string) {
  const base = String(name || "export")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
  return base || "export";
}

function downloadTextFile(filename: string, content: string, mime = "text/html;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function jsonForScriptTag(obj: any) {
  // Prevent accidental </script> injection by escaping "<"
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export function exportInteractiveHtmlFromState(opts: InteractiveExportOptions) {
  const title = String(opts.title || "BComm Study Pack");
  const filename = safeFilename(title) + "-" + new Date().toISOString().slice(0, 10) + ".html";

  const payload = {
    title,
    subtitle: String(opts.subtitle || ""),
    moduleId: String(opts.moduleId || "prototype"),
    standardText: String(opts.standardText || ""),
    adaptedText: String(opts.adaptedText || ""),
    glossary: Array.isArray(opts.glossary) ? opts.glossary : [],
    cheatSheet: opts.cheatSheet ?? null,
    selfTest: Array.isArray(opts.selfTest) ? opts.selfTest : [],
    a11y: {
      fontSize: Number(opts.a11y?.fontSize ?? 18),
      letterSpacing: Number(opts.a11y?.letterSpacing ?? 0.02),
      wordSpacing: Number(opts.a11y?.wordSpacing ?? 0.06),
      lineHeight: Number(opts.a11y?.lineHeight ?? 1.6),
      maxWidth: Number(opts.a11y?.maxWidth ?? 760),
    },
  };

  const html = buildInteractiveHtml(payload);
  downloadTextFile(filename, html);
}

/**
 * NOTE:
 * We intentionally build with string arrays (NOT a backtick template literal),
 * to avoid accidental `${ ... }` interpolation hazards inside embedded JS.
 */
function buildInteractiveHtml(DATA: any) {
  const parts: string[] = [];

  parts.push("<!doctype html>");
  parts.push('<html lang="en">');
  parts.push("<head>");
  parts.push('  <meta charset="utf-8" />');
  parts.push('  <meta name="viewport" content="width=device-width, initial-scale=1" />');
  parts.push("  <title>" + escapeHtml(String(DATA.title || "BComm Study Pack")) + "</title>");
  parts.push("  <style>");
  parts.push(cssText());
  parts.push("  </style>");
  parts.push("</head>");
  parts.push("<body>");
  parts.push('  <div class="wrap">');
  parts.push('    <div class="shell">');
  parts.push('      <div class="topbar">');
  parts.push('        <div class="brand">');
  parts.push('          <div class="h1" id="ttl"></div>');
  parts.push('          <div class="sub" id="sub"></div>');
  parts.push("        </div>");
  parts.push('        <div class="spacer"></div>');
  parts.push('        <button class="btn primary" id="tabStd" type="button">Standard</button>');
  parts.push('        <button class="btn" id="tabAdp" type="button">Adapted</button>');
  parts.push('        <button class="btn" id="btnOne" type="button" title="Toggle one paragraph at a time">One at a time</button>');
  parts.push('        <button class="btn" id="btnPrev" type="button" title="Previous paragraph">Prev</button>');
  parts.push('        <button class="btn" id="btnNext" type="button" title="Next paragraph">Next</button>');
  parts.push('        <button class="btn" id="btnKaraoke" type="button" title="Toggle karaoke highlighting">Karaoke</button>');
  parts.push('        <button class="btn primary" id="btnSpeakPara" type="button">Read paragraph</button>');
  parts.push('        <button class="btn" id="btnSpeakAll" type="button">Read all</button>');
  parts.push('        <button class="btn" id="btnStop" type="button">Stop</button>');
  parts.push("      </div>");

  parts.push('      <div class="grid">');

  // Reading panel
  parts.push('        <div class="panel">');
  parts.push('          <div class="badge" id="badge"></div>');
  parts.push('          <div class="reading" id="reading" aria-live="polite"></div>');
  parts.push("        </div>");

  // Sidebar panel
  parts.push('        <div class="panel">');

  parts.push('          <h3 style="margin-top:0">Pinned definition</h3>');
  parts.push('          <div class="small">Click a highlighted term (or a key-term pill) to pin it here. Press Esc to clear.</div>');
  parts.push('          <div class="defBox" id="defBox">');
  parts.push('            <div class="defTerm" id="defTerm"></div>');
  parts.push('            <div class="defText" id="defText"></div>');
  parts.push('            <div class="defExample" id="defExample"></div>');
  parts.push('            <div style="margin-top:10px"><button class="btn" id="btnClearPin" type="button">Clear</button></div>');
  parts.push("          </div>");

  parts.push('          <div class="controls">');
  parts.push('            <h3 style="margin-top:0">Controls</h3>');

  parts.push(sliderRow("Font size", "rngFont", 14, 28, 1));
  parts.push(sliderRow("Letter spacing", "rngLetter", 0, 0.14, 0.01));
  parts.push(sliderRow("Word spacing", "rngWord", 0, 0.25, 0.01));
  parts.push(sliderRow("Line height", "rngLine", 1.2, 2.2, 0.05));
  parts.push(sliderRow("Max width", "rngWidth", 520, 920, 10));

  parts.push('            <h3 style="margin-bottom:6px">Key terms</h3>');
  parts.push('            <div class="pills" id="pills"></div>');

  parts.push('            <div class="cheat">');
  parts.push('              <h3 style="margin-bottom:6px">Cheat sheet</h3>');
  parts.push('              <div class="small">If the generator supplies a cheat sheet, it appears here. Otherwise you get a decent fallback.</div>');
  parts.push('              <div class="cheatBox">');
  parts.push('                <div class="cheatRow"><span class="pill">TL;DR</span><span id="cs_tldr" class="cheatTxt"></span></div>');
  parts.push('                <div class="cheatRow"><span class="pill">Key points</span></div>');
  parts.push('                <ul id="cs_points" class="list small"></ul>');
  parts.push('                <div class="cheatRow"><span class="pill">Exam tips</span></div>');
  parts.push('                <ul id="cs_tips" class="list small"></ul>');
  parts.push("              </div>");
  parts.push("            </div>");

  parts.push('            <div class="selftest" id="selfWrap">');
  parts.push('              <h3 style="margin-bottom:6px">Quick self-test</h3>');
  parts.push('              <div class="small">Click a question to reveal/hide the answer. Keep it fast and slightly ruthless.</div>');
  parts.push('              <div id="selfList"></div>');
  parts.push("            </div>");

  parts.push("          </div>"); // controls
  parts.push("        </div>"); // panel sidebar

  parts.push("      </div>"); // grid
  parts.push("    </div>"); // shell
  parts.push("  </div>"); // wrap

  // Payload
  parts.push('  <script id="bcommy3_payload" type="application/json">' + jsonForScriptTag(DATA) + "</script>");

  // Script
  parts.push("  <script>");
  parts.push(jsText());
  parts.push("  </script>");

  parts.push("</body>");
  parts.push("</html>");

  return parts.join("\n");
}

function sliderRow(label: string, id: string, min: number, max: number, step: number) {
  return (
    '            <div class="row">' +
    '              <div class="lab">' +
    escapeHtml(label) +
    "</div>" +
    '              <input id="' +
    escapeHtml(id) +
    '" type="range" min="' +
    String(min) +
    '" max="' +
    String(max) +
    '" step="' +
    String(step) +
    '" />' +
    '              <div class="val" id="v_' +
    escapeHtml(id) +
    '"></div>' +
    "            </div>"
  );
}

// --- Safe HTML helpers for title/sub only (payload content is rendered in JS with its own escaping) ---
function escapeHtml(s: string) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cssText() {
  return `
    :root{
      --bg0:#070a12;
      --card:#0b1222cc;
      --ink:#eaf0ff;
      --muted:#a7b0c9;
      --line:rgba(255,255,255,.10);
      --accent:#2aa6ff;
      --mark:rgba(42,166,255,.25);
      --shadow: 0 18px 60px rgba(0,0,0,.40);

      --fontSize: 18px;
      --letterSpacing: 0.02em;
      --wordSpacing: 0.06em;
      --lineHeight: 1.6;
      --maxWidth: 760px;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      background: radial-gradient(1400px 900px at 60% 10%, #15214b 0%, var(--bg0) 60%);
      color: var(--ink);
    }
    .wrap{max-width:1200px;margin:40px auto;padding:0 16px}
    .shell{
      border: 1px solid var(--line);
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(8,12,24,.75), rgba(6,10,20,.55));
      box-shadow: var(--shadow);
      overflow:hidden;
    }
    .topbar{
      display:flex; gap:10px; align-items:center;
      padding: 14px;
      border-bottom: 1px solid var(--line);
      flex-wrap:wrap;
    }
    .brand{min-width: 260px}
    .h1{font-size:18px;font-weight:900;line-height:1.1}
    .sub{font-size:13px;color:var(--muted);margin-top:4px}
    .spacer{flex:1}
    .btn{
      appearance:none; cursor:pointer; user-select:none;
      border:1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.04);
      color: var(--ink);
      padding: 8px 12px;
      border-radius: 14px;
      font-size: 14px;
    }
    .btn:hover{background: rgba(255,255,255,.07)}
    .btn.primary{ border-color: rgba(42,166,255,.45); box-shadow: 0 0 0 1px rgba(42,166,255,.18) inset; }
    .btn.toggled{ background: rgba(42,166,255,.16); border-color: rgba(42,166,255,.65); }

    .grid{display:grid;grid-template-columns:1.35fr .95fr;gap:14px;padding:14px}
    @media (max-width: 960px){ .grid{grid-template-columns:1fr} }

    .panel{
      border:1px solid var(--line);
      background: rgba(10,16,32,.55);
      border-radius: 18px;
      padding: 14px;
      overflow:hidden;
    }

    .badge{
      display:inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      border:1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.04);
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 10px;
      user-select:none;
    }

    .reading{
      font-size: var(--fontSize);
      letter-spacing: var(--letterSpacing);
      word-spacing: var(--wordSpacing);
      line-height: var(--lineHeight);
      max-width: var(--maxWidth);
    }
    .para{
      margin: 0 0 14px 0;
      padding: 10px 12px;
      border-radius: 14px;
      border:1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.03);
    }
    .para.focus{
      border-color: rgba(42,166,255,.35);
      box-shadow: 0 0 0 1px rgba(42,166,255,.14) inset;
    }
    mark{
      background: var(--mark);
      color: var(--ink);
      padding: 0 3px;
      border-radius: 6px;
      cursor:pointer;
    }
    .karaokeDone{ background: rgba(42,166,255,.18); }
    .karaokeTodo{ opacity: .92; }

    h3{margin: 14px 0 8px 0}
    .small{font-size: 13px; color: var(--muted)}
    .defBox{
      border:1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.03);
      border-radius: 16px;
      padding: 12px;
      margin: 10px 0 14px 0;
    }
    .defTerm{font-weight: 900; font-size: 15px; margin-bottom: 6px}
    .defText{font-size: 14px; color: var(--ink); white-space: pre-wrap}
    .defExample{font-size: 13px; color: var(--muted); margin-top: 8px; white-space: pre-wrap}

    .controls{margin-top: 6px}
    .row{display:flex;align-items:center;gap:10px;margin:10px 0}
    .lab{width:120px;color:var(--muted);font-size:13px}
    input[type="range"]{flex:1}
    .val{width:76px;text-align:right;color:var(--muted);font-size:13px}

    .pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
    .pill{
      display:inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      border:1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.04);
      font-size: 13px;
      cursor:pointer;
      user-select:none;
    }
    .pill:hover{background: rgba(255,255,255,.07)}

    .cheat{margin-top: 14px}
    .cheatBox{
      border:1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.03);
      border-radius: 16px;
      padding: 12px;
      margin-top: 8px;
    }
    .cheatRow{display:flex;gap:10px;align-items:flex-start;margin:8px 0}
    .cheatTxt{color: var(--ink); font-size: 13px; line-height: 1.4}
    .list{margin:6px 0 0 0; padding-left: 18px}
    .list li{margin:6px 0}
    .selftest{margin-top: 14px}
    .q{
      border:1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.03);
      border-radius: 14px;
      padding: 10px 12px;
      margin: 8px 0;
      cursor:pointer;
    }
    .q .qq{font-weight:900; font-size: 13px}
    .q .aa{margin-top:8px; font-size: 13px; color: var(--ink); white-space: pre-wrap; display:none}
    .q.open .aa{display:block}
    .q .why{margin-top:8px; font-size: 12px; color: var(--muted); display:none}
    .q.open .why{display:block}
  `.trim();
}

function jsText() {
  // No template literals. No backticks. No "${" sequences.
  return `
(function(){
  var LS = "bcommy3_export_v2";

  function $(id){ return document.getElementById(id); }
  function setVar(k, v){ document.documentElement.style.setProperty(k, v); }
  function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }

  function escapeHtml(s){
    return String(s||"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }
  function escapeAttr(s){
    // Avoid literal backticks + avoid '&#096;' (leading zeros) weirdness in some parsers
    return escapeHtml(s||"").replaceAll("\\u0060","&#96;");
  }
  function escapeRegExp(s){
    // Use \\x24 to avoid $-brace patterns causing grief in some build steps
    return String(s||"").replace(/[.*+?^\\x24{}()|[\\]\\\\]/g, "\\\\$&");
  }
  function uniqTerms(arr){
    var out=[], seen={};
    for(var i=0;i<(arr||[]).length;i++){
      var t = String(arr[i]||"").trim();
      if(!t) continue;
      var k = t.toLowerCase();
      if(seen[k]) continue;
      seen[k]=1; out.push(t);
    }
    return out;
  }

  function splitParas(text){
    var t = String(text||"").replace(/\\r\\n/g,"\\n").trim();
    if(!t) return [""];
    var parts = t.split(/\\n\\s*\\n+/).map(function(s){return s.trim();}).filter(Boolean);
    if(parts.length<=1) parts = t.split(/\\n+/).map(function(s){return s.trim();}).filter(Boolean);
    if(parts.length<=1 && t.length>900){
      var sents = t.split(/(?<=[.!?])\\s+/);
      parts = [];
      var buf = "";
      for(var i=0;i<sents.length;i++){
        var s = sents[i];
        var next = (buf ? (buf + " " + s) : s).trim();
        if(next.length > 520 && buf.trim()){
          parts.push(buf.trim());
          buf = s;
        } else {
          buf = next;
        }
      }
      if(buf.trim()) parts.push(buf.trim());
    }
    return parts.length ? parts : [t];
  }

  function highlight(text, terms){
    var html = escapeHtml(text||"");
    var list = (terms||[]).slice().filter(Boolean);
    list.sort(function(a,b){ return b.length - a.length; });
    for(var i=0;i<list.length;i++){
      var term = String(list[i]||"").trim();
      if(!term) continue;
      var re = new RegExp("(\\\\b" + escapeRegExp(term) + "\\\\b)", "gi");
      html = html.replace(re, function(m){
        return '<mark data-term="' + escapeHtml(term) + '">' + m + '</mark>';
      });
    }
    return html;
  }

  function renderKaraoke(text, charIdx){
    charIdx = clamp(Number(charIdx||0), 0, String(text||"").length);
    var a = escapeHtml(String(text||"").slice(0, charIdx));
    var b = escapeHtml(String(text||"").slice(charIdx));
    return '<p class="para focus"><span class="karaokeDone">' + a + '</span><span class="karaokeTodo">' + b + '</span></p>';
  }

  function takeSentences(s, n){
    var t = String(s||"").trim();
    if(!t) return [];
    return t.split(/(?<=[.!?])\\s+/).filter(Boolean).slice(0, n);
  }

  function buildFallbackCheatSheet(data){
    var std = String((data && data.standardText) || "");
    var paras = splitParas(std);
    var tldr = takeSentences((paras[0]||"") + " " + (paras[1]||""), 2).join(" ");
    var bulletLines = std.split(/\\r?\\n/).filter(function(l){ return /^\\s*[-*]\\s+/.test(l); })
      .map(function(l){ return l.replace(/^\\s*[-*]\\s+/, "").trim(); })
      .filter(Boolean);

    var keyPoints = bulletLines.slice(0, 6);
    if(!keyPoints.length){
      var pool = paras.slice(0,3).join(" ");
      keyPoints = takeSentences(pool, 6).slice(0, 5);
    }

    var tips = [
      "Define the key distinction (risk vs uncertainty) and give a concrete example.",
      "Name ONE tool (scenarios or decision tree) and explain what it reveals.",
      "Name ONE bias (anchoring or availability) and how you would reduce it.",
      "State one assumption you would write down and how you would test it."
    ];

    return { tldr: tldr, points: keyPoints, tips: tips };
  }

  // Load payload
  var raw = $("bcommy3_payload").textContent || "{}";
  var DATA = {};
  try { DATA = JSON.parse(raw); } catch(e){ DATA = {}; }

  $("ttl").textContent = DATA.title || "BComm Study Pack";
  $("sub").textContent = DATA.subtitle || "";

  // State
  var tab = "standard";
  var oneAtATime = false;
  var karaokeOn = true;
  var idx = 0;
  var speaking = false;
  var speakMode = "para"; // "para" | "all"
  var speakChar = 0;

  // Glossary maps
  var defs = {};
  var examples = {};
  (DATA.glossary || []).forEach(function(g){
    if(!g || !g.term) return;
    defs[String(g.term).toLowerCase()] = String(g.definition||"");
    if(g.example) examples[String(g.term).toLowerCase()] = String(g.example||"");
  });

  function clearPin(){
    $("defTerm").textContent = "";
    $("defText").textContent = "";
    $("defExample").textContent = "";
  }
  function pin(term){
    var t = String(term||"").trim();
    if(!t) return;
    var k = t.toLowerCase();
    $("defTerm").textContent = t;
    $("defText").textContent = defs[k] || "";
    $("defExample").textContent = examples[k] ? ("Example: " + examples[k]) : "";
  }

  function currentText(){
    return (tab === "standard") ? String(DATA.standardText||"") : String(DATA.adaptedText||"");
  }

  function currentParas(){
    return splitParas(currentText());
  }

  function setBadge(){
    var ps = currentParas();
    if(oneAtATime){
      $("badge").textContent = "Paragraph " + (idx+1) + " / " + ps.length;
    } else {
      $("badge").textContent = "All paragraphs (" + ps.length + ")";
    }
  }

  function renderTerms(){
    var terms = uniqTerms((DATA.glossary||[]).map(function(g){ return g.term; }));
    $("pills").innerHTML = terms.map(function(t){
      var k = String(t||"");
      return '<span class="pill" tabindex="0" role="button" data-term="' + escapeAttr(k) + '">' + escapeHtml(k) + '</span>';
    }).join(" ");
  }

  function renderCheat(){
    var cs = DATA.cheatSheet;
    var fallback = buildFallbackCheatSheet(DATA);

    var tldr = "";
    var points = [];
    var tips = [];

    if(cs && (cs.summary || cs.key_points || cs.exam_tips)){
      tldr = String(cs.summary || "").trim();
      points = Array.isArray(cs.key_points) ? cs.key_points.slice(0, 7) : [];
      tips = Array.isArray(cs.exam_tips) ? cs.exam_tips.slice(0, 7) : [];
    } else {
      tldr = fallback.tldr || "";
      points = fallback.points || [];
      tips = fallback.tips || [];
    }

    $("cs_tldr").textContent = tldr || "(none)";
    $("cs_points").innerHTML = (points||[]).map(function(x){ return "<li>" + escapeHtml(String(x||"")) + "</li>"; }).join("");
    $("cs_tips").innerHTML = (tips||[]).map(function(x){ return "<li>" + escapeHtml(String(x||"")) + "</li>"; }).join("");
  }

  function renderSelfTest(){
    var list = Array.isArray(DATA.selfTest) ? DATA.selfTest : [];
    var wrap = $("selfWrap");
    var host = $("selfList");
    if(!wrap || !host) return;

    if(!list.length){
      wrap.style.display = "none";
      return;
    }
    wrap.style.display = "block";

    host.innerHTML = list.slice(0, 10).map(function(q, i){
      var qq = escapeHtml(String(q.question||""));
      var aa = escapeHtml(String(q.answer||""));
      var why = escapeHtml(String(q.why_it_matters||""));
      return (
        '<div class="q" data-i="' + i + '" role="button" tabindex="0">' +
          '<div class="qq">' + qq + '</div>' +
          '<div class="aa">' + aa + '</div>' +
          (why ? '<div class="why">' + why + '</div>' : '') +
        '</div>'
      );
    }).join("");

    host.querySelectorAll(".q").forEach(function(el){
      el.addEventListener("click", function(){ el.classList.toggle("open"); });
      el.addEventListener("keydown", function(e){
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); el.classList.toggle("open"); }
      });
    });
  }

  function renderReading(){
    var ps = currentParas();
    idx = clamp(idx, 0, Math.max(0, ps.length-1));

    var terms = uniqTerms((DATA.glossary||[]).map(function(g){ return g.term; }));
    setBadge();

    // While speaking with karaoke, render a special view for the active paragraph.
    if(speaking && karaokeOn){
      var t = ps[idx] || "";
      $("reading").innerHTML = renderKaraoke(t, speakChar);
      return;
    }

    if(oneAtATime){
      var p = ps[idx] || "";
      $("reading").innerHTML = '<p class="para focus">' + highlight(p, terms) + "</p>";
      return;
    }

    // All paragraphs
    var out = "";
    for(var i=0;i<ps.length;i++){
      var cls = "para" + (i===idx ? " focus" : "");
      out += '<p class="' + cls + '" data-para="' + i + '">' + highlight(ps[i], terms) + "</p>";
    }
    $("reading").innerHTML = out;
  }

  function render(){
    renderReading();
    renderCheat();
    renderTerms();
    renderSelfTest();
  }

  // A11y sliders
  function bindSlider(id, cssVar, suffix, fmt){
    var el = $(id);
    var out = $("v_" + id);
    if(!el) return;

    var defaults = DATA.a11y || {};
    var saved = {};
    try{ saved = JSON.parse(localStorage.getItem(LS + "_a11y") || "{}") || {}; } catch(e){ saved = {}; }

    var start = (saved[id] != null) ? Number(saved[id]) : Number(defaultsFor(id, defaults));
    el.value = String(start);

    function update(){
      var v = Number(el.value);
      var shown = fmt ? fmt(v) : (String(v) + (suffix||""));
      out.textContent = shown;
      setVar(cssVar, String(v) + (suffix||""));
      try{
        var s = {};
        try{ s = JSON.parse(localStorage.getItem(LS + "_a11y") || "{}") || {}; }catch(e){}
        s[id] = v;
        localStorage.setItem(LS + "_a11y", JSON.stringify(s));
      } catch(e){}
    }

    el.addEventListener("input", update);
    update();
  }

  function defaultsFor(id, a11y){
    if(id==="rngFont") return Number(a11y.fontSize || 18);
    if(id==="rngLetter") return Number(a11y.letterSpacing || 0.02);
    if(id==="rngWord") return Number(a11y.wordSpacing || 0.06);
    if(id==="rngLine") return Number(a11y.lineHeight || 1.6);
    if(id==="rngWidth") return Number(a11y.maxWidth || 760);
    return 0;
  }

  // Map sliders to CSS vars
  bindSlider("rngFont", "--fontSize", "px", function(v){ return v.toFixed(0) + "px"; });
  bindSlider("rngLetter", "--letterSpacing", "em", function(v){ return v.toFixed(2) + "em"; });
  bindSlider("rngWord", "--wordSpacing", "em", function(v){ return v.toFixed(2) + "em"; });
  bindSlider("rngLine", "--lineHeight", "", function(v){ return v.toFixed(2); });
  bindSlider("rngWidth", "--maxWidth", "px", function(v){ return v.toFixed(0) + "px"; });

  // Persisted toggles
  function loadPrefs(){
    try{
      var p = JSON.parse(localStorage.getItem(LS + "_prefs") || "{}") || {};
      oneAtATime = !!p.oneAtATime;
      karaokeOn = (p.karaokeOn == null) ? true : !!p.karaokeOn;
      idx = Number.isFinite(p.idx) ? clamp(Number(p.idx), 0, Math.max(0, currentParas().length-1)) : 0;
    }catch(e){}
  }
  function savePrefs(){
    try{
      localStorage.setItem(LS + "_prefs", JSON.stringify({ oneAtATime: oneAtATime, karaokeOn: karaokeOn, idx: idx }));
    }catch(e){}
  }

  // Speech (karaoke)
  var utter = null;

  function stopSpeak(){
    try{ window.speechSynthesis.cancel(); }catch(e){}
    utter = null;
    speaking = false;
    speakChar = 0;
    render();
  }

  function speakParagraph(i, mode){
    stopSpeak();
    var ps = currentParas();
    idx = clamp(Number(i||0), 0, Math.max(0, ps.length-1));
    savePrefs();

    var text = String(ps[idx] || "").trim();
    if(!text) return;

    speakMode = mode || "para";
    speaking = true;
    speakChar = 0;

    try{
      utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1;
      utter.pitch = 1;
      utter.volume = 1;

      utter.onboundary = function(ev){
        // Some browsers do not support this. If not, karaoke just won't animate.
        try{
          if(ev && typeof ev.charIndex === "number"){
            speakChar = clamp(ev.charIndex, 0, text.length);
            if(karaokeOn) $("reading").innerHTML = renderKaraoke(text, speakChar);
          }
        }catch(e){}
      };

      utter.onend = function(){
        if(speakMode === "all"){
          var next = idx + 1;
          if(next < ps.length){
            speakParagraph(next, "all");
          } else {
            stopSpeak();
          }
        } else {
          speaking = false;
          speakChar = 0;
          render();
        }
      };

      utter.onerror = function(){
        stopSpeak();
      };

      window.speechSynthesis.speak(utter);
      render();
    }catch(e){
      stopSpeak();
      alert("Speech synthesis is not available in this browser.");
    }
  }

  // Events
  $("tabStd").onclick = function(){
    tab="standard";
    $("tabStd").classList.add("primary");
    $("tabAdp").classList.remove("primary");
    stopSpeak();
    idx = 0;
    savePrefs();
    render();
  };
  $("tabAdp").onclick = function(){
    tab="adapted";
    $("tabAdp").classList.add("primary");
    $("tabStd").classList.remove("primary");
    stopSpeak();
    idx = 0;
    savePrefs();
    render();
  };

  $("btnOne").onclick = function(){
    oneAtATime = !oneAtATime;
    $("btnOne").classList.toggle("toggled", oneAtATime);
    stopSpeak();
    savePrefs();
    render();
  };

  $("btnKaraoke").onclick = function(){
    karaokeOn = !karaokeOn;
    $("btnKaraoke").classList.toggle("toggled", karaokeOn);
    stopSpeak();
    savePrefs();
    render();
  };

  $("btnPrev").onclick = function(){
    stopSpeak();
    idx = clamp(idx - 1, 0, Math.max(0, currentParas().length-1));
    savePrefs();
    render();
  };
  $("btnNext").onclick = function(){
    stopSpeak();
    idx = clamp(idx + 1, 0, Math.max(0, currentParas().length-1));
    savePrefs();
    render();
  };

  $("btnSpeakPara").onclick = function(){ speakParagraph(idx, "para"); };
  $("btnSpeakAll").onclick = function(){ speakParagraph(idx, "all"); };
  $("btnStop").onclick = function(){ stopSpeak(); };

  $("btnClearPin").onclick = function(){ clearPin(); };

  $("reading").addEventListener("click", function(e){
    var t = e.target;
    if(t && t.getAttribute){
      if(t.getAttribute("data-para")){
        var p = Number(t.getAttribute("data-para"));
        if(Number.isFinite(p)){ idx = clamp(p, 0, Math.max(0, currentParas().length-1)); savePrefs(); render(); }
      }
      var term = t.getAttribute("data-term");
      if(term){ pin(term); }
    }
  });

  $("pills").addEventListener("click", function(e){
    var t = e.target;
    if(t && t.getAttribute){
      var term = t.getAttribute("data-term");
      if(term){ pin(term); }
    }
  });

  window.addEventListener("keydown", function(e){
    if(e.key === "Escape"){ clearPin(); }
    if(e.key === "ArrowLeft"){ $("btnPrev").click(); }
    if(e.key === "ArrowRight"){ $("btnNext").click(); }
  });

  // Init
  loadPrefs();
  $("btnOne").classList.toggle("toggled", oneAtATime);
  $("btnKaraoke").classList.toggle("toggled", karaokeOn);

  // Ensure tab button styling matches
  $("tabStd").classList.add("primary");
  $("tabAdp").classList.remove("primary");

  clearPin();
  render();
})();
  `.trim();
}
