import { Check, Copy } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface Option {
  value: string;
  label: string;
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
  options: Option[];
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        onValueChange={(next) => next !== null && onChange(next)}
        items={options}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** Two or three short, mutually exclusive options shown side by side. */
export function Segmented({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  const id = useId();
  return (
    <Field>
      <FieldTitle id={id}>{label}</FieldTitle>
      <ToggleGroup
        aria-labelledby={id}
        variant="outline"
        spacing={0}
        className="w-full"
        value={[value]}
        onValueChange={(next: string[]) => next[0] && onChange(next[0])}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} className="flex-1">
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

/**
 * A whole-number input. Typing is free; a value is committed once it is in range,
 * and leaving the field clamps whatever is left.
 */
export function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 4096,
  inline = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Label beside a narrow input, for toolbars. */
  inline?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);
  const clamp = (number: number) => Math.min(max, Math.max(min, Math.trunc(number)));
  return (
    <Field orientation={inline ? "horizontal" : "vertical"} className={inline ? "w-auto" : ""}>
      <FieldLabel htmlFor={id} className={inline ? "font-normal text-muted-foreground" : ""}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={draft}
        onFocus={() => (focused.current = true)}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          const number = Number(raw);
          if (raw !== "" && Number.isInteger(number) && number >= min && number <= max)
            onChange(number);
        }}
        onBlur={() => {
          focused.current = false;
          const number = Number(draft);
          const next = draft !== "" && Number.isFinite(number) ? clamp(number) : value;
          setDraft(String(next));
          if (next !== value) onChange(next);
        }}
        className={inline ? "w-16 tabular-nums" : "tabular-nums"}
      />
    </Field>
  );
}

export function ErrorMessage({ id, children }: { id?: string; children: string }) {
  return children ? (
    <p id={id} role="alert" className="text-sm text-destructive">
      {children}
    </p>
  ) : null;
}

export function CopyButton({
  value,
  label = "Copy",
  variant = "outline",
  size = "default",
}: {
  value: string;
  label?: string;
  variant?: "outline" | "ghost";
  size?: "default" | "sm";
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Button
      variant={variant}
      size={size}
      disabled={!value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied");
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Your browser blocked the clipboard. Select the text and copy it manually.");
        }
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
