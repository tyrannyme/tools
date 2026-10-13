import { Download, FolderArchive } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { formatBytes, renameExtension } from "@/lib/files";
import {
  ButtonSpinner,
  ErrorMessage,
  FormatFields,
  ImageDrop,
  enter,
  imageOutline,
  save,
  useObjectUrl,
} from "../_shared/controls";
import { extension, message, readImage, resizeImage, zipFiles } from "../_shared/image";
import type { Format } from "../_shared/image";

type Result = { blob?: Blob; name?: string; error?: string };

function change(before: number, after: number) {
  const ratio = after / before - 1;
  if (Math.abs(ratio) < 0.005) return "same size";
  return `${Math.round(Math.abs(ratio) * 100)}% ${ratio < 0 ? "smaller" : "larger"}`;
}

function FileCard({ file, result, pending }: { file: File; result?: Result; pending: boolean }) {
  const url = useObjectUrl(result?.blob ?? file);
  return (
    <Card className="gap-0 py-0">
      <div className="relative flex aspect-[4/3] min-h-0 items-center justify-center overflow-hidden bg-muted/50 p-3">
        <img
          src={url || undefined}
          alt={file.name}
          className={cn(
            "max-h-full max-w-full rounded-sm object-contain transition-opacity duration-200",
            imageOutline,
            pending && "opacity-50",
          )}
        />
        {pending && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-sm shadow-sm">
              <ButtonSpinner />
              Converting
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 border-t p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={result?.name ?? file.name}>
            {result?.name ?? file.name}
          </p>
          <p className="truncate text-sm text-muted-foreground tabular-nums">
            {result?.blob
              ? `${formatBytes(file.size)} → ${formatBytes(result.blob.size)}, ${change(file.size, result.blob.size)}`
              : formatBytes(file.size)}
          </p>
        </div>
        {result?.blob && (
          <Button
            variant="outline"
            size="icon"
            aria-label={`Download ${result.name}`}
            title={`Download ${result.name}`}
            onClick={() => save(result.blob!, result.name!)}
          >
            <Download aria-hidden="true" />
          </Button>
        )}
      </div>
      {result?.error && <ErrorMessage error={result.error} className="px-3 pb-3" />}
    </Card>
  );
}

export default function ConvertTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [format, setFormat] = useState<Format>("webp");
  const [quality, setQuality] = useState(85);
  const [active, setActive] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState("");
  const converting = active !== null;
  const busy = converting || zipping;

  function clear() {
    setResults([]);
    setError("");
  }
  async function convert() {
    clear();
    const next: Result[] = [];
    for (const [index, file] of files.entries()) {
      setActive(index);
      try {
        const image = await readImage(file);
        const { blob } = await resizeImage(
          image,
          image.naturalWidth,
          image.naturalHeight,
          format,
          quality / 100,
        );
        next.push({ blob, name: renameExtension(file.name, extension(format)) });
      } catch (error) {
        next.push({ error: message(error) });
      }
      setResults([...next]);
    }
    setActive(null);
  }
  async function downloadAll() {
    setZipping(true);
    setError("");
    try {
      save(
        await zipFiles(done.map((item) => ({ name: item.name!, blob: item.blob! }))),
        "converted-images.zip",
      );
    } catch (error) {
      setError(message(error));
    } finally {
      setZipping(false);
    }
  }

  const done = results.filter((result) => result.blob);
  const failed = results.filter((result) => result.error).length;
  const before = files.reduce(
    (sum, file, index) => sum + (results[index]?.blob ? file.size : 0),
    0,
  );
  const after = done.reduce((sum, result) => sum + result.blob!.size, 0);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const finished = !converting && results.length === files.length && files.length > 0;
  const count = files.length === 1 ? "1 image" : `${files.length} images`;

  return (
    <div className="space-y-6">
      <ImageDrop
        multiple
        disabled={busy}
        onError={setError}
        current={
          files.length
            ? {
                title: files.length === 1 ? files[0]!.name : count,
                detail: `${formatBytes(total)}${files.length > 1 ? " total" : ""}`,
              }
            : null
        }
        onFiles={(next) => {
          setFiles(next);
          clear();
        }}
      />
      {!files.length && <ErrorMessage error={error} />}
      {files.length > 0 && (
        <div className={cn("grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]", enter)}>
          <Card className="px-4">
            <fieldset disabled={busy} className="min-w-0 space-y-4">
              <FormatFields
                avif
                format={format}
                setFormat={(value) => {
                  setFormat(value);
                  clear();
                }}
                quality={quality}
                setQuality={(value) => {
                  setQuality(value);
                  clear();
                }}
              />
              <Button size="lg" className="w-full" disabled={busy} onClick={() => void convert()}>
                {converting && <ButtonSpinner />}
                {converting ? "Converting…" : `Convert ${count}`}
              </Button>
              <p className="text-sm text-muted-foreground">
                Animated images become a single still frame.
              </p>
            </fieldset>
          </Card>
          <div className="min-w-0 space-y-4">
            <div
              className="flex flex-wrap items-center justify-between gap-3 empty:hidden"
              aria-live="polite"
            >
              {converting ? (
                <Progress value={((active ?? 0) / files.length) * 100} className="w-full max-w-sm">
                  <ProgressLabel>
                    Converting {(active ?? 0) + 1} of {files.length}
                  </ProgressLabel>
                  <ProgressValue />
                </Progress>
              ) : finished ? (
                <>
                  <p className={cn("text-sm tabular-nums", enter)}>
                    <span className="font-medium">
                      {done.length} of {files.length} converted
                    </span>
                    {done.length > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatBytes(before)} → {formatBytes(after)}
                      </span>
                    )}
                    {failed > 0 && <span className="text-destructive"> · {failed} failed</span>}
                  </p>
                  {done.length > 1 && (
                    <Button disabled={zipping} onClick={() => void downloadAll()}>
                      {zipping ? <ButtonSpinner /> : <FolderArchive aria-hidden="true" />}
                      {zipping ? "Zipping…" : "Download all as ZIP"}
                    </Button>
                  )}
                  {done.length === 1 && (
                    <Button onClick={() => save(done[0]!.blob!, done[0]!.name!)}>
                      <Download aria-hidden="true" />
                      Download
                    </Button>
                  )}
                </>
              ) : null}
            </div>
            <ErrorMessage error={error} />
            <div className="grid gap-4 sm:grid-cols-2">
              {files.map((file, index) => (
                <FileCard
                  key={`${index}-${file.name}-${file.lastModified}`}
                  file={file}
                  result={results[index]}
                  pending={active === index}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
