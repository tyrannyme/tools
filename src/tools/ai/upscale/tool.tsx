import { useState } from "react";
import { Expand } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  Stage,
  useBlobUrl,
  WorkStatus,
  BusyIcon,
} from "../_vision/ui";
import type { Picked } from "../_vision/ui";

const fits = (picked: Picked, scale: number) => {
  const width = picked.width * scale,
    height = picked.height * scale;
  return width * height <= 32_000_000 && Math.max(width, height) <= 8192;
};

export default function Upscale() {
  const [scale, setScale] = useState<2 | 4>(2);
  const engine = useVision("upscale", scale);
  const [picked, setPicked] = useState<Picked | null>(null),
    [result, setResult] = useState<{ blob: Blob; scale: number } | null>(null),
    [actualSize, setActualSize] = useState(false);
  const before = useBlobUrl(picked?.file ?? null),
    after = useBlobUrl(result?.blob ?? null);
  const done = result?.scale === scale;

  async function upscale() {
    if (!picked) return;
    try {
      const output = await engine.run({ image: picked.file });
      if (output.image) setResult({ blob: output.image, scale });
    } catch {
      /* WorkStatus reports the error. */
    }
  }

  return (
    <div className="space-y-6">
      <ImageInput
        picked={picked}
        disabled={engine.busy}
        onImage={(next) => {
          setPicked(next);
          setResult(null);
          engine.setError("");
          if (!fits(next, scale)) setScale(2);
        }}
      />
      {!picked && <ModelNote engine={engine} className="text-center" />}
      {picked && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-3">
            <Stage>
              {after ? (
                <Compare before={before} after={after} actualSize={actualSize} />
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
            {after && (
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                aria-label="Preview size"
                value={[actualSize ? "actual" : "fit"]}
                onValueChange={(next: string[]) => {
                  if (next[0]) setActualSize(next[0] === "actual");
                }}
                className={cn("mx-auto", enter)}
              >
                <ToggleGroupItem value="fit">Fit</ToggleGroupItem>
                <ToggleGroupItem value="actual">Actual pixels</ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
          <div className="space-y-5">
            <Field>
              <FieldLabel id="upscale-scale">Scale</FieldLabel>
              <ToggleGroup
                variant="outline"
                spacing={0}
                aria-labelledby="upscale-scale"
                value={[String(scale)]}
                disabled={engine.busy}
                onValueChange={(next: string[]) => {
                  if (next[0]) setScale(Number(next[0]) as 2 | 4);
                }}
                className="w-full"
              >
                {([2, 4] as const).map((value) => (
                  <ToggleGroupItem
                    key={value}
                    value={String(value)}
                    disabled={!fits(picked, value)}
                    className="flex-1"
                  >
                    {value}×
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription className="tabular-nums">
                {fits(picked, scale)
                  ? `${picked.width * scale} × ${picked.height * scale} px`
                  : "Too large. The result can be at most 8192 px per side."}
              </FieldDescription>
            </Field>
            {!done && (
              <Button
                size="lg"
                className="w-full"
                disabled={engine.busy || !fits(picked, scale)}
                onClick={() => void upscale()}
              >
                {engine.busy ? <BusyIcon /> : <Expand aria-hidden="true" />}
                Upscale {scale}×
              </Button>
            )}
            <WorkStatus engine={engine} working={`Upscaling ${scale}×`} />
            <ErrorNote message={engine.error} />
            {done && (
              <div className={enter}>
                <ImageActions
                  blob={result.blob}
                  filename={picked.file.name}
                  suffix={`${scale}x`}
                  disabled={engine.busy}
                />
              </div>
            )}
            <ModelNote engine={engine} />
          </div>
        </div>
      )}
    </div>
  );
}
