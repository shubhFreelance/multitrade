// A small A4 document renderer for invoices. Noto Sans Devanagari covers Hindi, English and ₹;
// @pdf-lib/fontkit shapes Devanagari (it needs regenerator-runtime loaded first).
import "regenerator-runtime/runtime.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const INK = rgb(0x1b / 255, 0x25 / 255, 0x50 / 255);
const INDIGO = rgb(0x22 / 255, 0x30 / 255, 0x6b / 255);
const MUTED = rgb(0x55 / 255, 0x5d / 255, 0x7d / 255);
const RULE = rgb(0xd5 / 255, 0xd9 / 255, 0xe6 / 255);
const TONES = { paid: rgb(0x2e / 255, 0x7a / 255, 0x4b / 255), warn: rgb(0x7f / 255, 0x56 / 255, 0x09 / 255), void: rgb(0xa6 / 255, 0x3a / 255, 0x26 / 255) };

const [W, H, M] = [595.28, 841.89, 48]; // A4 in points, margin

export type Block =
  | { kind: "kv"; rows: [string, string][] }
  | { kind: "table"; head: string[]; rows: string[][]; widths: number[]; right: boolean[] }
  | { kind: "totals"; rows: [string, string, boolean?][] }
  | { kind: "note"; text: string; tone?: keyof typeof TONES };

export type DocSpec = {
  company: { name: string; lines: string[] };
  title: string;
  meta: string[]; // number, date… shown under the title
  stamp?: { text: string; tone: keyof typeof TONES };
  blocks: Block[];
  footer: string;
};

let fonts: Promise<[Buffer, Buffer]> | undefined;
const loadFonts = () =>
  (fonts ??= Promise.all(
    ["NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari-Bold.ttf"].map((f) => readFile(path.join(process.cwd(), "assets", "fonts", f))),
  ) as Promise<[Buffer, Buffer]>);

export async function renderPdf(spec: DocSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${spec.title} ${spec.meta[0] ?? ""}`.trim());
  const [reg, bold] = await loadFonts();
  const f = await doc.embedFont(reg, { subset: true });
  const b = await doc.embedFont(bold, { subset: true });

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const text = (s: string, x: number, size: number, font: PDFFont = f, color = INK) => page.drawText(s, { x, y, size, font, color });
  const right = (s: string, xr: number, size: number, font: PDFFont = f, color = INK) =>
    page.drawText(s, { x: xr - font.widthOfTextAtSize(s, size), y, size, font, color });
  const rule = (thick = 0.75, color = RULE) => page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: thick, color });
  const wrap = (s: string, size: number, width: number, font = f) => {
    const out: string[] = [];
    let line = "";
    for (const word of s.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    return [...out, line];
  };
  const footer = () => {
    const keep = y;
    y = M - 20;
    text(spec.footer, M, 8, f, MUTED);
    y = keep;
  };
  const ensure = (needed: number, onNewPage?: () => void) => {
    if (y - needed > M) return;
    footer();
    page = doc.addPage([W, H]);
    y = H - M;
    onNewPage?.();
  };

  // Header: company on the left, document title on the right.
  const top = y;
  y -= 14;
  text(spec.company.name, M, 15, b, INDIGO);
  for (const l of spec.company.lines) {
    y -= 13;
    text(l, M, 9, f, MUTED);
  }
  const leftBottom = y;
  y = top - 16;
  right(spec.title, W - M, 20, b, INK);
  for (const l of spec.meta) {
    y -= 15;
    right(l, W - M, 10, f, MUTED);
  }
  if (spec.stamp) {
    y -= 22;
    const s = spec.stamp.text, size = 11, w = b.widthOfTextAtSize(s, size) + 16;
    page.drawRectangle({ x: W - M - w, y: y - 5, width: w, height: 20, borderColor: TONES[spec.stamp.tone], borderWidth: 1.5 });
    right(s, W - M - 8, size, b, TONES[spec.stamp.tone]);
  }
  y = Math.min(leftBottom, y) - 18;
  rule(2, INDIGO);
  y -= 22;

  for (const block of spec.blocks) {
    if (block.kind === "kv") {
      for (const [k, v] of block.rows) {
        ensure(18);
        text(k, M, 10, f, MUTED);
        right(v, W - M, 10, b);
        y -= 18;
      }
      y -= 6;
    } else if (block.kind === "table") {
      const xs = block.widths.reduce<number[]>((acc, w, i) => [...acc, (acc[i - 1] ?? M) + (i ? block.widths[i - 1] : 0)], []);
      const cell = (row: string[], font: PDFFont, color = INK) =>
        row.forEach((c, i) => (block.right[i] ? right(c, xs[i] + block.widths[i], 9.5, font, color) : text(c, xs[i], 9.5, font, color)));
      const head = () => {
        cell(block.head, b, MUTED);
        y -= 6;
        rule();
        y -= 15;
      };
      ensure(40);
      head();
      for (const row of block.rows) {
        ensure(18, head);
        cell(row, f);
        y -= 17;
      }
      y += 6;
      rule();
      y -= 18;
    } else if (block.kind === "totals") {
      for (const [k, v, strong] of block.rows) {
        ensure(20);
        const size = strong ? 13 : 10.5;
        right(k, W - M - 130, size, strong ? b : f, strong ? INK : MUTED);
        right(v, W - M, size, strong ? b : f);
        y -= strong ? 22 : 17;
      }
      y -= 6;
    } else {
      y -= 8; // keep the box clear of the row above
      const lines = wrap(block.text, 10, W - 2 * M - 20);
      ensure(lines.length * 14 + 16);
      const color = block.tone ? TONES[block.tone] : MUTED;
      if (block.tone) {
        page.drawRectangle({ x: M, y: y - lines.length * 14 + 6, width: W - 2 * M, height: lines.length * 14 + 10, borderColor: color, borderWidth: 1, borderDashArray: [4, 3] });
      }
      for (const l of lines) {
        text(l, M + 10, 10, f, color);
        y -= 14;
      }
      y -= 14;
    }
  }
  footer();
  return doc.save();
}
