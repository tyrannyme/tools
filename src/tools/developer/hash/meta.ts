import { Hash } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "Hash",
  description: "Calculate SHA checksums for text and files and compare expected hashes.",
  keywords: ["sha256", "sha512", "checksum", "digest", "sha1"],
  icon: Hash,
});
