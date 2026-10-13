import { FileText } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { cn } from "cn";
import { FileDrop } from "@/components/file-drop";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/files";
import { decodeBase64, encodeBase64, imageType } from "../_shared/base64";
import { CopyButton, DownloadButton, ErrorMessage, Segmented, enter } from "../_shared/ui";

type Mode = "encode" | "decode";
type Options = { mode: Mode; urlSafe: boolean; dataUrl: boolean };
type Output = {
  /** Null when the decoded bytes are not UTF-8 text. */
  text: string | null;
  blob: Blob;
  filename: string;
  image: boolean;
  inputSize: number;
};

const limit = { encode: 16 * 1024 * 1024, decode: 24 * 1024 * 1024 };

function encode(bytes: Uint8Array, mime: string, name: string, options: Options): Output {
  if (bytes.byteLength > limit.encode)
    throw new Error(`This input is ${formatBytes(bytes.byteLength)}. Use one up to 16 MB.`);
  const encoded = encodeBase64(bytes, options.urlSafe && !options.dataUrl);
  const text = options.dataUrl ? `data:${mime};base64,${encoded}` : encoded;
  return {
    text,
    blob: new Blob([text], { type: "text/plain" }),
    filename: `${name}.base64.txt`,
    image: false,
    inputSize: bytes.byteLength,
  };
}

function decode(source: string, options: Options): Output {
  if (source.length > limit.decode)
    throw new Error(`This input is ${formatBytes(source.length)}. Use one up to 24 MB.`);
  let encoded = source.trim();
  let mime = "application/octet-stream";
  const match = /^data:([^;,]*)(?:;[^,]*)?;base64,([\s\S]*)$/i.exec(encoded);
  if (encoded.startsWith("data:") && !match)
    throw new Error("This data URL is not Base64. It needs ;base64, before the data.");
  if (match) {
    mime = match[1] || mime;
    encoded = match[2]!;
  }
  const bytes = decodeBase64(encoded, !match && options.urlSafe);
  const detected = imageType(bytes);
  const image = !!detected;
  mime = detected ?? mime;
  let text: string | null = null;
  if (!image)
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      // Not text. The bytes are offered as a download instead.
    }
  const extension = image
    ? mime.split("/")[1]!.replace("svg+xml", "svg").replace("x-icon", "ico")
    : text !== null
      ? "txt"
      : "bin";
  return {
    text,
    blob: new Blob([bytes], { type: text !== null ? "text/plain" : mime }),
    filename: `decoded.${extension}`,
    image,
    inputSize: source.length,
  };
}

function run(convert: () => Output) {
  try {
    return { output: convert(), error: "" };
  } catch (cause) {
    return {
      output: null,
      error: cause instanceof Error ? cause.message : "Unable to convert this input.",
    };
  }
}

export default function Base64Tool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [urlSafe, setUrlSafe] = useState(false);
  const [dataUrl, setDataUrl] = useState(false);
  const [source, setSource] = useState("Hello, 世界 👋");
  const [file, setFile] = useState<File | null>(null);
  const [fileResult, setFileResult] = useState<{
    file: File;
    key: string;
    output: Output | null;
    error: string;
  } | null>(null);
  const text = useDeferredValue(source);
  const options = useMemo(() => ({ mode, urlSafe, dataUrl }), [mode, urlSafe, dataUrl]);
  const key = `${mode} ${urlSafe} ${dataUrl}`;

  // Text converts as you type. Files are read in the background.
  const textResult = useMemo(
    () =>
      file || !text
        ? null
        : run(() =>
            options.mode === "encode"
              ? encode(new TextEncoder().encode(text), "text/plain;charset=utf-8", "text", options)
              : decode(text, options),
          ),
    [file, text, options],
  );
  const fileReady = !!file && fileResult?.file === file && fileResult.key === key;
  const pending = !!file && !fileReady;
  const result = file ? (fileReady ? fileResult : null) : textResult;
  const output = result?.output ?? null;

  useEffect(() => {
    if (!file) return;
    let current = true;
    const size = file.size;
    const read =
      size > limit[options.mode]
        ? Promise.reject(
            new Error(
              `This file is ${formatBytes(size)}. Choose one up to ${options.mode === "encode" ? 16 : 24} MB.`,
            ),
          )
        : options.mode === "encode"
          ? file
              .arrayBuffer()
              .then(
                (buffer) => () =>
                  encode(
                    new Uint8Array(buffer),
                    file.type || "application/octet-stream",
                    file.name,
                    options,
                  ),
              )
          : file.text().then((content) => () => decode(content, options));
    read
      .then((convert) => current && setFileResult({ file, key, ...run(convert) }))
      .catch((cause: unknown) => {
        if (!current) return;
        setFileResult({
          file,
          key,
          output: null,
          error:
            cause instanceof Error
              ? cause.message
              : "Unable to read this file. Try choosing it again.",
        });
      });
    return () => {
      current = false;
    };
  }, [file, options, key]);

  const preview = useMemo(
    () =>
      output?.image && typeof window !== "undefined" ? URL.createObjectURL(output.blob) : null,
    [output],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function switchMode(next: Mode) {
    // Carry a text result over, so encoding then decoding is a round trip.
    if (output?.text != null && output.text.length <= 1_000_000) {
      setSource(output.text);
      setFile(null);
    } else if (file) {
      setFile(null);
      setSource("");
    }
    setMode(next);
  }

  const outputLabel =
    mode === "encode"
      ? "Base64"
      : output?.image
        ? "Decoded image"
        : output && output.text === null
          ? "Decoded file"
          : "Decoded text";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <Segmented
          label="Mode"
          value={mode}
          onChange={(value) => switchMode(value as Mode)}
          options={[
            { value: "encode", label: "Encode" },
            { value: "decode", label: "Decode" },
          ]}
        />
        <Segmented
          label="Alphabet"
          value={urlSafe && !(mode === "encode" && dataUrl) ? "url" : "standard"}
          disabled={mode === "encode" && dataUrl}
          onChange={(value) => setUrlSafe(value === "url")}
          options={[
            { value: "standard", label: "Standard" },
            { value: "url", label: "URL-safe" },
          ]}
        />
        {mode === "encode" && (
          <Field orientation="horizontal" className="h-8 w-auto">
            <Checkbox id="base64-data-url" checked={dataUrl} onCheckedChange={setDataUrl} />
            <FieldLabel htmlFor="base64-data-url">Data URL</FieldLabel>
          </Field>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <FileText className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <Button variant="ghost" onClick={() => setFile(null)}>
                Use text instead
              </Button>
            </div>
          ) : (
            <Field>
              <FieldLabel htmlFor="base64-source">
                {mode === "encode" ? "Text" : "Base64 or data URL"}
              </FieldLabel>
              <Textarea
                id="base64-source"
                className="h-48 field-sizing-fixed font-mono break-all"
                value={source}
                spellCheck={false}
                placeholder={mode === "encode" ? "Hello, world" : "SGVsbG8sIHdvcmxk"}
                aria-invalid={!!result?.error || undefined}
                aria-describedby="base64-error"
                onChange={(event) => setSource(event.target.value)}
              />
            </Field>
          )}
          <div id="base64-error" aria-live="polite">
            <ErrorMessage>{result?.error}</ErrorMessage>
          </div>
          <FileDrop
            className="py-8"
            title={file ? "Choose another file" : "Or drop a file"}
            hint={mode === "encode" ? "Any file up to 16 MB" : "A text file of Base64, up to 24 MB"}
            onFiles={(files) => setFile(files[0]!)}
          />
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-medium">{outputLabel}</h2>
              {output && !pending && (
                <span className="text-sm text-muted-foreground tabular-nums">
                  {formatBytes(output.inputSize)} → {formatBytes(output.blob.size)}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {output?.text != null && <CopyButton text={output.text} disabled={pending} />}
              <DownloadButton
                blob={() => output!.blob}
                filename={output?.filename ?? "output.txt"}
                disabled={!output || pending}
              />
            </div>
          </div>
          <div className="relative">
            {output?.image && preview ? (
              <div
                className={cn(
                  "flex h-64 items-center justify-center rounded-lg border bg-muted/30 p-4",
                  enter,
                )}
              >
                <img
                  src={preview}
                  alt="Decoded from the Base64 input"
                  className="max-h-full max-w-full object-contain outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                />
              </div>
            ) : output && output.text === null ? (
              <div
                className={cn(
                  "flex h-64 flex-col items-center justify-center gap-1 rounded-lg border bg-muted/30 p-6 text-center",
                  enter,
                )}
              >
                <p className="font-medium">Binary data</p>
                <p className="text-sm text-muted-foreground">
                  {formatBytes(output.blob.size)} that is not text. Download it to open it.
                </p>
              </div>
            ) : (
              <Textarea
                aria-label={outputLabel}
                readOnly
                className={cn(
                  "h-64 field-sizing-fixed font-mono break-all transition-opacity",
                  pending && "opacity-50",
                )}
                value={output?.text ?? ""}
                placeholder={
                  mode === "encode" ? "Base64 appears here" : "Decoded text appears here"
                }
              />
            )}
            {pending && (
              <div
                className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"
                aria-live="polite"
              >
                <Spinner aria-hidden="true" />
                Reading {formatBytes(file!.size)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
