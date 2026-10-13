import { Braces } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "JSON formatter",
  description: "Format, minify, validate, and explore JSON with a collapsible tree.",
  keywords: ["pretty print", "lint", "sort keys", "json validator"],
  icon: Braces,
});
