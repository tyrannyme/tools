import { Check, FileText, X } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { cn } from "cn";
import { FileDrop } from "@/components/file-drop";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/files";
import { encodeBase64 } from "../_shared/base64";
import { CopyButton, ErrorMessage, Segmented, enter } from "../_shared/ui";

const algorithms = [
  { name: "SHA-1", bytes: 20 },
  { name: "SHA-256", bytes: 32 },
  { name: "SHA-384", bytes: 48 },
  { name: "SHA-512", bytes: 64 },
] as const;
const limit = 64 * 1024 * 1024;

type Digests = Record<string, { hex: string; base64: string }>;

async function digestAll(data: ArrayBuffer | Uint8Array<ArrayBuffer>) {
  if (!crypto.subtle) throw new Error("Hashing needs a secure page. Open this tool over HTTPS.");
  const results = await Promise.all(algorithms.map(({ name }) => crypto.subtle.digest(name, data)));
  const digests: Digests = {};
  results.forEach((buffer, index) => {
    const bytes = new Uint8Array(buffer);
    digests[algorithms[index]!.name] = {
      hex: Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
      base64: encodeBase64(bytes),
    };
  });
  return digests;
}

export default function HashTool() {
  const [source, setSource] = useState("Hello, world!");
  const [file, setFile] = useState<File | null>(null);
  const [encoding, setEncoding] = useState<"hex" | "base64">("hex");
  const [compare, setCompare] = useState("");
  const [state, setState] = useState<{
    input: File | string;
    digests: Digests | null;
    error: string;
  } | null>(null);
  const text = useDeferredValue(source);
  const target = file ?? text;
  // Text hashes in a moment, so only a file shows progress.
  const pending = !!file && state?.input !== file;
  const digests = state?.digests ?? null;
  const error = state?.input === target ? state.error : "";

  useEffect(() => {
    let current = true;
    const input =
      typeof target === "string"
        ? Promise.resolve(new TextEncoder().encode(target))
        : target.size > limit
          ? Promise.reject(
              new Error(`This file is ${formatBytes(target.size)}. Choose a file up to 64 MB.`),
            )
          : target.arrayBuffer();
    input
      .then(digestAll)
      .then((next) => current && setState({ input: target, digests: next, error: "" }))
      .catch((cause: unknown) => {
        if (!current) return;
        setState({
          input: target,
          digests: null,
          error:
            cause instanceof Error
              ? cause.message
              : "Unable to read this file. Try choosing it again.",
        });
      });
    return () => {
      current = false;
    };
  }, [target]);

  const expected = compare.trim().replace(/^sha\d*[-:=\s]+/i, "");
  const matched = expected
    ? algorithms.find(({ name }) => {
        const digest = digests?.[name];
        return digest && (expected.toLowerCase() === digest.hex || expected === digest.base64);
      })
    : undefined;

  return (
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
              Hash text instead
            </Button>
          </div>
        ) : (
          <Field>
            <FieldLabel htmlFor="hash-source">Text</FieldLabel>
            <Textarea
              id="hash-source"
              value={source}
              placeholder="Hello, world!"
              spellCheck={false}
              className="h-40 field-sizing-fixed font-mono"
              onChange={(event) => setSource(event.target.value)}
            />
          </Field>
        )}
        <FileDrop
          className="py-8"
          title={file ? "Choose another file" : "Or drop a file"}
          hint="Up to 64 MB"
          onFiles={(files) => setFile(files[0]!)}
        />
        <ErrorMessage>{error}</ErrorMessage>
      </div>

      <div className="min-w-0 space-y-4">
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <p
              className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {pending ? (
                <>
                  <Spinner aria-hidden="true" />
                  Hashing {formatBytes(file?.size ?? 0)}
                </>
              ) : file ? (
                <span className="truncate">{file.name}</span>
              ) : (
                `UTF-8 text, ${formatBytes(new TextEncoder().encode(text).length)}`
              )}
            </p>
            <Segmented
              label="Encoding"
              hideLabel
              value={encoding}
              onChange={(value) => setEncoding(value as "hex" | "base64")}
              options={[
                { value: "hex", label: "Hex" },
                { value: "base64", label: "Base64" },
              ]}
            />
          </div>
          <CardContent className="p-0">
            <dl className="divide-y">
              {algorithms.map(({ name, bytes }) => {
                const value = digests?.[name]?.[encoding];
                const size = encoding === "hex" ? bytes * 2 : Math.ceil(bytes / 3) * 4;
                return (
                  <div
                    key={name}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors",
                      matched?.name === name && "bg-muted",
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <dt className="flex items-center gap-2 text-sm font-medium">
                        {name}
                        {name === "SHA-1" && (
                          <span className="font-normal text-muted-foreground">
                            Legacy, not collision resistant
                          </span>
                        )}
                        {matched?.name === name && <Check className="size-4" aria-hidden="true" />}
                      </dt>
                      {/* Same-length filler holds the space until the digest is ready. */}
                      <dd
                        className={cn(
                          "font-mono text-sm break-all transition-opacity",
                          (!value || pending) && "text-transparent select-none",
                        )}
                      >
                        {value ?? "0".repeat(size)}
                      </dd>
                    </div>
                    <CopyButton
                      name={name}
                      text={value ?? ""}
                      disabled={!value || pending}
                      className="-mt-1 -mr-1"
                    />
                  </div>
                );
              })}
            </dl>
          </CardContent>
        </Card>
        <Field>
          <FieldLabel htmlFor="hash-compare">Expected hash</FieldLabel>
          <Input
            id="hash-compare"
            className="font-mono"
            spellCheck={false}
            value={compare}
            aria-describedby="hash-compare-result"
            onChange={(event) => setCompare(event.target.value)}
          />
          <div id="hash-compare-result" aria-live="polite" className="min-h-5 text-sm">
            {expected && digests && !pending && (
              <p
                key={matched?.name ?? "none"}
                className={cn(
                  "flex items-center gap-2",
                  enter,
                  matched ? "text-foreground" : "text-destructive",
                )}
              >
                {matched ? (
                  <>
                    <Check className="size-4" aria-hidden="true" />
                    Matches the {matched.name} digest
                  </>
                ) : (
                  <>
                    <X className="size-4" aria-hidden="true" />
                    No match. Check that you chose the right file or text.
                  </>
                )}
              </p>
            )}
          </div>
        </Field>
      </div>
    </div>
  );
}
