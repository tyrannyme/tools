import { Scissors } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Split PDF",
  description: "Extract selected PDF pages or split a document into smaller PDFs.",
  keywords: ["extract pages", "page range", "separate", "pdf splitter"],
  icon: Scissors,
});
