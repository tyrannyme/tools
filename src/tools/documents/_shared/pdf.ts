import { PDFDocument } from "pdf-lib";

export interface PdfFile {
  id: string;
  name: string;
  size: number;
  document: PDFDocument;
  pages: number;
}

export async function readPdf(file: File): Promise<PdfFile> {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf")
    throw new Error(`${file.name}: choose a PDF file.`);
  try {
    const document = await PDFDocument.load(await file.arrayBuffer());
    if (!document.getPageCount()) throw new Error("empty");
    return {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      document,
      pages: document.getPageCount(),
    };
  } catch {
    throw new Error(
      `${file.name}: this PDF could not be opened. It may be damaged or password-protected. Try an unlocked copy.`,
    );
  }
}

export async function extractPages(source: PDFDocument, pages: number[]) {
  const result = await PDFDocument.create();
  for (const page of await result.copyPages(source, pages)) result.addPage(page);
  return result.save();
}

export function pdfBlob(bytes: Uint8Array) {
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
