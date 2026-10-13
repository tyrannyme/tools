import { AudioLines } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Extract audio",
  description: "Save the sound from a video as M4A, Opus WebM, or WAV.",
  keywords: ["video to audio", "aac", "opus", "wav", "sound"],
  icon: AudioLines,
});
