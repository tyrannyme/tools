import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { loadSample } from "@/lib/files";

/** Loads files from `public/samples/` so a tool can be tried without your own. */
export function SampleButton({
  files,
  onFiles,
  children = "Try a sample",
}: {
  /** File names in `public/samples/`. */
  files: string[];
  onFiles: (files: File[]) => void | Promise<void>;
  children?: string;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await onFiles(await Promise.all(files.map((name) => loadSample(name))));
        } catch {
          toast.error("The sample could not be loaded. Check your connection and try again.");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading && <Spinner />}
      {children}
    </Button>
  );
}
