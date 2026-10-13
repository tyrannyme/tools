import { Dices } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Dice roller",
  description:
    "Roll tabletop dice with modifiers, keep-highest rules, advantage, and a detailed roll history.",
  keywords: ["d20", "dnd", "2d6", "4d6kh3", "tabletop", "random", "advantage"],
  icon: Dices,
});
