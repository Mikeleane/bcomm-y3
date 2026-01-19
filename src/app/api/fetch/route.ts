import { NextResponse } from "next/server";
import { htmlToText } from "html-to-text";

export const runtime = "nodejs";

function safeUrl(u: string) {
  try {
    const url = new URL(u);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const urlObj = new URL(req.url);
    const raw = urlObj.searchParams.get("url") || "";
    const url = safeUrl(raw);

    if (!url) {
      return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
    }

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "bcomm-y3/1.0 (study helper)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7"
      }
    });

    const ct = res.headers.get("content-type") || "";
    const body = await res.text();

    let text = body;

    if (ct.includes("text/html") || body.includes("<html") || body.includes("<body")) {
      text = htmlToText(body, {
        wordwrap: 120,
        selectors: [
          { selector: "a", options: { ignoreHref: true } },
          { selector: "img", format: "skip" },
          { selector: "script", format: "skip" },
          { selector: "style", format: "skip" }
        ]
      });
    }

    return NextResponse.json({
      url: url.toString(),
      chars: text.length,
      text
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Fetch failed." },
      { status: 500 }
    );
  }
}