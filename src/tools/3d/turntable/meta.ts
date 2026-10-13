import { Clapperboard } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Turntable video",
  description: "Record a full 360 degree rotation of a 3D model as a square MP4 or WebM video.",
  keywords: ["3d", "model", "animation", "video", "360", "render"],
  icon: Clapperboard,
});
