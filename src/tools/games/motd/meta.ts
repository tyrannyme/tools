import { Type } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Minecraft text formatter",
  description:
    "Preview Minecraft colors and styles and convert text to legacy codes, MiniMessage, or JSON.",
  keywords: ["motd", "server", "chat", "item name", "section sign", "minimessage"],
  icon: Type,
});
