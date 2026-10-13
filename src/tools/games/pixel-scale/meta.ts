import { Grid2X2 } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Pixel art scaler",
  description:
    "Scale pixel art up or down by whole-number factors and export a crisp, transparent PNG.",
  keywords: ["nearest neighbor", "upscale", "downscale", "sprite", "pixel size"],
  icon: Grid2X2,
});
