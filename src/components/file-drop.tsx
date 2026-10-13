import { Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "cn";

interface FileDropProps {
  /** Called with the dropped, chosen, or pasted files. */
  onFiles: (files: File[]) => void;
  /** Same format as the input `accept` attribute, such as "image/*" or ".glb,.gltf". */
  accept?: string;
  multiple?: boolean;
  /** Also accept files pasted from the clipboard anywhere on the page. */
  paste?: boolean;
  icon?: LucideIcon;
  /** Main line, such as "Drop images here". */
  title: string;
  /** Second line, such as "PNG, JPEG, or WebP". */
  hint?: string;
  /** Extra controls under the hint, such as a "Try a sample" button. */
  children?: ReactNode;
  /** A single row instead of a large panel, for use next to other inputs or once a file is loaded. */
  compact?: boolean;
  className?: string;
}

/** The standard place to drop, choose, or paste files. Nothing is uploaded. */
export function FileDrop({
  onFiles,
  accept,
  multiple,
  paste,
  icon: Icon = Upload,
  title,
  hint,
  children,
  compact,
  className,
}: FileDropProps) {
  const id = useId();
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!paste) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length) onFiles(multiple ? files : files.slice(0, 1));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [paste, multiple, onFiles]);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        "relative flex rounded-xl border border-dashed bg-muted/30 transition-colors has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
        compact
          ? "flex-row items-center gap-3 px-4 py-3 text-left"
          : "flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        dragging && "border-gold bg-gold/5",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold",
          compact ? "size-9" : "size-12",
        )}
      >
        <Icon className={compact ? "size-4" : "size-6"} aria-hidden="true" />
      </div>
      <div className={cn("space-y-1", compact && "min-w-0 flex-1 space-y-0.5")}>
        <label htmlFor={id} className="cursor-pointer font-medium after:absolute after:inset-0">
          {title}
        </label>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = "";
        }}
      />
      {children && (
        <div className={cn("relative z-10 flex flex-wrap gap-2", !compact && "justify-center")}>
          {children}
        </div>
      )}
    </div>
  );
}
