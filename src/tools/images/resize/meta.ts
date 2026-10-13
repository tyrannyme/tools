import { Scaling } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Image resize",
  description:
    "Resize an image by pixels, percentage, or preset and compress it to a target file size.",
  keywords: ["compress", "dimensions", "scale", "profile picture", "kilobytes"],
  icon: Scaling,
});
