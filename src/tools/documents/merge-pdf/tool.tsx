import { Download, Files } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { useRef, useState } from "react";
import { FileDrop } from "@/components/file-drop";
import { SampleButton } from "@/components/sample-button";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { formatBytes } from "@/lib/files";
import { count, moveItem, OrderedFiles, saveFile } from "../_shared/controls";
import { pdfBlob, readPdf } from "../_shared/pdf";
import type { PdfFile } from "../_shared/pdf";

export default function MergePdfTool() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [reading, setReading] = useState("");
  const [merging, setMerging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const working = useRef(false);
  const pages = files.reduce((sum, file) => sum + file.pages, 0);

  async function addFiles(incoming: File[]) {
    if (working.current) return;
    working.current = true;
    setErrors([]);
    const failed: string[] = [];
    for (const [index, file] of incoming.entries()) {
      setReading(
        incoming.length > 1
          ? `Reading ${index + 1} of ${incoming.length}: ${file.name}`
          : `Reading ${file.name}`,
      );
      try {
        const pdf = await readPdf(file);
        setFiles((current) => [...current, pdf]);
      } catch (cause) {
        failed.push((cause as Error).message);
      }
    }
    setErrors(failed);
    setReading("");
    working.current = false;
  }

  async function merge() {
    if (working.current) return;
    working.current = true;
    setMerging(true);
    setErrors([]);
    let current = "";
    try {
      const merged = await PDFDocument.create();
      for (const file of files) {
        current = file.name;
        for (const page of await merged.copyPages(file.document, file.document.getPageIndices()))
          merged.addPage(page);
      }
      current = "";
      saveFile(pdfBlob(await merged.save()), "merged.pdf", count(merged.getPageCount(), "page"));
    } catch {
      setErrors([
        current
          ? `${current} could not be merged. Remove it, or add an unlocked copy.`
          : "The merged PDF could not be saved. Try again with fewer files.",
      ]);
    } finally {
      setMerging(false);
      working.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <FileDrop
        icon={Files}
        title="Add PDF files"
        hint={reading || "Pages are merged in the order listed."}
        accept=".pdf,application/pdf"
        multiple
        onFiles={addFiles}
        compact={files.length > 0}
      >
        {files.length === 0 && (
          <SampleButton files={["tyranny-a.pdf", "tyranny-b.pdf"]} onFiles={addFiles} />
        )}
      </FileDrop>
      <FieldError errors={errors.map((message) => ({ message }))} />
      {files.length > 0 && (
        <>
          <OrderedFiles
            items={files}
            disabled={merging}
            onMove={(from, to) => setFiles((current) => moveItem(current, from, to))}
            onRemove={(id) => setFiles((current) => current.filter((file) => file.id !== id))}
          >
            {(file, index) => (
              <>
                <p className="font-medium [overflow-wrap:anywhere]">
                  <span className="text-muted-foreground tabular-nums">{index + 1}.</span>{" "}
                  {file.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {count(file.pages, "page")} · {formatBytes(file.size)}
                </p>
              </>
            )}
          </OrderedFiles>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <p className="text-sm text-muted-foreground tabular-nums">
              {files.length < 2
                ? "Add at least one more PDF to merge."
                : `${count(files.length, "file")} · ${count(pages, "page")} · ${formatBytes(files.reduce((sum, file) => sum + file.size, 0))}`}
            </p>
            <Button size="lg" disabled={files.length < 2 || merging || !!reading} onClick={merge}>
              {merging ? <Spinner aria-hidden="true" /> : <Download aria-hidden="true" />}
              {merging ? "Merging…" : "Merge and download"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
