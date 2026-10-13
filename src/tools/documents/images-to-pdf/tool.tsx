import { Download, Images } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { useRef, useState } from "react";
import { FileDrop } from "@/components/file-drop";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatBytes, loadSample } from "@/lib/files";
import { Choice, count, moveItem, OrderedFiles, saveFile } from "../_shared/controls";
import { pdfBlob } from "../_shared/pdf";
import { pageLayout, readImage } from "./images";
import type { PdfImage } from "./images";

export default function ImagesToPdfTool() {
  const [images, setImages] = useState<PdfImage[]>([]);
  const [size, setSize] = useState("a4");
  const [orientation, setOrientation] = useState("auto");
  const [margin, setMargin] = useState("12");
  const [reading, setReading] = useState("");
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const working = useRef(false);
  const marginNumber = Number(margin);
  const marginError =
    margin.trim() === "" || !Number.isFinite(marginNumber) || marginNumber < 0 || marginNumber > 50
      ? "Enter a margin from 0 to 50 mm."
      : "";

  async function addFiles(files: File[]) {
    if (working.current) return;
    working.current = true;
    setErrors([]);
    const failed: string[] = [];
    for (const [index, file] of files.entries()) {
      setReading(
        files.length > 1
          ? `Reading ${index + 1} of ${files.length}: ${file.name}`
          : `Reading ${file.name}`,
      );
      try {
        const image = await readImage(file);
        setImages((current) => [...current, image]);
      } catch (cause) {
        failed.push((cause as Error).message);
      }
    }
    setErrors(failed);
    setReading("");
    working.current = false;
  }

  async function sample() {
    setReading("Loading the sample");
    try {
      await addFiles([await loadSample("door.webp", "image/webp")]);
    } catch {
      setReading("");
      setErrors(["The sample could not be loaded. Check your connection, or add your own image."]);
    }
  }

  async function create() {
    if (working.current || marginError) return;
    working.current = true;
    setErrors([]);
    try {
      const pdf = await PDFDocument.create();
      for (const [index, image] of images.entries()) {
        setProgress(`Adding page ${index + 1} of ${images.length}…`);
        const layout = pageLayout(image, size, orientation, marginNumber);
        const embedded =
          image.format === "jpg" ? await pdf.embedJpg(image.data) : await pdf.embedPng(image.data);
        pdf.addPage([layout.width, layout.height]).drawImage(embedded, {
          x: layout.x,
          y: layout.y,
          width: layout.imageWidth,
          height: layout.imageHeight,
        });
      }
      setProgress("Saving…");
      saveFile(pdfBlob(await pdf.save()), "images.pdf", count(images.length, "page"));
    } catch {
      setErrors(["The PDF could not be created. Remove some images, or use smaller ones."]);
    } finally {
      working.current = false;
      setProgress("");
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-4">
        <FileDrop
          icon={Images}
          title="Add images"
          hint={reading || "PNG, JPEG, or WebP. One image per page."}
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          multiple
          paste
          onFiles={addFiles}
          compact={images.length > 0}
        >
          {!images.length && (
            <Button variant="outline" disabled={!!reading} onClick={sample}>
              Try a sample
            </Button>
          )}
        </FileDrop>
        <FieldError errors={errors.map((message) => ({ message }))} />
        <OrderedFiles
          items={images}
          disabled={!!progress}
          onMove={(from, to) => setImages((current) => moveItem(current, from, to))}
          onRemove={(id) => setImages((current) => current.filter((image) => image.id !== id))}
        >
          {(image, index) => {
            const layout = pageLayout(image, size, orientation, marginError ? 12 : marginNumber);
            return (
              <div className="flex items-center gap-3 sm:gap-4">
                <div
                  className="relative w-12 shrink-0 bg-white shadow-sm ring-1 ring-black/10 sm:w-16 dark:ring-white/10"
                  style={{ aspectRatio: `${layout.width}/${layout.height}` }}
                >
                  <img
                    src={image.data}
                    alt=""
                    draggable={false}
                    className="absolute"
                    style={{
                      left: `${(layout.x / layout.width) * 100}%`,
                      top: `${(layout.y / layout.height) * 100}%`,
                      width: `${(layout.imageWidth / layout.width) * 100}%`,
                      height: `${(layout.imageHeight / layout.height) * 100}%`,
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-medium [overflow-wrap:anywhere]">
                    <span className="text-muted-foreground tabular-nums">{index + 1}.</span>{" "}
                    {image.name}
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    <span className="whitespace-nowrap">
                      {image.width} × {image.height} px
                    </span>{" "}
                    · <span className="whitespace-nowrap">{formatBytes(image.size)}</span>
                  </p>
                </div>
              </div>
            );
          }}
        </OrderedFiles>
      </div>
      <fieldset disabled={!!progress} className="min-w-0 space-y-5">
        <Choice
          label="Page size"
          value={size}
          onChange={setSize}
          options={[
            { value: "a4", label: "A4 (210 × 297 mm)" },
            { value: "letter", label: "Letter (8.5 × 11 in)" },
            { value: "fit", label: "Same as each image" },
          ]}
        />
        {size !== "fit" && (
          <Choice
            label="Orientation"
            value={orientation}
            onChange={setOrientation}
            options={[
              { value: "auto", label: "Match each image" },
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
        )}
        <Field data-invalid={!!marginError || undefined}>
          <FieldLabel htmlFor="image-margin">Margins (mm)</FieldLabel>
          <Input
            id="image-margin"
            type="number"
            inputMode="decimal"
            min={0}
            max={50}
            step={1}
            value={margin}
            aria-invalid={!!marginError}
            aria-describedby="image-margin-error"
            onChange={(event) => setMargin(event.target.value)}
          />
          {size === "fit" && !marginError && (
            <FieldDescription>
              Pages are sized at 96 pixels per inch, plus margins.
            </FieldDescription>
          )}
          <FieldError id="image-margin-error">{marginError}</FieldError>
        </Field>
        <Button
          size="lg"
          className="w-full"
          onClick={create}
          disabled={!images.length || !!progress || !!reading || !!marginError}
        >
          {progress ? <Spinner aria-hidden="true" /> : <Download aria-hidden="true" />}
          {progress || (images.length > 1 ? `Download ${images.length}-page PDF` : "Download PDF")}
        </Button>
      </fieldset>
    </div>
  );
}
