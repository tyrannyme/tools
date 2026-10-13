import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ShareMenu } from "@/components/share-menu";
import { loadTool, ToolView } from "@/components/tool-view";
import { findTool } from "@/lib/tools";
import { seo, siteName, siteUrl } from "@/lib/seo";

export const Route = createFileRoute("/$category/$tool")({
  loader: async ({ params, preload }) => {
    const tool = findTool(params.category, params.tool);
    if (!tool) throw notFound();
    // Hovering a link only preloads the route. A tool's own code, which can include
    // three.js, mediabunny, or an AI runtime, loads when you actually open it.
    if (!preload) await loadTool(tool);
  },
  // A preload skips the tool code, so it must not count as loaded data for the real visit.
  preloadStaleTime: 0,
  head: ({ params }) => {
    const tool = findTool(params.category, params.tool);
    if (!tool) return {};
    const structuredData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebApplication",
          name: tool.name,
          description: tool.description,
          url: siteUrl + tool.path,
          applicationCategory: tool.category.name,
          operatingSystem: "Any modern browser",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          publisher: { "@type": "Organization", name: "Tyranny", url: "https://tyranny.me" },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: siteName, item: siteUrl + "/" },
            {
              "@type": "ListItem",
              position: 2,
              name: tool.category.name,
              item: `${siteUrl}/${tool.category.slug}`,
            },
            { "@type": "ListItem", position: 3, name: tool.name, item: siteUrl + tool.path },
          ],
        },
      ],
    };
    return {
      ...seo({
        title: `${tool.name} | Tools by Tyranny`,
        description: tool.description,
        path: tool.path,
        image: `/og/${tool.id}.jpg`,
      }),
      scripts: [{ type: "application/ld+json", children: JSON.stringify(structuredData) }],
    };
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
        actions={<ShareMenu title={tool.name} path={tool.path} />}
      />
      <ToolView tool={tool} />
    </div>
  );
}
