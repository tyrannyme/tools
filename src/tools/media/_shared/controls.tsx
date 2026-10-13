import { useId } from "react";
import type { ReactNode } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Rounds to hundredths so slider and duration values stay readable. */
export const round2 = (value: number) => Math.round(value * 100) / 100;

/** 75.5 -> "1:15". */
export function formatDuration(seconds: number) {
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

export function NumberField({
  label,
  value,
  onChange,
  unit,
  min = 0,
  max,
  step = 0.01,
  invalid,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          type="number"
          inputMode="decimal"
          className="tabular-nums"
          min={min}
          max={max}
          step={step}
          aria-invalid={invalid || undefined}
          value={Number.isNaN(value) ? "" : value}
          onChange={(event) =>
            onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))
          }
        />
        {unit && (
          <InputGroupAddon align="inline-end">
            <InputGroupText>{unit}</InputGroupText>
          </InputGroupAddon>
        )}
      </InputGroup>
    </Field>
  );
}

export function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
        items={options.map(([value, label]) => ({ value, label }))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** A small set of mutually exclusive options, all visible at once. */
export function Segmented({
  label,
  value,
  onChange,
  options,
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Value, label, and whether the option is unavailable. */
  options: [string, string, boolean?][];
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel id={id}>{label}</FieldLabel>
      <ToggleGroup
        aria-labelledby={id}
        variant="outline"
        spacing={0}
        className="w-full"
        value={[value]}
        onValueChange={(next: string[]) => {
          if (next[0]) onChange(next[0]);
        }}
      >
        {options.map(([key, name, disabled]) => (
          <ToggleGroupItem key={key} value={key} disabled={disabled} className="flex-1">
            {name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {description && <FieldDescription className="text-pretty!">{description}</FieldDescription>}
    </Field>
  );
}

function Waveform({
  peaks,
  start,
  end,
  duration,
}: {
  peaks: number[];
  start: number;
  end: number;
  duration: number;
}) {
  const step = 960 / peaks.length;
  const top = peaks.map((peak, i) => `${i * step + step / 2},${64 - Math.max(1, peak * 60)}`);
  const bottom = peaks
    .map((peak, i) => `${i * step + step / 2},${64 + Math.max(1, peak * 60)}`)
    .reverse();
  const path = `M0,64 L${top.join(" L")} L960,64 L${bottom.join(" L")} Z`;
  const from = Math.max(0, Math.min(100, (start / duration) * 100)) || 0;
  const to = Math.max(from, Math.min(100, (end / duration) * 100)) || 100;
  const shape = (className: string) => (
    <svg viewBox="0 0 960 128" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d={path} fill="currentColor" />
    </svg>
  );
  return (
    <div
      // A div with an image role exposes the stacked waveform layers as one graphic.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={`Waveform, ${round2(Math.max(0, end - start))} seconds selected`}
      className="relative h-28 overflow-hidden rounded-lg bg-muted/50"
    >
      <div
        className="absolute inset-y-0 bg-muted"
        style={{ left: `${from}%`, right: `${100 - to}%` }}
      />
      {shape("absolute inset-0 size-full text-muted-foreground/35")}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - to}% 0 ${from}%)` }}>
        {shape("size-full text-foreground")}
      </div>
    </div>
  );
}

export function Region({
  duration,
  start,
  end,
  onChange,
  peaks,
  waveform,
  disabled,
  invalid,
  children,
}: {
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  peaks?: number[];
  /** Shown in the waveform slot while the waveform is still being read. */
  waveform?: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
  /** Actions shown beside the selection length. */
  children?: ReactNode;
}) {
  const length = Number.isFinite(end - start) ? Math.max(0, end - start) : 0;
  return (
    <div className="space-y-4">
      {peaks ? <Waveform peaks={peaks} start={start} end={end} duration={duration} /> : waveform}
      <Slider
        aria-label="Selected time range"
        disabled={disabled}
        ref={(element) => {
          // The shared Slider does not expose its individual thumb props.
          element?.querySelectorAll('input[type="range"]').forEach((input, index) => {
            input.setAttribute("aria-label", index === 0 ? "Selection start" : "Selection end");
          });
        }}
        min={0}
        max={duration}
        step={0.01}
        value={[
          Number.isFinite(start) ? Math.max(0, Math.min(start, duration)) : 0,
          Number.isFinite(end) ? Math.max(0, Math.min(end, duration)) : duration,
        ]}
        onValueChange={(value) => {
          if (Array.isArray(value)) onChange(round2(value[0]!), round2(value[1]!));
        }}
      />
      <div className="grid grid-cols-2 gap-4">
        <NumberField
          label="Start"
          unit="s"
          value={start}
          max={duration}
          invalid={invalid}
          onChange={(value) => onChange(value, end)}
        />
        <NumberField
          label="End"
          unit="s"
          value={end}
          max={duration}
          invalid={invalid}
          onChange={(value) => onChange(start, value)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          <span className="font-medium text-foreground">{length.toFixed(2)} s</span> selected
        </p>
        {children}
      </div>
    </div>
  );
}
