import { Download, FileText } from "lucide-react";
import { zipSync } from "fflate";
import { useMemo, useRef, useState } from "react";
import { cn } from "cn";
import { FileDrop } from "@/components/file-drop";
import { SampleButton } from "@/components/sample-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatBytes, renameExtension } from "@/lib/files";
import { Choice, count, enter, saveFile } from "../_shared/controls";
import { extractPages, pdfBlob, readPdf } from "../_shared/pdf";
import type { PdfFile } from "../_shared/pdf";
import { parseRanges } from "./ranges";

/** Page tiles beyond this are summarized instead of drawn. */
const shownPages = 300;

export default function SplitPdfTool() {
  const [file, setFile] = useState<PdfFile | null>(null);
  const [mode, setMode] = useState("range");
  const [range, setRange] = useState("1-");
  const [interval, setInterval] = useState("1");
  const [output, setOutput] = useState("pdf");
  const [reading, setReading] = useState("");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const working = useRef(false);

  const selection = useMemo(() => {
    if (!file) return { groups: [] as number[][], error: "" };
    try {
      if (mode === "range") {
        const pages = parseRanges(range, file.pages);
        return { groups: output === "pdf" ? [pages] : pages.map((page) => [page]), error: "" };
      }
      const size = Number(interval);
      if (!Number.isInteger(size) || size < 1 || size > file.pages)
        throw new Error(`Enter a whole number from 1 to ${file.pages}.`);
      const groups: number[][] = [];
      for (let start = 0; start < file.pages; start += size)
        groups.push(
          Array.from({ length: Math.min(size, file.pages - start) }, (_, index) => start + index),
        );
      return { groups, error: "" };
    } catch (cause) {
      return { groups: [], error: (cause as Error).message };
    }
  }, [file, mode, range, interval, output]);

  // Which output file each page lands in, for drawing the page map.
  const owner = useMemo(() => {
    const map = new Map<number, number>();
    selection.groups.forEach((pages, group) => pages.forEach((page) => map.set(page, group)));
    return map;
  }, [selection]);
  const selected = owner.size;
  const zip = selection.groups.length > 1;

  async function open(files: File[]) {
    if (working.current || !files[0]) return;
    working.current = true;
    setReading(`Reading ${files[0].name}`);
    setError("");
    try {
      setFile(await readPdf(files[0]));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      working.current = false;
      setReading("");
    }
  }

  async function split() {
    if (!file || !selection.groups.length || working.current) return;
    working.current = true;
    setError("");
    try {
      const groups = selection.groups;
      const stem = renameExtension(file.name, "").replace(/\.$/, "");
      if (!zip) {
        setProgress("Extracting…");
        const pages = groups[0]!;
        saveFile(
          pdfBlob(await extractPages(file.document, pages)),
          `${stem}-pages.pdf`,
          count(pages.length, "page"),
        );
      } else {
        const entries: Record<string, Uint8Array> = {};
        for (const [index, pages] of groups.entries()) {
          setProgress(`Extracting ${index + 1} of ${groups.length}…`);
          const first = pages[0]! + 1;
          const last = pages.at(-1)! + 1;
          entries[
            `${stem}-${String(index + 1).padStart(String(groups.length).length, "0")}-${first === last ? `page-${first}` : `pages-${first}-${last}`}.pdf`
          ] = await extractPages(file.document, pages);
        }
        setProgress("Zipping…");
        const blob = new Blob([new Uint8Array(zipSync(entries))], { type: "application/zip" });
        saveFile(blob, `${stem}-split.zip`, count(groups.length, "PDF"));
      }
    } catch {
      setError("These pages could not be extracted. The PDF may be damaged. Try another copy.");
    } finally {
      working.current = false;
      setProgress("");
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <FileDrop
          icon={FileText}
          title={file ? "Choose a different PDF" : "Choose a PDF"}
          hint={reading || (file ? undefined : "Pick pages by range or split every N pages.")}
          accept=".pdf,application/pdf"
          onFiles={open}
          compact={!!file}
        >
          {!file && <SampleButton files={["tyranny-a.pdf"]} onFiles={open} />}
        </FileDrop>
        <FieldError>{error}</FieldError>
        {file && (
          <Card key={file.id} className={enter}>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium [overflow-wrap:anywhere]">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {count(file.pages, "page")} · {formatBytes(file.size)}
                </p>
              </div>
              <ol
                className="flex max-h-72 flex-wrap gap-1.5 overflow-auto"
                aria-label={`${count(selected, "page")} selected`}
              >
                {Array.from({ length: Math.min(file.pages, shownPages) }, (_, page) => {
                  const group = owner.get(page);
                  const next = owner.get(page + 1);
                  return (
                    <li
                      key={page}
                      aria-hidden={group === undefined ? "true" : undefined}
                      className={cn(
                        "flex h-11 w-8 items-center justify-center rounded-md border text-xs tabular-nums transition-colors duration-150",
                        group === undefined
                          ? "border-dashed text-muted-foreground/70"
                          : "border-foreground/40 bg-muted font-medium text-foreground",
                        // A gap after the last page of each output file.
                        zip && group !== undefined && next !== group && "me-2",
                      )}
                    >
                      {page + 1}
                    </li>
                  );
                })}
              </ol>
              <p className="text-sm text-muted-foreground tabular-nums">
                {selection.error
                  ? "Fix the page selection to continue."
                  : `${count(selected, "page")} selected · ${zip ? `${count(selection.groups.length, "PDF")} in a ZIP` : "1 PDF"}`}
                {file.pages > shownPages && ` · Map shows the first ${shownPages} pages.`}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      <fieldset disabled={!!progress} className="min-w-0 space-y-5">
        <Choice
          label="Split by"
          value={mode}
          onChange={setMode}
          options={[
            { value: "range", label: "Page ranges" },
            { value: "interval", label: "Every N pages" },
          ]}
        />
        {mode === "range" ? (
          <>
            <Field data-invalid={!!selection.error || undefined}>
              <FieldLabel htmlFor="pdf-range">Pages</FieldLabel>
              <Input
                id="pdf-range"
                value={range}
                placeholder="1-3, 5, 8-"
                autoComplete="off"
                aria-invalid={!!selection.error}
                aria-describedby="pdf-range-help pdf-selection-error"
                onChange={(event) => setRange(event.target.value)}
              />
              <FieldDescription id="pdf-range-help">
                Commas separate ranges. 8- runs to the last page.
              </FieldDescription>
              <FieldError id="pdf-selection-error">{selection.error}</FieldError>
            </Field>
            <Choice
              label="Download as"
              value={output}
              onChange={setOutput}
              options={[
                { value: "pdf", label: "One PDF" },
                { value: "zip", label: "One PDF per page, zipped" },
              ]}
            />
          </>
        ) : (
          <Field data-invalid={!!selection.error || undefined}>
            <FieldLabel htmlFor="pdf-interval">Pages per PDF</FieldLabel>
            <Input
              id="pdf-interval"
              type="number"
              inputMode="numeric"
              min={1}
              max={file?.pages}
              value={interval}
              aria-invalid={!!selection.error}
              aria-describedby="pdf-selection-error"
              onChange={(event) => setInterval(event.target.value)}
            />
            <FieldError id="pdf-selection-error">{selection.error}</FieldError>
          </Field>
        )}
        <Button
          size="lg"
          className="w-full"
          disabled={!file || !!selection.error || !!progress || !!reading}
          onClick={split}
        >
          {progress ? <Spinner aria-hidden="true" /> : <Download aria-hidden="true" />}
          {progress || (zip ? "Download ZIP" : "Download PDF")}
        </Button>
      </fieldset>
    </div>
  );
}
