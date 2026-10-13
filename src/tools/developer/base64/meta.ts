import { Binary } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Base64",
  description: "Encode and decode UTF-8 text and files with standard or URL-safe Base64.",
  keywords: ["data url", "base64url", "binary", "decode"],
  icon: Binary,
});
