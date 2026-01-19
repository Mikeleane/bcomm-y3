export type KeyTerm = { term: string; score: number };

const STOP = new Set([
  "the","a","an","and","or","but","if","then","else","when","while","for","to","of","in","on","at","by","with","from",
  "is","are","was","were","be","been","being","as","it","this","that","these","those","we","you","they","he","she","i",
  "not","no","yes","do","does","did","done","can","could","will","would","shall","should","may","might","must",
  "have","has","had","having","get","gets","got","make","makes","made","use","uses","used",
  "into","over","under","between","within","without","about","around","than","also","more","most","less","least",
  "very","much","many","some","any","each","every","all","one","two","three","new","old",
  "their","there","here","where","what","why","how","who","whom","which",
  "weve","youve","theyve","dont","doesnt","didnt","cant","wont","isnt","arent","wasnt","werent"
]);

export function normalizeText(input: string): string {
  return (input || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitSentences(text: string): string[] {
  const t = normalizeText(text);
  if (!t) return [];
  return t
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
    .map(s => s.trim())
    .filter(Boolean);
}

export function extractKeyTerms(text: string, maxTerms = 14): KeyTerm[] {
  const t = normalizeText(text).toLowerCase();
  if (!t) return [];

  const tokens = t.match(/[a-z][a-z'\-]{2,}/g) || [];
  const freq = new Map<string, number>();

  for (const raw of tokens) {
    const w = raw.replace(/^'+|'+$/g, "");
    if (!w || STOP.has(w)) continue;
    if (w.length < 4) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  const scored: KeyTerm[] = Array.from(freq.entries()).map(([term, f]) => {
    const score = f * (1 + Math.min(1.2, term.length / 10));
    return { term, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const out: KeyTerm[] = [];
  const seen = new Set<string>();
  for (const k of scored) {
    const base = k.term.replace(/s$/,"");
    if (seen.has(base)) continue;
    seen.add(base);
    out.push(k);
    if (out.length >= maxTerms) break;
  }
  return out;
}

export function buildCheatSheet(text: string, terms: string[]) {
  const sentences = splitSentences(text);
  const tldr = sentences.slice(0, 3).join(" ").slice(0, 520);

  const keyPoints = terms.slice(0, 8).map((term) => `• ${cap(term)} — why it matters (fill/AI later)`);
  const prompts = terms.slice(0, 6).map((term) => `• Define ${cap(term)} and give an example from the text.`);

  return {
    tldr: tldr || "No text yet — feed me something delicious (pdf/docx/text/url).",
    keyPoints,
    prompts
  };
}

export function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}