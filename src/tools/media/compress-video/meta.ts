import { FileDown } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Compress video",
  description: "Fit a video under a target file size with adjustable resolution and frame rate.",
  keywords: ["reduce video size", "8 MB", "discord", "bitrate", "mp4"],
  icon: FileDown,
});
