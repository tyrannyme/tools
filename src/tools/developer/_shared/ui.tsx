import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, CircleAlert, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { downloadBlob } from "@/lib/files";

/** Entrance for a result that appears. Reduced motion keeps only the fade. */
export const enter =
  "animate-in fade-in-0 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:slide-in-from-bottom-1";

interface Option {
  value: string;
  label: ReactNode;
}

export function Choice({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        items={options}
        disabled={disabled}
        onValueChange={(next) => next !== null && onChange(next)}
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

/** A labelled row of mutually exclusive options. */
export function Segmented({
  label,
  value,
  options,
  onChange,
  disabled,
  hideLabel,
  className,
}: {
  label: string;
  value: string;
  options: Option[];
  hideLabel?: boolean;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <FieldSet className={cn("w-auto gap-0", className)}>
      <FieldLegend variant="label" className={hideLabel ? "sr-only" : "mb-2"}>
        {label}
      </FieldLegend>
      <ToggleGroup
        variant="outline"
        spacing={0}
        value={[value]}
        disabled={disabled}
        onValueChange={(next: string[]) => next[0] && onChange(next[0])}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} className="px-3">
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </FieldSet>
  );
}

/** Inline error with an icon, so the state never depends on color alone. */
export function ErrorMessage({ children, className }: { children: ReactNode; className?: string }) {
  return children ? (
    <p className={cn("flex items-start gap-2 text-sm text-destructive", className)}>
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  ) : null;
}

/** Copies text, confirms with a toast, and reports a blocked clipboard. */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy(text: string, message = "Copied") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Unable to copy. Select the text and copy it manually.");
    }
  }
  return { copied, copy };
}

const swap =
  "absolute inset-0 size-4 transition-[opacity,scale,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)]";
const hidden = "scale-25 opacity-0 blur-[4px] motion-reduce:scale-100 motion-reduce:blur-none";

function CopyIcon({ copied }: { copied: boolean }) {
  return (
    <span className="relative size-4 shrink-0" aria-hidden="true">
      <Copy className={cn(swap, copied && hidden)} />
      <Check className={cn(swap, !copied && hidden)} />
    </span>
  );
}

/**
 * Copy button. With `name`, it renders as a compact icon button whose accessible
 * name is "Copy <name>".
 */
export function CopyButton({
  text,
  name,
  message,
  label = "Copy",
  variant = "outline",
  disabled,
  className,
}: {
  text: string;
  name?: string;
  message?: string;
  label?: string;
  variant?: "outline" | "ghost" | "default";
  disabled?: boolean;
  className?: string;
}) {
  const { copied, copy } = useCopy();
  const onClick = () => void copy(text, message ?? (name ? `Copied ${name}` : "Copied"));
  if (name)
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Copy ${name}`}
        title={`Copy ${name}`}
        disabled={disabled}
        onClick={onClick}
        className={className}
      >
        <CopyIcon copied={copied} />
      </Button>
    );
  return (
    <Button variant={variant} disabled={disabled} onClick={onClick} className={className}>
      <CopyIcon copied={copied} />
      {label}
    </Button>
  );
}

export function DownloadButton({
  blob,
  filename,
  label = "Download",
  disabled,
}: {
  blob: () => Blob;
  filename: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      disabled={disabled}
      onClick={() => {
        downloadBlob(blob(), filename);
        toast.success(`Saved ${filename}`);
      }}
    >
      <Download aria-hidden="true" />
      {label}
    </Button>
  );
}

/** Copy and download for a text result. */
export function OutputActions({
  text,
  filename,
  mime = "text/plain",
  disabled,
}: {
  text: string;
  filename?: string;
  mime?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <CopyButton text={text} disabled={disabled || !text} />
      {filename && (
        <DownloadButton
          blob={() => new Blob([text], { type: mime })}
          filename={filename}
          disabled={disabled || !text}
        />
      )}
    </div>
  );
}
