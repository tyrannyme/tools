import { Palette } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Color palette",
  description:
    "Extract dominant image colors as HEX, RGB, and OKLCH, then export a palette card, CSS, or JSON.",
  keywords: ["swatches", "color picker", "dominant", "hex", "scheme"],
  icon: Palette,
});
