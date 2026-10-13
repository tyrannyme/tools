import { Check, Copy } from "lucide-react";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { duration, textStats } from "./stats";

const readingSpeed = 238;
const speakingSpeed = 150;

export default function TextStatsTool() {
  const [text, setText] = useState("");
  const [skipCommon, setSkipCommon] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const reset = useRef<ReturnType<typeof setTimeout>>(undefined);
  const deferred = useDeferredValue(text);
  const stats = useMemo(() => textStats(deferred, skipCommon), [deferred, skipCommon]);
  const metrics = [
    ["Words", stats.words],
    ["Characters", stats.characters],
    ["Characters without spaces", stats.withoutSpaces],
    ["Sentences", stats.sentences],
    ["Paragraphs", stats.paragraphs],
  ] as const;

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(
        [
          ...metrics.map(([label, value]) => `${label}: ${value}`),
          `Reading time: ${duration(stats.words, readingSpeed)} (${readingSpeed} words/min)`,
          `Speaking time: ${duration(stats.words, speakingSpeed)} (${speakingSpeed} words/min)`,
          ...(stats.frequent.length
            ? ["", "Most frequent words:", ...stats.frequent.map(([word, n]) => `${word}: ${n}`)]
            : []),
        ].join("\n"),
      );
      setCopied(true);
      toast.success("Statistics copied");
      clearTimeout(reset.current);
      reset.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard access was blocked. Allow clipboard access for this site and try again.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metrics.map(([label, value], index) => (
          <Card key={label} size="sm" className={cn(index === 0 && "col-span-2 sm:col-span-1")}>
            <CardContent className="flex h-full flex-col justify-between gap-1">
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {value.toLocaleString("en")}
              </p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-3">
          <Field>
            <FieldLabel htmlFor="stats-text" className="sr-only">
              Text to count
            </FieldLabel>
            <Textarea
              id="stats-text"
              className="min-h-80 leading-relaxed"
              placeholder="Paste or type your text"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setError("");
              }}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={!text} onClick={copy}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              Copy statistics
            </Button>
            <Button
              variant="ghost"
              disabled={!text}
              onClick={() => {
                setText("");
                document.getElementById("stats-text")?.focus();
              }}
            >
              Clear
            </Button>
          </div>
          <FieldError>{error}</FieldError>
          <p className="text-sm text-muted-foreground">
            Blank lines separate paragraphs. Characters include spaces and punctuation, and an emoji
            counts as one.
          </p>
        </div>
        <div className="space-y-4">
          <Card size="sm">
            <CardContent className="grid grid-cols-2 gap-4">
              {(
                [
                  ["Reading time", readingSpeed],
                  ["Speaking time", speakingSpeed],
                ] as const
              ).map(([label, speed]) => (
                <div key={label}>
                  <p className="text-lg font-semibold tabular-nums">
                    {duration(stats.words, speed)}
                  </p>
                  <p className="text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{speed} words/min</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>
                <h2>Most frequent words</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field orientation="horizontal">
                <Switch id="stats-skip" checked={skipCommon} onCheckedChange={setSkipCommon} />
                <FieldLabel htmlFor="stats-skip" className="font-normal">
                  Skip words like “the” and “and”
                </FieldLabel>
              </Field>
              {stats.frequent.length ? (
                <ol className="space-y-2.5">
                  {stats.frequent.map(([word, n]) => (
                    <li key={word}>
                      <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span className="[overflow-wrap:anywhere]">{word}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">{n}</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/60"
                          style={{ width: `${(n / stats.frequent[0]![1]) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  The 10 most used words appear here as you type.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
