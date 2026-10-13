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
  return (
    <Link to={tool.path} className="group block h-full rounded-xl outline-none">
      <Card className="h-full transition-[box-shadow,translate] group-hover:-translate-y-0.5 group-hover:ring-gold/60 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        {/* The artwork comes from src/tools/<category>/<slug>/art.html via `pnpm thumbs`. */}
        <img
          src={`/thumbs/${tool.id}.webp`}
          alt=""
          width={640}
          height={400}
          loading="lazy"
          decoding="async"
          className="aspect-8/5 w-full bg-dusk object-cover"
        />
        <CardHeader>
          <CardTitle>{tool.name}</CardTitle>
          <CardDescription>{tool.description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
