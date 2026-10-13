import { Package } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Minecraft resource pack starter",
  description:
    "Create a Java resource pack ZIP with versioned metadata, a formatted description, and a custom icon.",
  keywords: ["pack.mcmeta", "pack_format", "texture pack", "pack.png"],
  icon: Package,
});
