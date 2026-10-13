import { Palette } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Color converter",
  description: "Convert hex, RGB, HSL, OKLCH, and OKLAB colors and compare text contrast.",
  keywords: ["wcag", "apca", "contrast checker", "color picker"],
  icon: Palette,
});
