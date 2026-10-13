import { Film } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Sprite sheet slicer",
  description:
    "Split a sprite sheet into PNG frames, preview the animation, and download every frame as a ZIP.",
  keywords: ["sprites", "animation", "frames", "tileset", "grid"],
  icon: Film,
});
