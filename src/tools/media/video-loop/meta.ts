import { Repeat } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Video loop",
  description:
    "Turn a short video section into a silent MP4 loop at your chosen size and frame rate.",
  keywords: ["gif", "animated webp", "looping video", "silent mp4"],
  icon: Repeat,
});
