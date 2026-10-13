import { Speech } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Text to speech",
  description: "Turn English text into natural speech with local Kokoro voices and download a WAV.",
  keywords: ["tts", "kokoro", "voice", "read aloud", "wav"],
  icon: Speech,
});
