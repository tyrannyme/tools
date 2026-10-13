import { QrCode } from "lucide-react";
import { defineTool } from "@/lib/tools";
export default defineTool({
  name: "QR code",
  description: "Create static QR codes for links, text, Wi-Fi, and contacts as SVG or PNG.",
  keywords: ["qrcode", "wifi", "vcard", "qr generator", "barcode"],
  icon: QrCode,
});
