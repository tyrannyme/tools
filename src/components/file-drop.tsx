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
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center transition-colors",
        dragging && "border-gold bg-gold/5",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-gold/10 text-gold">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
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
        <div className="relative z-10 flex flex-wrap justify-center gap-2">{children}</div>
      )}
    </div>
  );
}
