import { Box } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "3D model viewer",
  description:
    "Inspect 3D models with orbit controls, studio lighting, mesh statistics, and PNG screenshots.",
  keywords: ["glb", "gltf", "obj", "stl", "ply", "fbx", "wireframe"],
  icon: Box,
});
