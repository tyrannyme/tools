import { ScanLine } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Remove background",
  description: "Cut out the subject of a photo and replace its background on your device.",
  keywords: ["transparent", "png", "erase", "background remover"],
  icon: ScanLine,
});
