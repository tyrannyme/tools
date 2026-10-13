import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { browserAI, useAvailability, useChromeTask } from "../_voice/chrome";
import { ChromeNote } from "../_voice/browser-note";
import {
  Choice,
  CopyButton,
  DownloadButton,
  ResultPanel,
  ModelNote,
  useModelCached,
  ToolError,
  WorkStatus,
  automaticLanguage,
  enter,
  languageName,
  languages,
  textFile,
} from "../_voice/ui";

import { useModelWorker } from "../_voice/use-worker";
import { translationModel } from "./models";

const maxLength = 15000;

export default function TranslateTool() {
  const [text, setText] = useState("");
  const [source, setSource] = useState("auto");
  const [target, setTarget] = useState("en");
  const [detected, setDetected] = useState("");
  const [result, setResult] = useState("");
  const [failedPair, setFailedPair] = useState("");
  const task = useChromeTask();
  const worker = useModelWorker(
    () => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
    (reply) => {
      if (reply.type === "translation") setResult(reply.text);
    },
  );
  const busy = task.busy || worker.busy;
  const detector = useAvailability((ai) => ai.LanguageDetector, {}, task.runs);
  const canDetect = detector !== "missing" && detector !== "unavailable";
  const from = source === "auto" && !canDetect ? "" : source;
  const pair = from === "auto" ? detected : from;
  const translator = useAvailability(
    (ai) => ai.Translator,
    pair && pair !== target
      ? { sourceLanguage: pair, targetLanguage: target }
      : { sourceLanguage: target === "en" ? "es" : "en", targetLanguage: target },
    task.runs,
  );
  const fallback =
    translator === "missing" || translator === "unavailable" || failedPair === `${pair}-${target}`;
  const info = translationModel(pair, target);
  const cached = useModelCached(info?.cache ?? ["no-translation-model"], worker.runs);
  const pairUnavailable = fallback && !!pair && pair !== target && !info;
  const unsupported = `This browser can't translate ${languageName(pair || "en")} to ${languageName(target)}. Choose English paired with French, German, Italian, or Spanish.`;

  function clearResult() {
    setResult("");
    task.setError(null);
    worker.setError(null);
  }
  function translate() {
    if (busy) return;
    worker.setError(null);
    if (!from) {
      task.setError("Choose the language under From. This browser cannot detect it automatically.");
      return;
    }
    if (!text.trim()) {
      task.setError("Enter some text to translate.");
      return;
    }
    void task.run(async (signal) => {
      setResult("");
      let language = from;
      if (language === "auto") {
        const session = await task.create(
          browserAI().LanguageDetector,
          {},
          "language detector",
          signal,
        );
        task.setProgress({ label: "Detecting the language…" });
        const [first] = await session.detect(text);
        signal.throwIfAborted();
        if (!first || first.confidence < 0.5 || first.detectedLanguage === "und")
          throw new Error(
            "Unable to tell which language this is. Add more text or choose the language under From.",
          );
        language = first.detectedLanguage;
        setDetected(language);
      }
      if (language === target)
        throw new Error(
          `This text is already in ${languageName(target)}. Choose another language under To.`,
        );
      const options = { sourceLanguage: language, targetLanguage: target };
      const api = browserAI().Translator;
      const status = await api?.availability(options).catch(() => "unavailable");
      signal.throwIfAborted();
      if (!api || status === "unavailable" || failedPair === `${language}-${target}`) {
        const model = translationModel(language, target);
        if (!model)
          throw new Error(
            `This browser can't translate ${languageName(language)} to ${languageName(target)}. Choose English paired with French, German, Italian, or Spanish.`,
          );
        worker.start({
          type: "translate",
          text,
          source: language,
          target,
          label: {
            name: model.name,
            bytes: model.files,
            cached: !!cached && info?.id === model.id,
          },
        });
        return;
      }
      try {
        const session = await task.create(
          api,
          options,
          `${languageName(language)} to ${languageName(target)} translator`,
          signal,
        );
        task.setProgress({
          label: `Translating ${languageName(language)} to ${languageName(target)}…`,
        });
        const translated = await session.translate(text);
        signal.throwIfAborted();
        if (!translated.trim())
          throw new Error("The translator returned nothing. Try another pair.");
        setResult(translated);
      } catch (error) {
        signal.throwIfAborted();
        if (!translationModel(language, target)) throw error;
        setFailedPair(`${language}-${target}`);
        throw new Error(
          "Chrome's translator couldn't run. Press Translate to use the OPUS-MT model shown here.",
        );
      }
    });
  }
  function swap() {
    if (!pair) return;
    setSource(target);
    setTarget(pair);
    setDetected("");
    if (result) {
      setText(result);
      setResult("");
    }
    task.setError(null);
    worker.setError(null);
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-2 gap-y-3 lg:gap-x-3">
        <Choice
          label="From"
          value={from}
          options={
            !canDetect
              ? [{ value: "", label: "Choose language" }, ...languages]
              : detected
                ? [{ value: "auto", label: `${languageName(detected)} (detected)` }, ...languages]
                : automaticLanguage
          }
          disabled={busy}
          onChange={(value) => {
            setSource(value);
            setDetected("");
            clearResult();
          }}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Swap languages"
          title="Swap languages"
          disabled={busy || !pair}
          onClick={swap}
        >
          <ArrowLeftRight aria-hidden="true" />
        </Button>
        <Choice
          label="To"
          value={target}
          options={languages}
          disabled={busy}
          onChange={(value) => {
            setTarget(value);
            clearResult();
          }}
        />
        <Field className="relative col-span-3 lg:col-span-1">
          <FieldLabel htmlFor="translation-input" className="sr-only">
            Text to translate
          </FieldLabel>
          <Textarea
            id="translation-input"
            placeholder="Bonjour, je voudrais réserver une table pour deux."
            className="min-h-36 flex-1 pb-8 text-base md:text-base lg:min-h-64"
            value={text}
            maxLength={maxLength}
            readOnly={busy}
            onChange={(event) => {
              setText(event.target.value);
              setDetected("");
              clearResult();
            }}
          />
          {text.length > maxLength * 0.8 && (
            <span className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground tabular-nums">
              {text.length.toLocaleString()} / {maxLength.toLocaleString()}
            </span>
          )}
        </Field>
        <ResultPanel
          label="Translation"
          className="col-span-3 min-h-28 bg-muted/30 lg:col-span-1 lg:col-start-3 lg:min-h-64"
          footer={
            result && (
              <>
                <CopyButton text={result} />
                <DownloadButton options={[textFile(result, "translation.txt")]} />
              </>
            )
          }
        >
          {result ? (
            <p
              className={`flex-1 p-4 text-base leading-relaxed whitespace-pre-wrap wrap-anywhere ${enter}`}
              dir="auto"
              lang={target}
            >
              {result}
            </p>
          ) : (
            <p className="flex-1 p-4 text-base text-muted-foreground">
              {pairUnavailable ? unsupported : "Translation"}
            </p>
          )}
        </ResultPanel>
      </div>
      <div className="space-y-3">
        <Button
          disabled={
            busy || !from || pairUnavailable || translator === "checking" || detector === "checking"
          }
          onClick={translate}
        >
          {busy && <Spinner />}
          Translate
        </Button>
        {fallback ? (
          info ? (
            <ModelNote
              model={info}
              cached={cached}
              device={worker.device}
              privacy="Text stays on this device."
            />
          ) : pairUnavailable ? null : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {!from
                ? "Choose the source language. This browser cannot detect it automatically."
                : "On-device translation with OPUS-MT supports English paired with French, German, Italian, or Spanish."}
            </p>
          )
        ) : (
          <ChromeNote
            status={translator}
            engine="Uses the translator built into Chrome."
            download="The first translation for a language pair downloads a language pack, which Chrome keeps for next time."
          />
        )}
      </div>
      <WorkStatus
        progress={worker.progress ?? (task.busy ? (task.progress ?? { label: "Starting…" }) : null)}
        onCancel={() => {
          task.cancel();
          worker.cancel();
        }}
      />
      <ToolError error={task.error ?? worker.error} />
    </div>
  );
}
