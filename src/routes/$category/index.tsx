import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ToolGrid } from "@/components/tool-card";
import { findCategory, toolsIn } from "@/lib/tools";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/$category/")({
  beforeLoad: ({ params }) => {
    if (!findCategory(params.category)) throw notFound();
  },
  head: ({ params }) => {
    const category = findCategory(params.category);
    if (!category) return {};
    return seo({
      title: `${category.name} tools | Tools by Tyranny`,
      description: `${category.description} Free, in your browser, nothing uploaded.`,
      path: `/${category.slug}`,
      image: `/og/${category.slug}.jpg`,
    });
  },
  component: CategoryPage,
});

function CategoryPage() {
  const category = findCategory(Route.useParams().category)!;
  return (
    <div className="space-y-10">
      <PageHeader
        crumbs={[{ name: "Tools", path: "/" }]}
        title={category.name}
        description={category.description}
      />
      <ToolGrid tools={toolsIn(category)} />
    </div>
  );
}
