// Renders public/samples/tyranny-a.pdf (3 pages) and tyranny-b.pdf (2 pages),
// so the PDF tools can be tried without your own files.
// Pass a PNG of public/samples/door.webp (pdf-lib cannot read WebP), for example one made with any image editor.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const root = fileURLToPath(new URL("..", import.meta.url));
const door = readFileSync(process.argv[2]);
const ink = rgb(0.11, 0.1, 0.2);
const gold = rgb(0.85, 0.7, 0.42);
const mist = rgb(0.93, 0.9, 0.95);

async function render(file, letter, pages) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Tyranny sample ${letter}`);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const art = await pdf.embedPng(door);
  for (let index = 1; index <= pages; index++) {
    const page = pdf.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: index % 2 ? ink : mist });
    const text = index % 2 ? rgb(1, 1, 1) : ink;
    const width = 300;
    const height = (art.height / art.width) * width;
    page.drawImage(art, { x: (595 - width) / 2, y: 330, width, height: Math.min(height, 420) });
    page.drawText(`${letter}${index}`, { x: 60, y: 200, size: 96, font: serif, color: gold });
    page.drawText(`Sample document ${letter}, page ${index} of ${pages}`, {
      x: 60,
      y: 150,
      size: 18,
      font: serif,
      color: text,
    });
    page.drawText("tools.tyranny.me", { x: 60, y: 60, size: 12, font: serif, color: gold });
  }
  writeFileSync(join(root, "public/samples", file), await pdf.save());
  console.log(`public/samples/${file}`);
}

await render("tyranny-a.pdf", "A", 3);
await render("tyranny-b.pdf", "B", 2);
