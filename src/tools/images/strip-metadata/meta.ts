import { ShieldCheck } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "Remove photo metadata",
  description:
    "Inspect camera, date, and location metadata, then strip it from JPEG, PNG, and WebP without re-encoding.",
  keywords: ["exif", "gps", "privacy", "xmp", "location", "batch"],
  icon: ShieldCheck,
});
