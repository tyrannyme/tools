import { Layers } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "3D photo",
  description: "Turn a photo into an interactive depth animation and export a looping video.",
  keywords: ["parallax", "depth map", "3d", "photo animation"],
  icon: Layers,
});
