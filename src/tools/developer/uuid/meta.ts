import { Fingerprint } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "UUID generator",
  description: "Generate random v4 or time-ordered v7 UUIDs in bulk.",
  keywords: ["guid", "unique id", "identifier", "random"],
  icon: Fingerprint,
});
