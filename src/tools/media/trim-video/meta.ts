import { Scissors } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Trim video",
  description: "Cut a precise section from a video and export it as MP4 or WebM.",
  keywords: ["cut video", "clip", "crop duration", "mp4", "webm"],
  icon: Scissors,
});
