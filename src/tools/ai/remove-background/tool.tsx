import { useEffect, useState } from "react";
import { Eraser } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVision } from "../_vision/use-vision";
import {
  checkerboard,
  Compare,
  enter,
  ErrorNote,
  fit,
  ImageActions,
  ImageInput,
  ModelNote,
  outline,
  Range,
  Stage,
  useBlobUrl,
  WorkStatus,
  BusyIcon,
} from "../_vision/ui";
import type { Picked } from "../_vision/ui";
import { composite } from "../_vision/image";

const backgrounds = {
  transparent: "Transparent",
  white: "White",
  black: "Black",
  custom: "Color",
  blur: "Blurred original",
};
type Background = keyof typeof backgrounds;

export default function RemoveBackground() {
  const engine = useVision("background");
  const [picked, setPicked] = useState<Picked | null>(null),
    [mask, setMask] = useState<Blob | null>(null),
    [result, setResult] = useState<Blob | null>(null);
  const [background, setBackground] = useState<Background>("transparent"),
    [color, setColor] = useState("#ffffff"),
    [softness, setSoftness] = useState(0);
  const [rendering, setRendering] = useState(false),
    [renderError, setRenderError] = useState("");
  const file = picked?.file ?? null;
  const before = useBlobUrl(file),
    after = useBlobUrl(result);

  useEffect(() => {
    if (!file || !mask) return;
    let stale = false;
    void composite(file, mask, background, color, softness)
      .then((blob) => {
        if (!stale) setResult(blob);
      })
      .catch((error: unknown) => {
        if (!stale)
          setRenderError(
            error instanceof Error ? error.message : "The preview could not be drawn. Try again.",
          );
      })
      .finally(() => {
        if (!stale) setRendering(false);
      });
    return () => {
      stale = true;
    };
  }, [file, mask, background, color, softness]);

  async function remove() {
    if (!file) return;
    setRenderError("");
    try {
      const output = await engine.run({ image: file });
      if (!output.image) throw new Error("No mask");
      setRendering(true);
      setMask(output.image);
    } catch {
      /* WorkStatus reports the error. */
    }
  }
  // Each change redraws the preview; the last result stays visible meanwhile.
  function change(update: () => void) {
    setRendering(true);
    setRenderError("");
    update();
  }

  return (
    <div className="space-y-6">
      <ImageInput
        picked={picked}
        sampleFile="portrait.webp"
        disabled={engine.busy}
        onImage={(next) => {
          setPicked(next);
          setMask(null);
          setResult(null);
          setRenderError("");
          engine.setError("");
        }}
      />
      {!picked && <ModelNote engine={engine} className="text-center" />}
      {picked && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Stage>
            {after ? (
              <Compare before={before} after={after} />
            ) : (
              before && (
                <img
                  src={before}
                  alt="Original"
                  className={cn(fit, "rounded-md", outline)}
                  style={checkerboard}
                />
              )
            )}
          </Stage>
          <div className="space-y-5">
            {!mask ? (
              <>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={engine.busy}
                  onClick={() => void remove()}
                >
                  {engine.busy ? <BusyIcon /> : <Eraser aria-hidden="true" />}
                  Remove background
                </Button>
                <WorkStatus engine={engine} working="Removing background" />
                <ErrorNote message={engine.error} />
                <ModelNote engine={engine} />
              </>
            ) : (
              <div className={cn("space-y-5", enter)}>
                <Field>
                  <FieldLabel htmlFor="background-fill">Background</FieldLabel>
                  <Select
                    value={background}
                    items={backgrounds}
                    onValueChange={(value) => {
                      if (value && value !== background)
                        change(() => setBackground(value as Background));
                    }}
                  >
                    <SelectTrigger id="background-fill" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(backgrounds).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {background === "custom" && (
                    <Input
                      aria-label="Background color"
                      type="color"
                      value={color}
                      className="h-9 cursor-pointer p-1"
                      onChange={(event) => {
                        const next = event.target.value;
                        if (next !== color) change(() => setColor(next));
                      }}
                    />
                  )}
                </Field>
                <Range
                  label="Edge softness"
                  value={softness}
                  max={8}
                  step={0.5}
                  format={(value) => `${value} px`}
                  onChange={(value) => {
                    if (value !== softness) change(() => setSoftness(value));
                  }}
                />
                <ErrorNote message={renderError} />
                <ImageActions
                  blob={result}
                  filename={picked.file.name}
                  suffix="no-background"
                  disabled={rendering || !!renderError}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
