import { SpellCheck } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Proofread",
  description: "Check English spelling and grammar locally, then accept or reject each correction.",
  keywords: ["grammar", "spelling", "corrections", "writing"],
  icon: SpellCheck,
});
