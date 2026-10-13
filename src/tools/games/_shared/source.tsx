import { useRef, useState } from "react";
import { cn } from "cn";
import { FileDrop } from "@/components/file-drop";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ErrorMessage } from "./controls";
import { checkerboard } from "./images";
import type { LocalImage } from "./images";

/**
 * Drop zone until an image is loaded, then a compact row with a thumbnail and a
 * way to swap or remove it, so the result gets the space.
 */
export function ImagePicker({
  source,
  loading,
  error,
  onFile,
  onRemove,
  title,
  hint,
  accept = "image/png,image/webp,image/gif,image/bmp,image/jpeg",
  className,
}: {
  source: LocalImage | null;
  loading: boolean;
  error: string;
  onFile: (file: File) => void;
  onRemove?: () => void;
  title: string;
  hint: string;
  accept?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  if (!source)
    return (
      <div className={cn("space-y-3", className)}>
        <FileDrop
          title={loading ? "Opening image…" : title}
          hint={hint}
          accept={accept}
          onFiles={(files) => files[0] && onFile(files[0])}
        />
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    );
  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        className={cn(
          "flex items-center gap-3 rounded-xl border bg-card p-2 pr-3 transition-colors",
          dragging && "border-gold bg-gold/5",
        )}
      >
        <img
          src={source.url}
          alt=""
          className="size-12 shrink-0 rounded-lg object-contain outline outline-1 -outline-offset-1 outline-black/10 [image-rendering:pixelated] dark:outline-white/10"
          style={checkerboard}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={source.name}>
            {source.name}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {source.image.width} × {source.image.height} px
          </p>
        </div>
        {loading && <Spinner className="text-muted-foreground" />}
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => input.current?.click()}
        >
          Replace
        </Button>
        {onRemove && (
          <Button variant="ghost" size="sm" disabled={loading} onClick={onRemove}>
            Remove
          </Button>
        )}
        <input
          ref={input}
          type="file"
          accept={accept}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = "";
          }}
        />
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </div>
  );
}
