import { Grid3X3 } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Seamless texture checker",
  description: "Inspect textures in a 3 \u00d7 3 grid and blend their edges for seamless tiling.",
  keywords: ["tile", "repeat", "seams", "material", "texture"],
  icon: Grid3X3,
});
