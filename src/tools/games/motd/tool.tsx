import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Choice, CopyButton, ErrorMessage, Segmented } from "../_shared/controls";
import {
  colors,
  jsonText,
  legacy,
  MinecraftPreview,
  miniMessage,
  parseText,
} from "../_shared/minecraft";

const styles = [
  ["l", "bold", "Bold", "font-bold"],
  ["o", "italic", "Italic", "italic"],
  ["n", "underlined", "Underline", "underline underline-offset-2"],
  ["m", "strikethrough", "Strikethrough", "line-through"],
  ["k", "obfuscated", "Obfuscate", ""],
] as const;

const outputs = {
  section: "Section sign codes (§)",
  amp: "Ampersand codes (&)",
  mini: "MiniMessage",
  json: "JSON text component",
};

export default function MotdTool() {
  const [text, setText] = useState(
    "&6&lTyranny &r&fSurvival\n&7Build something worth discovering.",
  );
  const [mode, setMode] = useState("legacy");
  const [outputMode, setOutputMode] = useState<keyof typeof outputs>("section");
  const editor = useRef<HTMLTextAreaElement>(null);
  let runs: ReturnType<typeof parseText> = [];
  let error = "";
  try {
    runs = parseText(text, mode === "mini");
  } catch (cause) {
    error = (cause as Error).message;
  }
  const output = error
    ? ""
    : outputMode === "json"
      ? JSON.stringify(jsonText(runs), null, 2)
      : outputMode === "mini"
        ? miniMessage(runs)
        : legacy(runs, outputMode === "amp" ? "&" : "§");
  function insert(code: string, tag: string) {
    const start = editor.current?.selectionStart ?? text.length;
    const end = editor.current?.selectionEnd ?? start;
    const before = mode === "mini" ? `<${tag}>` : `&${code}`;
    const after = start !== end && tag !== "reset" ? (mode === "mini" ? `</${tag}>` : "&r") : "";
    setText(text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end));
    // Keep a wrapped selection selected so more styles can stack on it.
    requestAnimationFrame(() => {
      editor.current?.focus();
      editor.current?.setSelectionRange(
        start === end ? end + before.length : start + before.length,
        end + before.length,
      );
    });
  }
  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
      <div className="min-w-0 space-y-6">
        <Segmented
          label="Input syntax"
          value={mode}
          onChange={(value) => {
            if (!error) setText(value === "mini" ? miniMessage(runs) : legacy(runs, "&"));
            setMode(value);
          }}
          options={[
            { value: "legacy", label: "& or § codes" },
            { value: "mini", label: "MiniMessage" },
          ]}
        />
        <Field data-invalid={!!error || undefined}>
          <FieldLabel htmlFor="mc-text">Text</FieldLabel>
          <div className="space-y-2" role="toolbar" aria-label="Formatting">
            <div className="grid w-fit grid-cols-8 gap-1.5">
              {colors.map(([code, name, color]) => (
                <Button
                  key={code}
                  variant="outline"
                  size="icon"
                  aria-label={name.replaceAll("_", " ")}
                  title={name.replaceAll("_", " ")}
                  onClick={() => insert(code, name)}
                >
                  <span
                    className="size-4 rounded-sm outline outline-1 -outline-offset-1 outline-black/15 dark:outline-white/20"
                    style={{ backgroundColor: color }}
                  />
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {styles.map(([code, name, label, className]) => (
                <Button key={code} variant="outline" size="sm" onClick={() => insert(code, name)}>
                  <span className={className}>{label}</span>
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => insert("r", "reset")}>
                Reset
              </Button>
            </div>
          </div>
          <Textarea
            id="mc-text"
            ref={editor}
            value={text}
            spellCheck={false}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? "mc-text-error" : "mc-text-hint"}
            onChange={(event) => setText(event.target.value)}
            className="min-h-32 font-mono"
          />
          {error ? (
            <ErrorMessage id="mc-text-error">{error}</ErrorMessage>
          ) : (
            <FieldDescription id="mc-text-hint">
              Select text, then pick a color or style to wrap it.
            </FieldDescription>
          )}
        </Field>
      </div>
      <div className="min-w-0 space-y-6">
        <MinecraftPreview runs={runs} label="Preview" />
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Choice
                label="Output"
                value={outputMode}
                onChange={(value) => setOutputMode(value as keyof typeof outputs)}
                options={Object.entries(outputs).map(([value, label]) => ({ value, label }))}
              />
            </div>
            <CopyButton value={output} />
          </div>
          <pre
            aria-label={outputs[outputMode]}
            className="max-h-72 min-h-24 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-sm break-all whitespace-pre-wrap"
          >
            {output || <span className="text-muted-foreground">Fix the input to see output.</span>}
          </pre>
          <p className="text-sm text-muted-foreground">
            Vanilla server MOTDs only read section sign codes. Hex colors need a plugin that reads
            §x codes.
          </p>
        </div>
      </div>
    </div>
  );
}
