import { Clock } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Timestamp converter",
  description: "Convert Unix timestamps and ISO dates across local, UTC, and IANA time zones.",
  keywords: ["epoch", "unix seconds", "milliseconds", "date time"],
  icon: Clock,
});
