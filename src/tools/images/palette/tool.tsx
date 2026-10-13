import { Braces, Copy, Download } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { renameExtension } from "@/lib/files";
import {
  ButtonSpinner,
  ErrorMessage,
  ImageDrop,
  SliderField,
  copyText,
  enter,
  imageOutline,
  save,
  useImage,
} from "../_shared/controls";
import { encode, message } from "../_shared/image";
import { drawPaletteCard } from "./card";
import { extractColors } from "./colors";
import type { Color } from "./colors";

const percent = (share: number) => `${Math.max(1, Math.round(share * 100))}%`;

export default function PaletteTool() {
  const { source, open, url, error, setError, busy: opening } = useImage();
  const [count, setCount] = useState(6);
  const [colors, setColors] = useState<Color[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const run = useRef(0);

  async function extract(image: HTMLImageElement, size: number) {
    const current = ++run.current;
    setExtracting(true);
    setError("");
    try {
      const next = await extractColors(image, size);
      if (current === run.current) setColors(next);
    } catch (error) {
      if (current === run.current) {
        setColors([]);
        setError(message(error));
      }
    } finally {
      if (current === run.current) setExtracting(false);
    }
  }
  async function downloadCard() {
    if (!source) return;
    setDrawing(true);
    try {
      const canvas = await drawPaletteCard(source.image, colors);
      save(await encode(canvas, "png", 1), renameExtension(source.file.name, "palette.png"));
    } catch (error) {
      setError(message(error));
    } finally {
      setDrawing(false);
    }
  }
  const css = `:root {\n${colors.map((color, i) => `  --palette-${i + 1}: ${color.hex};`).join("\n")}\n}\n`;

  return (
    <div className="space-y-6">
      <ImageDrop
        disabled={opening}
        onError={setError}
        current={
          source && {
            title: source.file.name,
            detail: `${source.image.naturalWidth} × ${source.image.naturalHeight} px`,
          }
        }
        onFiles={(files) => {
          void open(files).then((next) => {
            if (next) void extract(next.image, count);
          });
        }}
      />
      <ErrorMessage error={error} />
      {source && (
        <div className={cn("grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]", enter)}>
          <Card className="gap-0 py-0">
            <div className="flex aspect-[4/3] min-h-0 items-center justify-center overflow-hidden bg-muted/50 p-4 sm:p-6">
              <img
                src={url || undefined}
                alt={source.file.name}
                className={cn("max-h-full max-w-full rounded-md object-contain", imageOutline)}
              />
            </div>
            <div className="flex h-12 border-t" aria-hidden="true">
              {colors.map((color, index) => (
                <div
                  key={index}
                  className="min-w-0 transition-[flex-grow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                  style={{ backgroundColor: color.hex, flexGrow: color.share }}
                />
              ))}
            </div>
          </Card>
          <Card className="gap-4 px-4">
            <SliderField
              label="Colors"
              min={2}
              max={12}
              value={count}
              onChange={setCount}
              onCommit={(value) => void extract(source.image, value)}
            />
            <ul
              aria-busy={extracting}
              className={cn(
                "-mx-2 space-y-0.5 transition-opacity duration-150",
                extracting && "opacity-60",
              )}
            >
              {colors.map((color, index) => (
                <li
                  key={index}
                  className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2"
                >
                  <button
                    type="button"
                    aria-label={`Copy ${color.hex}`}
                    title={`Copy ${color.hex}`}
                    className={cn(
                      "size-11 rounded-md transition-transform duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.96]",
                      imageOutline,
                    )}
                    style={{ backgroundColor: color.hex }}
                    onClick={() => void copyText(color.hex, `Copied ${color.hex}`)}
                  />
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="block font-mono text-sm font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                      title="Copy HEX"
                      onClick={() => void copyText(color.hex, `Copied ${color.hex}`)}
                    >
                      {color.hex}
                    </button>
                    <div className="flex min-w-0 flex-col items-start font-mono text-xs text-muted-foreground">
                      <button
                        type="button"
                        className="max-w-full truncate hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
                        title={`Copy ${color.rgb}`}
                        onClick={() => void copyText(color.rgb, `Copied ${color.rgb}`)}
                      >
                        {color.rgb}
                      </button>
                      <button
                        type="button"
                        className="max-w-full truncate hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
                        title={`Copy ${color.oklch}`}
                        onClick={() => void copyText(color.oklch, `Copied ${color.oklch}`)}
                      >
                        {color.oklch}
                      </button>
                    </div>
                  </div>
                  <span
                    className="text-sm text-muted-foreground tabular-nums"
                    title="Share of the image"
                  >
                    {percent(color.share)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2 border-t pt-4">
              <Button
                className="col-span-2"
                disabled={!colors.length || drawing}
                onClick={() => void downloadCard()}
              >
                {drawing ? <ButtonSpinner /> : <Download aria-hidden="true" />}
                Download palette card
              </Button>
              <Button
                variant="outline"
                disabled={!colors.length}
                onClick={() => void copyText(css, "Copied CSS variables")}
              >
                <Copy aria-hidden="true" />
                Copy CSS
              </Button>
              <Button
                variant="outline"
                disabled={!colors.length}
                onClick={() =>
                  save(
                    new Blob(
                      [
                        JSON.stringify(
                          colors.map(({ hex, rgb, oklch, share }) => ({
                            hex,
                            rgb,
                            oklch,
                            share: Math.round(share * 1000) / 1000,
                          })),
                          null,
                          2,
                        ) + "\n",
                      ],
                      { type: "application/json" },
                    ),
                    renameExtension(source.file.name, "palette.json"),
                  )
                }
              >
                <Braces aria-hidden="true" />
                Download JSON
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
