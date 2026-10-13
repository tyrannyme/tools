import {
  ChevronDown,
  CircleCheck,
  Download,
  FolderArchive,
  MapPin,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { formatBytes } from "@/lib/files";
import {
  ButtonSpinner,
  ErrorMessage,
  ImageDrop,
  enter,
  imageOutline,
  save,
  useObjectUrl,
} from "../_shared/controls";
import { message, readImage, zipFiles } from "../_shared/image";
import { inspectMetadata } from "./inspect";
import { stripMetadata } from "./strip";

type Fields = Record<string, unknown>;
type Photo = {
  file: File;
  clean: Blob;
  name: string;
  removed: number;
  /** Null when the reader could not interpret the file. */
  fields: Fields | null;
  /** Fields still readable in the clean copy. Null when the check could not run. */
  remaining: number | null;
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
function display(value: unknown): string {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? "Invalid date" : dateFormat.format(value);
  if (value instanceof Uint8Array) return `${value.length} bytes of binary data`;
  if (Array.isArray(value)) return value.map(display).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function first(fields: Fields, ...keys: string[]) {
  for (const key of keys) if (fields[key] != null && fields[key] !== "") return fields[key];
  return undefined;
}
function coordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(5)}° ${value < 0 ? negative : positive}`;
}

/** The fields people usually care about, in plain words. */
function highlights(fields: Fields) {
  const rows: { label: string; value: string }[] = [];
  const camera = [first(fields, "Make"), first(fields, "Model")].filter(Boolean).map(display);
  if (camera.length)
    rows.push({
      label: "Camera",
      value: camera[1]?.startsWith(camera[0]!) ? camera[1] : camera.join(" "),
    });
  const taken = first(fields, "DateTimeOriginal", "CreateDate", "ModifyDate", "DateCreated");
  if (taken) rows.push({ label: "Date", value: display(taken) });
  const author = first(fields, "Artist", "Byline", "creator", "Author");
  if (author) rows.push({ label: "Author", value: display(author) });
  const copyright = first(fields, "Copyright", "CopyrightNotice", "rights");
  if (copyright) rows.push({ label: "Copyright", value: display(copyright) });
  const software = first(fields, "Software", "CreatorTool");
  if (software) rows.push({ label: "Software", value: display(software) });
  return rows;
}

async function prepare(file: File): Promise<Photo> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { blob, removed } = stripMetadata(bytes);
  // Make sure the clean copy still decodes before offering it.
  await readImage(blob);
  let fields: Fields | null = null;
  try {
    fields = await inspectMetadata(file, bytes);
  } catch {
    fields = null;
  }
  let remaining: number | null = null;
  try {
    const cleanBytes = new Uint8Array(await blob.arrayBuffer());
    remaining = Object.keys(
      await inspectMetadata(new File([blob], file.name, { type: blob.type }), cleanBytes),
    ).length;
  } catch {
    remaining = null;
  }
  return { file, clean: blob, name: `clean-${file.name}`, removed, fields, remaining };
}

function PhotoCard({ photo, primary }: { photo: Photo; primary: boolean }) {
  const url = useObjectUrl(photo.file);
  const fields = photo.fields ?? {};
  const entries = Object.entries(fields);
  const latitude = typeof fields.latitude === "number" ? fields.latitude : null;
  const longitude = typeof fields.longitude === "number" ? fields.longitude : null;
  const located = latitude !== null && longitude !== null;
  const rows = highlights(fields);
  const rotated =
    fields.Orientation != null &&
    fields.Orientation !== 1 &&
    fields.Orientation !== "Horizontal (normal)";
  const profile = entries.some(([key]) =>
    /^(ProfileDescription|ColorProfile|ProfileClass)$/.test(key),
  );
  const nothing = photo.removed === 0 && entries.length === 0;
  const verified = photo.remaining === 0;

  return (
    <Card className={cn("gap-0 py-0", enter)}>
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-4 gap-y-4 p-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:grid-rows-[auto_1fr] sm:gap-x-5 sm:gap-y-4">
        <div className="flex aspect-square min-h-0 items-center justify-center overflow-hidden rounded-lg bg-muted/50 p-2 sm:row-span-2 sm:self-start">
          <img
            src={url || undefined}
            alt={photo.file.name}
            className={cn("max-h-full max-w-full rounded-sm object-contain", imageOutline)}
          />
        </div>
        <div className="min-w-0 self-center sm:self-start">
          <p className="truncate font-medium" title={photo.file.name}>
            {photo.file.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {nothing
              ? "No metadata found"
              : photo.fields === null
                ? `${photo.removed} metadata ${photo.removed === 1 ? "block" : "blocks"} found`
                : `${entries.length} metadata ${entries.length === 1 ? "field" : "fields"} found`}
          </p>
        </div>
        <div className="col-span-2 min-w-0 space-y-4 empty:hidden sm:col-span-1 sm:col-start-2">
          {located && (
            <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-3">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">Location</p>
                <p className="text-muted-foreground tabular-nums">
                  <span className="whitespace-nowrap">{coordinate(latitude, "N", "S")},</span>{" "}
                  <span className="whitespace-nowrap">{coordinate(longitude, "E", "W")}</span>
                  {typeof fields.GPSAltitude === "number" &&
                    ` · ${Math.round(fields.GPSAltitude)} m`}
                </p>
              </div>
              <a
                href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-sm underline underline-offset-4 hover:text-foreground"
              >
                View on map
              </a>
            </div>
          )}
          {rows.length > 0 && (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
              {rows.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="truncate" title={row.value}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {entries.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger
                render={<Button variant="ghost" size="sm" className="-ml-2.5 group/trigger" />}
              >
                Show all {entries.length} fields
                <ChevronDown
                  className="transition-transform duration-200 group-data-[panel-open]/trigger:rotate-180"
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <dl className="mt-2 max-h-72 space-y-2 overflow-auto overscroll-contain rounded-lg border p-3 text-sm">
                  {entries.map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="break-all">{display(value).slice(0, 400)}</dd>
                    </div>
                  ))}
                </dl>
              </CollapsibleContent>
            </Collapsible>
          )}
          {photo.fields === null && (
            <p className="text-sm text-muted-foreground">
              The fields could not be read, but the metadata blocks can still be removed.
            </p>
          )}
          {(rotated || profile) && !nothing && (
            <div className="space-y-1.5 text-sm text-muted-foreground">
              {rotated && (
                <p className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  This photo is rotated by a metadata tag, so the clean copy may display sideways.
                </p>
              )}
              {profile && (
                <p className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  The color profile is removed too, so colors may shift slightly.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3">
        <p className="flex items-center gap-2 text-sm">
          {verified ? (
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <span>
            {nothing
              ? "Already clean"
              : verified
                ? "Clean copy has no metadata"
                : photo.remaining === null
                  ? "Clean copy could not be checked"
                  : `${photo.remaining} fields remain in the clean copy`}
            <span className="text-muted-foreground tabular-nums">
              {" "}
              · {formatBytes(photo.clean.size)}
            </span>
          </span>
        </p>
        {!nothing && (
          <Button
            variant={primary ? "default" : "outline"}
            onClick={() => save(photo.clean, photo.name)}
          >
            <Download aria-hidden="true" />
            Download clean copy
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function MetadataTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const [reading, setReading] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState("");
  const busy = reading !== null || zipping;

  async function inspect(next: File[]) {
    setFiles(next);
    setPhotos([]);
    setFailures([]);
    setError("");
    const done: Photo[] = [];
    const failed: string[] = [];
    for (const [index, file] of next.entries()) {
      setReading(index);
      try {
        done.push(await prepare(file));
      } catch (error) {
        failed.push(`${file.name}: ${message(error)}`);
      }
      setPhotos([...done]);
      setFailures([...failed]);
    }
    setReading(null);
  }
  async function downloadAll() {
    setZipping(true);
    setError("");
    try {
      save(
        await zipFiles(photos.map((photo) => ({ name: photo.name, blob: photo.clean }))),
        "clean-images.zip",
      );
    } catch (error) {
      setError(message(error));
    } finally {
      setZipping(false);
    }
  }

  const total = files.reduce((sum, file) => sum + file.size, 0);
  return (
    <div className="space-y-6">
      <ImageDrop
        multiple
        disabled={busy}
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        hint="JPEG, PNG, or WebP. Pixels are copied as they are, without re-encoding."
        onError={setError}
        current={
          files.length
            ? {
                title: files.length === 1 ? files[0]!.name : `${files.length} images`,
                detail: `${formatBytes(total)}${files.length > 1 ? " total" : ""}`,
              }
            : null
        }
        onFiles={(next) => void inspect(next)}
      />
      <ErrorMessage error={error} />
      {reading !== null && files.length > 1 && (
        <Progress value={(reading / files.length) * 100} className="max-w-sm">
          <ProgressLabel>
            Reading {reading + 1} of {files.length}
          </ProgressLabel>
          <ProgressValue />
        </Progress>
      )}
      {reading !== null && files.length === 1 && (
        <output className="flex items-center gap-2 text-sm text-muted-foreground">
          <ButtonSpinner />
          Reading metadata
        </output>
      )}
      {failures.map((failure) => (
        <ErrorMessage key={failure} error={failure} />
      ))}
      {reading === null && photos.length > 1 && (
        <div className={cn("flex flex-wrap items-center justify-between gap-3", enter)}>
          <p className="text-sm">
            <span className="font-medium">{photos.length} clean copies ready</span>
          </p>
          <Button disabled={zipping} onClick={() => void downloadAll()}>
            {zipping ? <ButtonSpinner /> : <FolderArchive aria-hidden="true" />}
            {zipping ? "Zipping…" : "Download all as ZIP"}
          </Button>
        </div>
      )}
      <div className="space-y-4">
        {photos.map((photo, index) => (
          <PhotoCard
            key={`${index}-${photo.file.name}`}
            photo={photo}
            primary={files.length === 1}
          />
        ))}
      </div>
    </div>
  );
}
