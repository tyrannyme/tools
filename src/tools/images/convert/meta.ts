import { Images } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Image converter",
  description: "Convert images to PNG, JPEG, WebP, or supported AVIF and download them together.",
  keywords: ["jpg", "batch", "format", "zip", "avif"],
  icon: Images,
});
