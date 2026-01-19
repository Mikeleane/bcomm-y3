import { NextResponse } from "next/server";
import pdfParseImport from "pdf-parse";
import * as mammoth from "mammoth";

export const runtime = "nodejs";

const pdfParse: any = (pdfParseImport as any).default ?? (pdfParseImport as any);

function extOf(name: string) {
  const parts = (name || "").split(".");
  return (parts.length > 1 ? parts.pop() : "")?.toLowerCase() || "";
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const name = file.name || "upload";
    const type = file.type || "";
    const ext = extOf(name);

    const buf = Buffer.from(await file.arrayBuffer());

    let kind: "pdf" | "docx" | "text" = "text";
    let text = "";

    if (type === "application/pdf" || ext === "pdf") {
      kind = "pdf";
      const data = await pdfParse(buf);
      text = data?.text || "";
    } else if (
      type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      kind = "docx";
      const res = await mammoth.extractRawText({ buffer: buf });
      text = res?.value || "";
    } else if (type.startsWith("text/") || ["txt","md","csv"].includes(ext)) {
      kind = "text";
      text = buf.toString("utf8");
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${type || ext || "unknown"}` },
        { status: 415 }
      );
    }

    return NextResponse.json({
      kind,
      name,
      chars: text.length,
      text
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Extraction failed." },
      { status: 500 }
    );
  }
}