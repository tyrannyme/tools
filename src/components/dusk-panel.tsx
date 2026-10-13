import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { startGildedDusk } from "@/components/gilded-dusk";

/** A panel with the gilded dusk shader behind its content, over a matching CSS gradient. */
export function DuskPanel({ children, className }: { children?: ReactNode; className?: string }) {
  const area = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!area.current || !canvas.current) return;
    return startGildedDusk(canvas.current, area.current);
  }, []);

  return (
    <div ref={area} className={cn("relative overflow-hidden bg-dusk text-white", className)}>
      <canvas
        ref={canvas}
        aria-hidden="true"
        className="absolute inset-0 size-full opacity-0 transition-opacity duration-700 data-ready:opacity-100"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
