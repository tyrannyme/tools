import { KeyRound } from "lucide-react";
import { defineTool } from "@/lib/tools";

export default defineTool({
  name: "JWT decoder",
  description: "Decode JWT headers and claims and inspect token expiration dates.",
  keywords: ["json web token", "jwt decode", "payload", "exp"],
  icon: KeyRound,
});
