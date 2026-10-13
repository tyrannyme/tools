import { TextQuote } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Summarize",
  description:
    "Condense text into key points, a short summary, a teaser, or a headline on your device.",
  keywords: ["summary", "tldr", "key points", "chrome"],
  icon: TextQuote,
});
