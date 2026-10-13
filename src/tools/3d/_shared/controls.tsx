import { CircleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { downloadBlob, formatBytes } from "@/lib/files";

/** Entrance for results: a short fade, plus a small rise when motion is allowed. */
export const enter =
  "animate-in fade-in-0 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:slide-in-from-bottom-1";

/** Saves the file and confirms it with a toast. */
export function saveFile(blob: Blob, filename: string, detail?: string) {
  downloadBlob(blob, filename);
  toast.success(`Downloaded ${filename}`, {
    description: [detail, formatBytes(blob.size)].filter(Boolean).join(" · "),
  });
}

export function Check({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description?: ReactNode;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <Field orientation="horizontal" data-disabled={disabled}>
      <Checkbox id={id} checked={value} disabled={disabled} onCheckedChange={onChange} />
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
    </Field>
  );
}

export function Choice({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <Field data-disabled={disabled}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
        items={options}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** A slider with its current value shown beside the label. */
export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  format = String,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <Field data-disabled={disabled}>
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel id={id}>{label}</FieldLabel>
        <span className="text-sm text-muted-foreground tabular-nums">{format(value)}</span>
      </div>
      <Slider
        aria-labelledby={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0]! : next)}
        className="py-1.5"
      />
    </Field>
  );
}

/** Inline status for real pending work. */
export function Pending({ children }: { children: ReactNode }) {
  return (
    <output className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner aria-hidden="true" />
      {children}
    </output>
  );
}

export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <Alert variant="destructive" className={enter}>
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;
}
