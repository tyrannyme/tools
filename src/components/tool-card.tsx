import { Link } from "@tanstack/react-router";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tool } from "@/lib/tools";

export function ToolGrid({ tools }: { tools: Tool[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <li key={tool.id}>
          <ToolCard tool={tool} />
        </li>
      ))}
    </ul>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  return (
    <Link to={tool.path} className="group block h-full rounded-xl outline-none">
      <Card className="h-full transition-[box-shadow,translate] group-hover:-translate-y-0.5 group-hover:ring-gold/60 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader>
          <Icon className="mb-2 size-5 text-gold" aria-hidden="true" />
          <CardTitle>{tool.name}</CardTitle>
          <CardDescription>{tool.description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
