import { MousePointer2 } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Click to cut out",
  description: "Select an object with points and save it as a transparent PNG.",
  keywords: ["segment anything", "mask", "select object", "cutout"],
  icon: MousePointer2,
});
