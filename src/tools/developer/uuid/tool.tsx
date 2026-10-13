import { Check, Copy, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useHydrated } from "@/lib/use-hydrated";

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

export default function UuidTool() {
  const [version, setVersion] = useState<Version>("v4");
  const [count, setCount] = useState(10);
  const [batch, setBatch] = useState(0);
  const [copied, setCopied] = useState(false);
  const hydrated = useHydrated();
  // Random values only exist in the browser, so the server renders an empty list.
  const ids = useMemo(() => {
    void batch;
    return hydrated ? generate(version, count) : [];
  }, [hydrated, version, count, batch]);

  const copy = async () => {
    await navigator.clipboard.writeText(ids.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-5">
        <Field>
          <FieldLabel>Version</FieldLabel>
          <ToggleGroup
            variant="outline"
            value={[version]}
            onValueChange={(value: string[]) => value[0] && setVersion(value[0] as Version)}
          >
            <ToggleGroupItem value="v4">v4 random</ToggleGroupItem>
            <ToggleGroupItem value="v7">v7 sortable</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="uuid-count">How many</FieldLabel>
          <Input
            id="uuid-count"
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(event) =>
              setCount(Math.min(1000, Math.max(1, Number(event.target.value) || 1)))
            }
          />
        </Field>
        <div className="flex gap-2">
          <Button onClick={copy} disabled={ids.length === 0}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : "Copy all"}
          </Button>
          <Button variant="outline" onClick={() => setBatch((value) => value + 1)}>
            <RefreshCw aria-hidden="true" /> New batch
          </Button>
        </div>
      </div>
      <Card className="py-0">
        <CardContent className="max-h-[28rem] min-h-[16rem] overflow-auto p-4 font-mono text-sm leading-7">
          {ids.map((id) => (
            <div key={id}>{id}</div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
