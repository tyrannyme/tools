import { ArrowLeftRight, Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CopyButton, ErrorMessage } from "../_shared/ui";
import { apca, formats, hex, parseColor, wcag } from "./conversion";
import type { RGB } from "./conversion";

/** Parses a color and keeps the last valid one while the input is mid-edit. */
function useColor(input: string) {
  const parsed = useMemo(() => {
    try {
      return { color: parseColor(input), error: "" };
    } catch (cause) {
      return {
        color: null,
        error: cause instanceof Error ? cause.message : "Enter a color such as #262626.",
      };
    }
  }, [input]);
  const [last, setLast] = useState(parsed.color);
  if (parsed.color && parsed.color !== last) setLast(parsed.color);
  return { color: parsed.color ?? last, error: parsed.error };
}

function Verdict({ pass }: { pass: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium",
        pass ? "text-foreground" : "text-destructive",
      )}
    >
      {pass ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <X className="size-4" aria-hidden="true" />
      )}
      {pass ? "Pass" : "Fail"}
    </span>
  );
}

function Conversions({ title, rgb }: { title: string; rgb: RGB }) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span
          className="size-5 shrink-0 rounded-md outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
          style={{ backgroundColor: hex(rgb) }}
          aria-hidden="true"
        />
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      <dl className="divide-y">
        {Object.entries(formats(rgb)).map(([format, value]) => (
          <div key={format} className="flex items-center gap-3 px-4 py-2.5">
            <dt className="w-14 shrink-0 text-sm text-muted-foreground">{format}</dt>
            <dd className="min-w-0 flex-1 font-mono text-sm break-all">{value}</dd>
            <CopyButton name={`${title.toLowerCase()} ${format}`} text={value} />
          </div>
        ))}
      </dl>
    </Card>
  );
}

export default function ColorTool() {
  const [foreground, setForeground] = useState("#262626");
  const [background, setBackground] = useState("#fafafa");
  const text = useColor(foreground);
  const surface = useColor(background);
  const fields = [
    { id: "color-text", label: "Text", value: foreground, set: setForeground, ...text },
    {
      id: "color-background",
      label: "Background",
      value: background,
      set: setBackground,
      ...surface,
    },
  ];
  const fg = text.color;
  const bg = surface.color;
  const ready = fg && bg;
  const ratio = ready ? wcag(fg.rgb, bg.rgb) : 0;
  const lc = ready ? apca(fg.rgb, bg.rgb) : 0;
  const stale = !!(text.error || surface.error);

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {fields.map(({ id, label, value, set, color, error }, index) => (
          <Field
            key={id}
            data-invalid={!!error || undefined}
            className={index === 1 ? "sm:col-start-3" : undefined}
          >
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <div className="flex gap-2">
              <Input
                type="color"
                aria-label={`${label} color picker`}
                className="w-10 shrink-0 cursor-pointer p-1"
                value={color ? hex(color.rgb) : "#000000"}
                onChange={(event) => set(event.target.value)}
              />
              <Input
                id={id}
                value={value}
                spellCheck={false}
                autoComplete="off"
                className="font-mono"
                aria-invalid={!!error || undefined}
                aria-describedby={`${id}-hint`}
                onChange={(event) => set(event.target.value)}
              />
            </div>
            <div id={`${id}-hint`} aria-live="polite" className="min-h-5">
              {error ? (
                <ErrorMessage>{error}</ErrorMessage>
              ) : (
                <FieldDescription>Hex, rgb(), hsl(), oklch(), or oklab()</FieldDescription>
              )}
            </div>
          </Field>
        ))}
        <Button
          variant="outline"
          size="icon"
          aria-label="Swap text and background"
          title="Swap text and background"
          className="row-start-1 hidden sm:col-start-2 sm:mt-7 sm:inline-flex"
          onClick={() => {
            setForeground(background);
            setBackground(foreground);
          }}
        >
          <ArrowLeftRight aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          className="justify-self-start sm:hidden"
          onClick={() => {
            setForeground(background);
            setBackground(foreground);
          }}
        >
          <ArrowLeftRight aria-hidden="true" />
          Swap colors
        </Button>
      </div>

      {ready && (
        <div className={cn("space-y-6 transition-opacity", stale && "opacity-50")}>
          <div
            className="rounded-xl p-6 outline-1 -outline-offset-1 outline-black/10 transition-colors sm:p-10 dark:outline-white/10"
            style={{ color: hex(fg.rgb), backgroundColor: hex(bg.rgb) }}
          >
            <p className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Make every word clear.
            </p>
            <p className="mt-5 max-w-lg text-base leading-relaxed">
              Good contrast gives words room to be read. This paragraph shows regular 16 px text in
              your colors.
            </p>
          </div>
          {(fg.clipped || bg.clipped) && (
            <p className="text-sm text-muted-foreground">
              A color outside sRGB was clipped to the nearest sRGB color. Conversions and contrast
              use the clipped color.
            </p>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-sm text-muted-foreground">WCAG 2 contrast</h2>
                  <p className="text-3xl font-semibold tabular-nums">{ratio.toFixed(2)}:1</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2 font-normal">Text size</th>
                      <th className="pb-2 font-normal">AA</th>
                      <th className="pb-2 font-normal">AAA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-t">
                    <tr>
                      <th scope="row" className="py-2 text-left font-normal">
                        Regular
                      </th>
                      <td className="py-2">
                        <Verdict pass={ratio >= 4.5} />
                      </td>
                      <td className="py-2">
                        <Verdict pass={ratio >= 7} />
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="py-2 text-left font-normal">
                        Large
                      </th>
                      <td className="py-2">
                        <Verdict pass={ratio >= 3} />
                      </td>
                      <td className="py-2">
                        <Verdict pass={ratio >= 4.5} />
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground">
                  Large means at least 24 px, or 18.67 px bold.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-sm text-muted-foreground">APCA contrast</h2>
                  <p className="text-3xl font-semibold tabular-nums">
                    {lc.toFixed(1)}{" "}
                    <span className="text-base font-normal text-muted-foreground">Lc</span>
                  </p>
                </div>
                <p className="text-sm">
                  {lc < 0
                    ? "Light text on a darker background"
                    : lc > 0
                      ? "Dark text on a lighter background"
                      : "No perceptible contrast"}
                </p>
                <p className="text-xs text-muted-foreground">
                  APCA 0.0.98G is a draft for WCAG 3. Body text generally needs Lc 75 or more,
                  larger text less. It is not a WCAG 2 pass or fail.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Conversions title="Text" rgb={fg.rgb} />
            <Conversions title="Background" rgb={bg.rgb} />
          </div>
          <p className="text-xs text-muted-foreground">
            Sources:{" "}
            <a
              className="underline underline-offset-2"
              href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
              target="_blank"
              rel="noreferrer"
            >
              WCAG contrast minimum
            </a>
            ,{" "}
            <a
              className="underline underline-offset-2"
              href="https://github.com/Myndex/apca-w3"
              target="_blank"
              rel="noreferrer"
            >
              APCA by Andrew Somers
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
