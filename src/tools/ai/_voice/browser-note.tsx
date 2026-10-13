import type { ReactNode } from "react";
import { MonitorX } from "lucide-react";
import type { Status } from "./chrome";
import { CopyButton, enter } from "./ui";

export const deviceNeeds =
  "Gemini Nano needs 22 GB of free disk space and either a GPU with more than 4 GB of memory, or 16 GB of RAM and 4 CPU cores.";

/** Shown in place of a result when Chrome's built-in model can't run here. */
export function Unsupported({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center ${enter}`}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <MonitorX className="size-5" aria-hidden="true" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <p className="font-medium text-balance">{title}</p>
        <p className="text-sm text-pretty text-muted-foreground">{children}</p>
      </div>
      <CopyButton text={location.href} label="Copy link" message="Link copied" />
    </div>
  );
}

/** One quiet line under the action: what runs the tool, and what a first run downloads. */
export function ChromeNote({
  status,
  engine,
  download,
}: {
  status: Status;
  engine: string;
  download: string;
}) {
  if (status === "checking" || status === "missing" || status === "unavailable")
    return <p className="min-h-5 text-xs text-muted-foreground" />;
  return (
    <p className="min-h-5 text-xs leading-relaxed text-pretty text-muted-foreground">
      {engine} {status === "available" ? "Already downloaded." : download} Text stays on this
      device.
    </p>
  );
}
