import { createFileRoute } from "@tanstack/react-router";
import { siteUrl } from "@/lib/seo";
import { categories, tools, toolsIn } from "@/lib/tools";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const paths = [
          "/",
          ...categories.filter((category) => toolsIn(category).length).map((c) => `/${c.slug}`),
          ...tools.map((tool) => tool.path),
        ];
        const urls = paths.map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
      },
    },
  },
});
