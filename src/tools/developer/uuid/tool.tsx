import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/lib/use-hydrated";
import { CopyButton, DownloadButton, Segmented } from "../_shared/ui";

type Version = "v4" | "v7";

function uuidV7() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const time = BigInt(Date.now());
  for (let i = 0; i < 6; i++) bytes[i] = Number((time >> BigInt(40 - i * 8)) & 0xffn);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function generate(version: Version, count: number) {
  return Array.from({ length: count }, () => (version === "v4" ? crypto.randomUUID() : uuidV7()));
}

const isCount = (value: number) => Number.isInteger(value) && value >= 1 && value <= 1000;

export default function UuidTool() {
  const [version, setVersion] = useState<Version>("v4");
  // Keep what was typed, so clearing the field to type a new number works.
  const [countText, setCountText] = useState("10");
  const [batch, setBatch] = useState(0);
  const hydrated = useHydrated();
  const [count, setCount] = useState(10);
  const valid = isCount(Number(countText));
  // Random values only exist in the browser, so the server renders an empty list.
  const ids = useMemo(() => {
    void batch;
    return hydrated ? generate(version, count) : [];
  }, [hydrated, version, count, batch]);
  const text = ids.join("\n");

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="space-y-5">
        <Segmented
          label="Version"
          value={version}
          onChange={(value) => setVersion(value as Version)}
          options={[
            { value: "v4", label: "v4 random" },
            { value: "v7", label: "v7 time-ordered" },
          ]}
        />
        <Field data-invalid={!valid || undefined}>
          <FieldLabel htmlFor="uuid-count">How many</FieldLabel>
          <Input
            id="uuid-count"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            value={countText}
            aria-invalid={!valid || undefined}
            aria-describedby="uuid-count-hint"
            onChange={(event) => {
              setCountText(event.target.value);
              const next = Number(event.target.value);
              if (isCount(next)) setCount(next);
            }}
          />
          <FieldDescription id="uuid-count-hint" className={valid ? undefined : "text-destructive"}>
            {valid ? "Up to 1,000" : "Enter a whole number from 1 to 1,000."}
          </FieldDescription>
        </Field>
      </div>
      <Card className="gap-0 py-0">
        <div className="border-b px-4 py-3">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              disabled={!hydrated}
              onClick={() => setBatch((value) => value + 1)}
            >
              <RefreshCw aria-hidden="true" />
              <span className="max-sm:sr-only">Regenerate</span>
            </Button>
            <DownloadButton
              blob={() => new Blob([text + "\n"], { type: "text/plain" })}
              filename={`uuids-${version}.txt`}
              disabled={!ids.length}
            />
            <CopyButton
              text={text}
              label="Copy all"
              variant="default"
              message={ids.length === 1 ? "Copied 1 UUID" : `Copied ${ids.length} UUIDs`}
              disabled={!ids.length}
            />
          </div>
        </div>
        <CardContent className="h-80 overflow-auto overscroll-contain p-4 font-mono text-sm leading-7 tabular-nums">
          <ol>
            {ids.map((id) => (
              <li key={id} className="select-all">
                {id}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
