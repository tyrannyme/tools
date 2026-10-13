import { CircleCheck } from "lucide-react";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton, DownloadButton, ErrorMessage, Segmented } from "../_shared/ui";
import { JsonSyntaxError, parseJson, sortJson } from "./parser";

const sample =
  '{"name":"Tyranny","tools":["format","validate","explore"],"private":true,"version":1}';
const indents: Record<string, string | number | undefined> = {
  "2": 2,
  "4": 4,
  tab: "\t",
  minify: undefined,
};

function Tree({
  value,
  label = "root",
  depth = 0,
}: {
  value: unknown;
  label?: string;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  if (value === null || typeof value !== "object")
    return (
      <div className="py-0.5 break-all">
        <span className="text-muted-foreground">{label}: </span>
        {JSON.stringify(value)}
      </div>
    );
  const entries = Object.entries(value);
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer rounded py-0.5 hover:bg-muted">
        {label}{" "}
        <span className="text-muted-foreground">
          {Array.isArray(value)
            ? `[${entries.length} ${entries.length === 1 ? "item" : "items"}]`
            : `{${entries.length} ${entries.length === 1 ? "key" : "keys"}}`}
        </span>
      </summary>
      {open && (
        <div className="ml-1.5 border-l pl-4">
          {entries.slice(0, 500).map(([key, item]) => (
            <Tree key={key} label={key} value={item} depth={depth + 1} />
          ))}
          {entries.length > 500 && (
            <p className="py-0.5 text-muted-foreground">
              {(entries.length - 500).toLocaleString("en-US")} more. Copy or download the text for
              all of them.
            </p>
          )}
        </div>
      )}
    </details>
  );
}

export default function JsonTool() {
  const [source, setSource] = useState(sample);
  const [style, setStyle] = useState("2");
  const [sort, setSort] = useState(false);
  const [tab, setTab] = useState("text");
  const input = useRef<HTMLTextAreaElement>(null);
  const deferred = useDeferredValue(source);
  const result = useMemo(() => {
    if (!deferred.trim()) return null;
    try {
      const value = parseJson(deferred);
      const sorted = sort ? sortJson(value) : value;
      return { value: sorted, output: JSON.stringify(sorted, null, indents[style]), error: null };
    } catch (error) {
      return {
        value: null,
        output: "",
        error:
          error instanceof JsonSyntaxError
            ? error
            : new JsonSyntaxError("Unable to read this JSON.", 0),
      };
    }
  }, [deferred, sort, style]);
  const error = result?.error ?? null;
  const output = result?.output ?? "";
  const position = error?.position ?? 0;
  const before = deferred.slice(0, position);
  const line = before.split("\n").length;
  const column = position - before.lastIndexOf("\n");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <Segmented
          label="Indentation"
          value={style}
          onChange={setStyle}
          options={[
            { value: "2", label: "2 spaces" },
            { value: "4", label: "4 spaces" },
            { value: "tab", label: "Tab" },
            { value: "minify", label: "Minify" },
          ]}
        />
        <Field orientation="horizontal" className="h-8 w-auto">
          <Checkbox id="json-sort" checked={sort} onCheckedChange={setSort} />
          <FieldLabel htmlFor="json-sort">Sort keys</FieldLabel>
        </Field>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <div className="flex min-h-8 items-center justify-between gap-2">
            <FieldLabel htmlFor="json-source">Input</FieldLabel>
            {source && (
              <Button variant="ghost" onClick={() => setSource("")}>
                Clear
              </Button>
            )}
          </div>
          <Textarea
            ref={input}
            id="json-source"
            wrap="off"
            className="h-72 field-sizing-fixed lg:h-96 font-mono text-sm"
            value={source}
            spellCheck={false}
            placeholder='{"name": "Tyranny"}'
            aria-invalid={!!error || undefined}
            aria-describedby="json-status"
            onChange={(event) => setSource(event.target.value)}
          />
          <div id="json-status" aria-live="polite" className="min-h-5 text-sm">
            {error ? (
              <div className="space-y-3">
                <ErrorMessage>
                  {error.message} Line {line}, column {column}.
                </ErrorMessage>
                <pre className="overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap break-all">
                  {deferred.slice(Math.max(0, position - 60), position)}
                  <mark className="rounded-sm bg-destructive/15 text-destructive underline">
                    {deferred[position] ?? "[end of input]"}
                  </mark>
                  {deferred.slice(position + 1, position + 60)}
                </pre>
                <Button
                  variant="outline"
                  onClick={() => {
                    input.current?.focus();
                    input.current?.setSelectionRange(position, position + 1);
                  }}
                >
                  Go to error
                </Button>
              </div>
            ) : result ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <CircleCheck className="size-4" aria-hidden="true" />
                Valid JSON
              </p>
            ) : null}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-3">
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="tree" disabled={!result || !!error}>
                Tree
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <CopyButton text={output} disabled={!output} message="Copied JSON" />
              <DownloadButton
                blob={() => new Blob([output + "\n"], { type: "application/json" })}
                filename={style === "minify" ? "minified.json" : "formatted.json"}
                disabled={!output}
              />
            </div>
          </div>
          <TabsContent value="text">
            <Textarea
              aria-label="Formatted JSON"
              readOnly
              wrap={style === "minify" ? "soft" : "off"}
              value={output}
              placeholder="Formatted JSON appears here"
              className="h-72 field-sizing-fixed lg:h-96 font-mono text-sm"
            />
          </TabsContent>
          <TabsContent value="tree">
            <Card className="py-0">
              <CardContent className="h-72 overflow-auto lg:h-96 overscroll-contain p-4 font-mono text-sm">
                {result && !error && <Tree key={output} value={result.value} />}
              </CardContent>
            </Card>
          </TabsContent>
          <p className="text-xs text-muted-foreground">
            {output && `${output.length.toLocaleString("en-US")} characters. `}
            Numbers beyond 2⁵³ lose precision, and duplicate keys keep the last value.
          </p>
        </Tabs>
      </div>
    </div>
  );
}
