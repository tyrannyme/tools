import { ScanText } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Read text from an image",
  description: "Extract printed text from photos and screenshots without uploading them.",
  keywords: ["ocr", "text recognition", "screenshot to text"],
  icon: ScanText,
});
