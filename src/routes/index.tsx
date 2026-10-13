import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ImageIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { startGildedDusk } from "@/components/gilded-dusk";
import { OrnateFrame } from "@/components/ornament";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/")({ component: ToolsPage });

function ToolsPage() {
  const area = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!area.current || !canvas.current) return;
    return startGildedDusk(canvas.current, area.current);
  }, []);

  return (
    <div className="space-y-10">
      <OrnateFrame>
        <div
          ref={area}
          className="relative overflow-hidden rounded-xl bg-dusk px-8 py-14 text-white sm:py-20"
        >
          <canvas
            ref={canvas}
            aria-hidden="true"
            className="absolute inset-0 size-full opacity-0 transition-opacity duration-700 data-ready:opacity-100"
          />
          <div className="pointer-events-none relative space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Tools</h1>
            <p className="text-white/75">Useful things, right in your browser.</p>
          </div>
        </div>
      </OrnateFrame>
      <OrnateFrame className="max-w-md">
        <Card>
          <CardHeader>
            <ImageIcon className="mb-2 size-5 text-muted-foreground" aria-hidden="true" />
            <CardTitle>Image resize</CardTitle>
            <CardDescription>
              Make an image smaller for a profile picture or a file size limit.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Planned to run entirely on your device.
          </CardContent>
          <CardFooter>
            <Button variant="outline" nativeButton={false} render={<Link to="/image-resize" />}>
              View tool <ArrowRight aria-hidden="true" />
            </Button>
          </CardFooter>
        </Card>
      </OrnateFrame>
    </div>
  );
}
