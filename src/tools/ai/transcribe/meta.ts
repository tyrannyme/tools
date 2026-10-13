import { AudioLines } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Transcribe",
  description: "Transcribe audio and video into timestamped text and subtitles on your device.",
  keywords: ["whisper", "speech to text", "subtitles", "srt", "vtt"],
  icon: AudioLines,
});
