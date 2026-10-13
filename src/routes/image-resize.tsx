import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";

export const Route = createFileRoute("/image-resize")({
  head: () => ({ meta: [{ title: "Image resize | Tools" }] }),
  component: ImageResizePage,
});

function ImageResizePage() {
  return (
    <div className="space-y-8">
      <Button variant="ghost" nativeButton={false} render={<Link to="/" />}>
        <ArrowLeft aria-hidden="true" /> All tools
      </Button>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Image resize</h1>
        <p className="text-muted-foreground">Smaller dimensions. Smaller files.</p>
      </div>
      <Card>
        <CardHeader>
          <CardDescription>Image resizing is not available yet.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
