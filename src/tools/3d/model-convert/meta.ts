import { Replace } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Model converter",
  description: "Convert 3D models between OBJ, STL, PLY, glTF, and GLB in your browser.",
  keywords: ["mesh", "3d", "export", "gltf", "glb", "stl"],
  icon: Replace,
});
