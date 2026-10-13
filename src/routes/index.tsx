import { createFileRoute, Link } from "@tanstack/react-router";
import { DuskPanel } from "@/components/dusk-panel";
import { OrnateFrame } from "@/components/ornament";
import { ToolGrid } from "@/components/tool-card";
import { categories, tools, toolsIn } from "@/lib/tools";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    seo({
      title: "Tools by Tyranny",
      description: `${tools.length} free tools for images, video, documents, games, and 3D. Everything runs in your browser.`,
      path: "/",
    }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-14">
      <OrnateFrame>
        <DuskPanel className="rounded-xl px-8 py-14 sm:py-20">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tools</h1>
          <p className="mt-2 max-w-md text-white/75">
            Free tools that run in your browser. Your files never leave your device.
          </p>
        </DuskPanel>
      </OrnateFrame>
      {categories.map((category) => {
        const list = toolsIn(category);
        if (list.length === 0) return null;
        const Icon = category.icon;
        return (
          <section key={category.slug} aria-labelledby={`category-${category.slug}`}>
            <div className="mb-5">
              <h2 id={`category-${category.slug}`} className="text-xl font-semibold tracking-tight">
                <Link
                  to="/$category"
                  params={{ category: category.slug }}
                  className="inline-flex items-center gap-2 hover:text-gold"
                >
                  <Icon className="size-5 text-gold" aria-hidden="true" />
                  {category.name}
                </Link>
              </h2>
              <p className="mt-1 text-muted-foreground">{category.description}</p>
            </div>
            <ToolGrid tools={list} />
          </section>
        );
      })}
    </div>
  );
}
