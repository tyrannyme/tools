import { Box, Braces, Clapperboard, FileText, Gamepad2, Image } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

/** What each tool declares in `src/tools/<category>/<slug>/meta.ts`. */
export interface ToolMeta {
  /** Short name, shown as the page title. */
  name: string;
  /** One sentence saying what the tool does. Used on cards, in search, and for SEO. */
  description: string;
  /** Extra words people might search for. */
  keywords?: string[];
  icon: LucideIcon;
}

export function defineTool(meta: ToolMeta): ToolMeta {
  return meta;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
}

export const categories: Category[] = [
  {
    slug: "images",
    name: "Images",
    description: "Resize, convert, and clean up images.",
    icon: Image,
  },
  {
    slug: "media",
    name: "Video and audio",
    description: "Trim, compress, and convert video and audio.",
    icon: Clapperboard,
  },
  {
    slug: "documents",
    name: "Documents",
    description: "Merge, split, and make PDFs and QR codes.",
    icon: FileText,
  },
  {
    slug: "developer",
    name: "Developer",
    description: "Encode, decode, format, and generate.",
    icon: Braces,
  },
  {
    slug: "games",
    name: "Games",
    description: "Helpers for Minecraft, pixel art, and the tabletop.",
    icon: Gamepad2,
  },
  {
    slug: "3d",
    name: "3D",
    description: "View, convert, and texture 3D models.",
    icon: Box,
  },
];

export interface Tool extends ToolMeta {
  slug: string;
  category: Category;
  /** `category/slug`, unique across the site. */
  id: string;
  path: string;
  load: () => Promise<{ default: ComponentType }>;
}

const metas = import.meta.glob<{ default: ToolMeta }>("../tools/*/*/meta.ts", { eager: true });
const components = import.meta.glob<{ default: ComponentType }>("../tools/*/*/tool.tsx");

export const tools: Tool[] = Object.entries(metas)
  .flatMap(([file, module]) => {
    const [categorySlug, slug] = file.split("/").slice(-3, -1) as [string, string];
    const category = categories.find((item) => item.slug === categorySlug);
    const load = components[file.replace(/meta\.ts$/, "tool.tsx")];
    if (!category || !load) return [];
    const id = `${category.slug}/${slug}`;
    return [{ ...module.default, slug, category, id, path: `/${id}`, load }];
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export function toolsIn(category: Category) {
  return tools.filter((tool) => tool.category === category);
}

export function findCategory(slug: string) {
  return categories.find((category) => category.slug === slug);
}

export function findTool(category: string, slug: string) {
  return tools.find((tool) => tool.id === `${category}/${slug}`);
}
