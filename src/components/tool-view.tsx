import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { tools } from "@/lib/tools";
import type { Tool } from "@/lib/tools";

const loaded = new Map<string, ComponentType>();
const lazies = new Map(tools.map((tool) => [tool.id, lazy(tool.load)]));

/** Loads a tool's code. Route loaders call this so navigation renders without a fallback. */
export async function loadTool(tool: Tool) {
  if (!loaded.has(tool.id)) loaded.set(tool.id, (await tool.load()).default);
}

/**
 * Renders a tool. During hydration the code may not be loaded yet; the Suspense
 * boundary keeps the server-rendered markup in place until it is.
 */
export function ToolView({ tool }: { tool: Tool }) {
  const Component = loaded.get(tool.id) ?? lazies.get(tool.id)!;
  return (
    <Suspense fallback={null}>
      {/* Both maps hold stable, module-level components, so state survives re-renders. */}
      {/* oxlint-disable-next-line react/static-components */}
      <Component />
    </Suspense>
  );
}
