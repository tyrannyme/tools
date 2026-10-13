import { TextCursorInput } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Text stats",
  description:
    "Count words, characters, sentences, and paragraphs with reading time and word frequency.",
  keywords: ["word count", "character counter", "reading time", "speaking time"],
  icon: TextCursorInput,
});
