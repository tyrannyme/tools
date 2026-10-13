import { ScanLine } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Redact a screenshot",
  description:
    "Draw and move boxes to black out, pixelate, or blur parts of a screenshot before exporting it.",
  keywords: ["hide", "censor", "privacy", "clipboard", "blur"],
  icon: ScanLine,
});
