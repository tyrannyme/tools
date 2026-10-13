import { Languages } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Translate",
  description:
    "Translate text on your device with Chrome’s built-in translator or a small downloaded model.",
  keywords: ["translation", "language", "offline", "french", "spanish", "german", "italian"],
  icon: Languages,
});
