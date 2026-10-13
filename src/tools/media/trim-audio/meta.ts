import { Music } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Audio trimmer",
  description: "Select audio on a waveform, add fades, and export WAV or M4A.",
  keywords: ["cut audio", "fade in", "fade out", "waveform", "ringtone"],
  icon: Music,
});
