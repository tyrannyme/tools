import { Link2, Share, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { siteUrl } from "@/lib/seo";
import { useHydrated } from "@/lib/use-hydrated";

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2H22l-6.8 7.8L23 22h-6.3l-4.9-6.4L6.2 22H3l7.3-8.3L2.6 2h6.4l4.4 5.9zm-1.1 18h1.7L8.3 3.9H6.5z" />
    </svg>
  );
}

/** Share a page: copy its link, post it on X, or use the device share sheet. */
export function ShareMenu({ title, path }: { title: string; path: string }) {
  const hydrated = useHydrated();
  const url = siteUrl + path;
  const canShare = hydrated && typeof navigator.share === "function";

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const post = () => {
    const intent = new URL("https://x.com/intent/post");
    intent.searchParams.set("text", `${title}, free in your browser:`);
    intent.searchParams.set("url", url);
    window.open(intent, "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <Share2 aria-hidden="true" />
        Share
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={copy}>
          <Link2 aria-hidden="true" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={post}>
          <XLogo />
          Post on X
        </DropdownMenuItem>
        {canShare && (
          <DropdownMenuItem onClick={() => void navigator.share({ title, url }).catch(() => {})}>
            <Share aria-hidden="true" />
            More options
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
