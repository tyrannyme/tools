import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { rankWithJev, searchTools } from "@/lib/search";
import { categories, tools, toolsIn } from "@/lib/tools";
import type { Tool } from "@/lib/tools";

export function ToolSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState<string>();
  const [answer, setAnswer] = useState<{ query: string; ids: string[] }>();
  const navigate = useNavigate();
  const trimmed = query.trim();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, select, [contenteditable]");
      if (
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !typing)
      ) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Jev understands requests like "shrink a video for Discord". Ask once typing pauses.
  useEffect(() => {
    if (trimmed.length < 3) return;
    let current = true;
    const timer = setTimeout(async () => {
      setAsked(trimmed);
      const ids = await rankWithJev({ data: trimmed }).catch(() => null);
      if (current && ids) setAnswer({ query: trimmed, ids });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const local = useMemo(() => searchTools(trimmed), [trimmed]);
  const best = answer?.query === trimmed ? lookup(answer.ids) : [];
  const rest = local.filter((tool) => !best.includes(tool));
  const pending = asked === trimmed && answer?.query !== trimmed && trimmed.length >= 3;

  const go = (tool: Tool) => {
    setOpen(false);
    setQuery("");
    void navigate({ to: tool.path });
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-muted-foreground sm:w-56 sm:justify-start"
        aria-label="Search tools"
      >
        <Search aria-hidden="true" />
        <span className="hidden sm:inline">Search tools</span>
        <Kbd className="ml-auto hidden sm:inline-flex">/</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setQuery("");
        }}
        title="Search tools"
        // Opened from the keyboard many times a day, so it appears instantly.
        className="sm:max-w-xl data-open:animate-none data-closed:animate-none"
        description="Type a tool name or describe what you want to do."
      >
        <Command shouldFilter={false}>
          <div className="relative">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search, or describe what you need"
            />
            {pending && (
              <Spinner className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground" />
            )}
          </div>
          <CommandList className="max-h-[min(60vh,28rem)]">
            {trimmed && !pending && <CommandEmpty>No tools match.</CommandEmpty>}
            {trimmed ? (
              <>
                {best.length > 0 && <ResultGroup heading="Best fit" tools={best} onSelect={go} />}
                {rest.length > 0 && (
                  <ResultGroup
                    heading={best.length ? "Matches" : undefined}
                    tools={rest}
                    onSelect={go}
                  />
                )}
              </>
            ) : (
              categories.map((category) => (
                <ResultGroup
                  key={category.slug}
                  heading={category.name}
                  tools={toolsIn(category)}
                  onSelect={go}
                />
              ))
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function lookup(ids: string[]) {
  return ids.flatMap((id) => tools.find((tool) => tool.id === id) ?? []);
}

function ResultGroup({
  heading,
  tools: list,
  onSelect,
}: {
  heading?: string;
  tools: Tool[];
  onSelect: (tool: Tool) => void;
}) {
  if (list.length === 0) return null;
  return (
    <CommandGroup heading={heading}>
      {list.map((tool) => {
        const Icon = tool.icon;
        return (
          <CommandItem key={tool.id} value={tool.id} onSelect={() => onSelect(tool)}>
            <Icon className="text-gold" aria-hidden="true" />
            <span>{tool.name}</span>
            <span className="ml-auto truncate pl-4 text-xs text-muted-foreground">
              {tool.category.name}
            </span>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}
