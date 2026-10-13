import { Orbit } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Normal map generator",
  description: "Turn a height map or texture into a normal map with a live lit 3D preview.",
  keywords: ["sobel", "bump", "heightmap", "opengl", "directx", "texture"],
  icon: Orbit,
});
