import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { loadTool, ToolView } from "@/components/tool-view";
import { findTool } from "@/lib/tools";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/$category/$tool")({
  loader: async ({ params }) => {
    const tool = findTool(params.category, params.tool);
    if (!tool) throw notFound();
    await loadTool(tool);
  },
  head: ({ params }) => {
    const tool = findTool(params.category, params.tool);
    if (!tool) return {};
    return seo({
      title: `${tool.name} | Tools by Tyranny`,
      description: tool.description,
      path: tool.path,
      image: `/og/${tool.category.slug}/${tool.slug}.png`,
    });
  },
  component: ToolPage,
});

function ToolPage() {
  const params = Route.useParams();
  const tool = findTool(params.category, params.tool)!;
  return (
    <div className="space-y-10">
      <PageHeader
        crumbs={[
          { name: "Tools", path: "/" },
          { name: tool.category.name, path: `/${tool.category.slug}` },
        ]}
        title={tool.name}
        description={tool.description}
      />
      <ToolView tool={tool} />
    </div>
  );
}
