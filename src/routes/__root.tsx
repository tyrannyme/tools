import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DuskPanel } from "@/components/dusk-panel";
import { OrnamentRule, OrnateFrame } from "@/components/ornament";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToolSearch } from "@/components/tool-search";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteName } from "@/lib/seo";
import { themeScript } from "@/lib/theme";
import styles from "@/styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#1d1a33" },
      { title: siteName },
    ],
    links: [
      { rel: "stylesheet", href: styles },
      { rel: "icon", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [{ children: themeScript }],
  }),
  component: AppLayout,
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="space-y-4">
      <meta name="robots" content="noindex" />
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Button variant="outline" nativeButton={false} render={<Link to="/" />}>
        Back to Tools
      </Button>
    </div>
  ),
});

function AppLayout() {
  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between gap-3 py-5">
        <Link to="/" className="flex items-center gap-3 font-semibold">
          <img src="/favicon.png" alt="" width={28} height={28} className="rounded-sm" />
          Tools
        </Link>
        <div className="flex items-center gap-1">
          <ToolSearch />
          <ThemeToggle />
          <a
            href="https://tyranny.me"
            className="ml-2 hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
          >
            by Tyranny
          </a>
        </div>
      </header>
      <OrnamentRule />
      <main id="main" className="flex-1 py-12">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="pt-8 pb-10">
      <OrnateFrame>
        {/* The panel always uses the dark palette, so gold reads well on the dusk sky. */}
        <DuskPanel className="dark rounded-xl px-6 py-14 text-center sm:py-16">
          <img
            src="/favicon.png"
            alt=""
            width={40}
            height={40}
            className="mx-auto mb-6 rounded-sm shadow-[0_0_32px_oklch(0.8_0.12_84/0.45)] ring-1 ring-gold/60"
          />
          <OrnamentRule className="mx-auto max-w-md">
            <p
              lang="la"
              className="px-3 font-display text-sm font-semibold tracking-[0.25em] whitespace-nowrap text-gold uppercase sm:text-lg sm:tracking-[0.35em]"
            >
              Sic semper tyrannis
            </p>
          </OrnamentRule>
        </DuskPanel>
      </OrnateFrame>
    </footer>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The theme script sets the class before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4"
        >
          Skip to content
        </a>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}
