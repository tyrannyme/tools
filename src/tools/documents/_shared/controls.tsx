import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadBlob, formatBytes } from "@/lib/files";

export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={options}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
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

/** 1 -> "1 page", 3 -> "3 pages". */
export function count(value: number, one: string, many = `${one}s`) {
  return `${value.toLocaleString("en")} ${value === 1 ? one : many}`;
}

/** Saves the file and confirms it with a toast. */
export function saveFile(blob: Blob, filename: string, detail?: string) {
  downloadBlob(blob, filename);
  toast.success(`Downloaded ${filename}`, {
    description: [detail, formatBytes(blob.size)].filter(Boolean).join(" · "),
  });
}

/** Shared entrance for results and list rows: a short fade, plus a small rise when motion is allowed. */
export const enter =
  "animate-in fade-in-0 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:slide-in-from-bottom-1";

export function moveItem<T>(items: T[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function OrderedFiles<T extends { id: string; name: string }>({
  items,
  onMove,
  onRemove,
  children,
  disabled = false,
}: {
  items: T[];
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  children: (item: T, index: number) => ReactNode;
  disabled?: boolean;
}) {
  const [dragged, setDragged] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const list = useId();

  // Keep keyboard focus on the moved row when its arrow becomes disabled at either end.
  function move(from: number, to: number, id: string) {
    onMove(from, to);
    const edge = to === 0 ? "down" : to === items.length - 1 ? "up" : null;
    if (edge)
      requestAnimationFrame(() =>
        document.getElementById(`${list}-${id}-${edge}`)?.focus({ preventScroll: true }),
      );
  }

  function remove(index: number, id: string) {
    onRemove(id);
    const next = items[index + 1] ?? items[index - 1];
    if (next)
      requestAnimationFrame(() =>
        document.getElementById(`${list}-${next.id}-remove`)?.focus({ preventScroll: true }),
      );
  }

  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        // Arrow buttons provide the keyboard equivalent of dragging each list item.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <li
          key={item.id}
          draggable={!disabled}
          onDragStart={(event) => {
            setDragged(index);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", item.id);
          }}
          onDragEnd={() => {
            setDragged(null);
            setOver(null);
          }}
          onDragOver={(event) => {
            if (dragged === null) return;
            event.preventDefault();
            if (over !== index) setOver(index);
          }}
          onDrop={(event) => {
            if (dragged === null || disabled) return;
            event.preventDefault();
            onMove(dragged, index);
            setDragged(null);
            setOver(null);
          }}
          className={cn(
            "flex items-center gap-3 rounded-xl border bg-card p-3 transition-[opacity,box-shadow] duration-150",
            enter,
            dragged === index && "opacity-50",
            over === index && dragged !== null && dragged !== index && "ring-2 ring-ring/50",
          )}
        >
          <GripVertical
            className={cn(
              "size-4 shrink-0 text-muted-foreground",
              disabled ? "opacity-50" : "cursor-grab",
            )}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">{children(item, index)}</div>
          <div className="flex shrink-0 items-center">
            <Button
              id={`${list}-${item.id}-up`}
              variant="ghost"
              size="icon"
              disabled={disabled || index === 0}
              aria-label={`Move ${item.name} up`}
              onClick={() => move(index, index - 1, item.id)}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              id={`${list}-${item.id}-down`}
              variant="ghost"
              size="icon"
              disabled={disabled || index === items.length - 1}
              aria-label={`Move ${item.name} down`}
              onClick={() => move(index, index + 1, item.id)}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button
              id={`${list}-${item.id}-remove`}
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={`Remove ${item.name}`}
              onClick={() => remove(index, item.id)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}
