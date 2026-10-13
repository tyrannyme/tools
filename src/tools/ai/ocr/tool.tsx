import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, ScanText } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { downloadBlob, renameExtension } from "@/lib/files";
import { useVision } from "../_vision/use-vision";
import {
  enter,
  ErrorNote,
  fit,
  ImageInput,
  ModelNote,
  outline,
  Stage,
  useBlobUrl,
  WorkStatus,
  BusyIcon,
} from "../_vision/ui";
import type { Picked } from "../_vision/ui";
import { canvas2d, toBlob } from "../_vision/image";
import type { VisionResult } from "../_vision/types";

const sampleLines = [
  ["600 44px", "Tools by Tyranny"],
  ["400 30px", "Free tools that run in your browser."],
  ["400 30px", "Your files are never uploaded. AI models"],
  ["400 30px", "download once, then work offline."],
  ["500 28px", "tools.tyranny.me"],
] as const;

/** A printed-text sample, drawn here since the shared sample art has no text in it. */
async function textSample() {
  const { canvas, context } = canvas2d(880, 420);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#171717";
  context.textBaseline = "top";
  let y = 56;
  for (const [weight, line] of sampleLines) {
    context.font = `${weight} system-ui, sans-serif`;
    context.fillText(line, 64, y);
    y += weight.startsWith("600") ? 84 : 56;
  }
  return new File([await toBlob(canvas)], "tyranny-text.png", { type: "image/png" });
}

export default function Ocr() {
  const engine = useVision("ocr");
  const [picked, setPicked] = useState<Picked | null>(null),
    [result, setResult] = useState<VisionResult | null>(null),
    [text, setText] = useState(""),
    [sampling, setSampling] = useState(false);
  const before = useBlobUrl(picked?.file ?? null);
  const streamed =
    engine.status?.phase.phase === "run" ? (engine.status.phase.text ?? "") : undefined;

  async function read() {
    if (!picked) return;
    setResult(null);
    setText("");
    try {
      const output = await engine.run({ image: picked.file });
      setResult(output);
      setText(output.text ?? "");
    } catch {
      /* WorkStatus reports the error. */
    }
  }
  function open(next: Picked) {
    setPicked(next);
    setResult(null);
    setText("");
    engine.setError("");
  }

  return (
    <div className="space-y-6">
      <ImageInput
        picked={picked}
        disabled={engine.busy}
        onImage={open}
        sample={
          <Button
            variant="outline"
            size="sm"
            disabled={sampling}
            onClick={async () => {
              setSampling(true);
              try {
                const file = await textSample();
                open({ file, width: 880, height: 420 });
              } finally {
                setSampling(false);
              }
            }}
          >
            {sampling && <BusyIcon />}
            Try a sample
          </Button>
        }
      />
      {!picked && <ModelNote engine={engine} className="text-center" />}
      {picked && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Stage>
            <div className={cn("relative overflow-hidden rounded-md", outline)}>
              {before && <img src={before} alt="Original" className={fit} />}
              {result?.regions && (
                <svg
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-0 size-full mix-blend-difference",
                    enter,
                  )}
                  viewBox={`0 0 ${result.width} ${result.height}`}
                  preserveAspectRatio="none"
                >
                  {result.regions.map((region, i) => (
                    <polygon
                      key={i}
                      points={region.box.join(" ")}
                      fill="white"
                      fillOpacity={0.14}
                      stroke="white"
                      strokeOpacity={0.5}
                      strokeWidth={1}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
              )}
            </div>
          </Stage>
          <div className="min-w-0 space-y-5">
            {!result && (
              <Button
                size="lg"
                className="w-full"
                disabled={engine.busy}
                onClick={() => void read()}
              >
                {engine.busy ? <BusyIcon /> : <ScanText aria-hidden="true" />}
                Read text
              </Button>
            )}
            <WorkStatus engine={engine} working="Reading" estimate={false} />
            <ErrorNote message={engine.error} />
            {(result || streamed) && (
              <Field className={enter}>
                <FieldLabel htmlFor="ocr-text">Text</FieldLabel>
                <Textarea
                  id="ocr-text"
                  value={streamed ?? text}
                  readOnly={streamed !== undefined}
                  onChange={(event) => setText(event.target.value)}
                  className="min-h-56 leading-relaxed"
                  aria-describedby="ocr-text-note"
                />
                <FieldDescription id="ocr-text-note">
                  {result && !result.text
                    ? "No text found. Try a sharper image, or crop closer to the text."
                    : "Check names and numbers before you rely on them. You can edit the text here."}
                </FieldDescription>
              </Field>
            )}
            {result && !!text && (
              <div className={cn("flex gap-2", enter)}>
                <Button
                  className="flex-1"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(text);
                      toast.success("Text copied");
                    } catch {
                      toast.error("Your browser blocked copying. Select the text and copy it.");
                    }
                  }}
                >
                  <Copy aria-hidden="true" />
                  Copy text
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const name = renameExtension(picked.file.name, "txt");
                    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), name);
                    toast.success(`Saved ${name}`);
                  }}
                >
                  <Download aria-hidden="true" />
                  Download .txt
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              {!result && (
                <p className="text-xs text-muted-foreground">
                  Works best on clear, printed English text.
                </p>
              )}
              <ModelNote engine={engine} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
