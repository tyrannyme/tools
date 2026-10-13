import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { browserAI, readStream, useAvailability, useChromeTask } from "../_voice/chrome";
import { ChromeNote, Unsupported, deviceNeeds } from "../_voice/browser-note";
import {
  Choice,
  CopyButton,
  DownloadButton,
  ResultPanel,
  ToolError,
  WorkStatus,
  enter,
  languageName,
  languages,
  textFile,
} from "../_voice/ui";

const types = [
  { value: "key-points", label: "Key points" },
  { value: "tldr", label: "TL;DR" },
  { value: "teaser", label: "Teaser" },
  { value: "headline", label: "Headline" },
];
// Chrome's maximum for each length, per type.
const limits: Record<string, [string, string, string]> = {
  "key-points": ["3 points", "5 points", "7 points"],
  tldr: ["1 sentence", "3 sentences", "5 sentences"],
  teaser: ["1 sentence", "3 sentences", "5 sentences"],
  headline: ["12 words", "17 words", "22 words"],
};
const formats = [
  { value: "plain-text", label: "Plain text" },
  { value: "markdown", label: "Markdown" },
];
const supportedLanguages = languages.filter(({ value }) =>
  ["en", "es", "ja", "de", "fr"].includes(value),
);
const maxLength = 30000;

export default function SummarizeTool() {
  const [text, setText] = useState("");
  const [type, setType] = useState("key-points");
  const [length, setLength] = useState("short");
  const [format, setFormat] = useState("plain-text");
  const [language, setLanguage] = useState("en");
  const [result, setResult] = useState("");
  const [complete, setComplete] = useState(false);
  const task = useChromeTask();
  const status = useAvailability((ai) => ai.Summarizer, {}, task.runs);
  const unsupported = status === "missing" || status === "unavailable";
  const lengths = ["short", "medium", "long"].map((value, index) => ({
    value,
    label: `${value[0].toUpperCase()}${value.slice(1)} · ${limits[type][index]}`,
  }));
  function clearResult() {
    setResult("");
    setComplete(false);
    task.setError(null);
  }
  function summarize() {
    if (!text.trim()) {
      task.setError("Paste or type some text to summarize.");
      return;
    }
    void task.run(async (signal) => {
      clearResult();
      const summarizer = browserAI().Summarizer;
      const options = {
        type,
        length,
        format,
        expectedInputLanguages: [language],
        outputLanguage: language,
      };
      if (summarizer && (await summarizer.availability(options)) === "unavailable")
        throw new Error(
          `Chrome can't summarize ${languageName(language)} on this device. Try English.`,
        );
      const session = await task.create(summarizer, options, "summarizer", signal);
      task.setProgress({ label: "Writing the summary…" });
      await readStream(session.summarizeStreaming(text, { signal }), signal, setResult);
      setComplete(true);
    });
  }
  const streaming = task.busy && !!result;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Choice
          label="Type"
          value={type}
          options={types}
          onChange={(value) => {
            setType(value);
            clearResult();
          }}
          disabled={task.busy}
        />
        <Choice
          label="Length"
          value={length}
          options={lengths}
          onChange={(value) => {
            setLength(value);
            clearResult();
          }}
          disabled={task.busy}
        />
        <Choice
          label="Format"
          value={format}
          options={formats}
          onChange={(value) => {
            setFormat(value);
            clearResult();
          }}
          disabled={task.busy}
        />
        <Choice
          label="Language"
          value={language}
          options={supportedLanguages}
          onChange={(value) => {
            setLanguage(value);
            clearResult();
          }}
          disabled={task.busy}
        />
      </div>
      <div className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
        <Field className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor="summary-input">Text</FieldLabel>
            <span className="text-xs text-muted-foreground tabular-nums">
              {text.length > maxLength * 0.8 &&
                `${text.length.toLocaleString()} / ${maxLength.toLocaleString()}`}
            </span>
          </div>
          <Textarea
            id="summary-input"
            placeholder="Paste an article, email, or notes."
            value={text}
            maxLength={maxLength}
            readOnly={task.busy}
            className="min-h-72 flex-1 text-base md:text-base"
            onChange={(event) => {
              setText(event.target.value);
              clearResult();
            }}
          />
        </Field>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm leading-snug font-medium">Summary</p>
          <ResultPanel
            label="Summary"
            className="min-h-72 flex-1 bg-muted/30"
            footer={
              complete && (
                <>
                  <CopyButton text={result} />
                  <DownloadButton
                    options={[
                      textFile(result, format === "markdown" ? "summary.md" : "summary.txt"),
                    ]}
                  />
                </>
              )
            }
          >
            {unsupported ? (
              <Unsupported
                title={
                  status === "missing"
                    ? "Summaries need Chrome on a computer"
                    : "Chrome's built-in model can't run on this device"
                }
              >
                {status === "missing"
                  ? "This tool uses Gemini Nano, the model built into desktop Chrome 138 and later on Windows, macOS, Linux, and Chromebook Plus. Open this page there to summarize."
                  : deviceNeeds}
              </Unsupported>
            ) : result ? (
              <div className="flex-1 space-y-4 p-4">
                <p
                  className="text-base leading-relaxed whitespace-pre-wrap wrap-anywhere"
                  dir="auto"
                  lang={language}
                  aria-busy={streaming}
                >
                  {result}
                </p>
                {!task.busy && !complete && (
                  <p className={`text-sm text-muted-foreground ${enter}`}>
                    Stopped early. Summarize again for the full summary.
                  </p>
                )}
              </div>
            ) : (
              <p className="flex-1 p-4 text-base text-muted-foreground">
                {limits[type][["short", "medium", "long"].indexOf(length)]}, in{" "}
                {languageName(language)}.
              </p>
            )}
          </ResultPanel>
        </div>
      </div>
      <div className="space-y-3">
        <Button disabled={task.busy || unsupported} onClick={summarize}>
          {task.busy && <Spinner />}
          Summarize
        </Button>
        <ChromeNote
          status={status}
          engine="Uses Gemini Nano, built into Chrome."
          download="The first summary downloads the model, a few GB, which Chrome keeps for next time."
        />
      </div>
      <WorkStatus
        progress={task.busy ? (task.progress ?? { label: "Starting…" }) : null}
        onCancel={task.cancel}
      />
      <ToolError error={task.error} />
    </div>
  );
}
