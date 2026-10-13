import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { OrnamentRule } from "@/components/ornament";
import { Button } from "@/components/ui/button";
import styles from "@/styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Tools | Tyranny" },
      { name: "description", content: "Useful tools that run in your browser. By Tyranny." },
    ],
    links: [
      { rel: "stylesheet", href: styles },
      {
        rel: "preload",
        href: "/fonts/cormorant-normal.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "icon", href: "/favicon.png" },
    ],
  }),
  component: AppLayout,
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="space-y-4">
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
      <header className="flex items-center justify-between gap-4 py-5">
        <Link to="/" className="flex items-center gap-3 font-semibold">
          <img src="/favicon.png" alt="" width={28} height={28} />
          Tools
        </Link>
        <a
          href="https://tyranny.me"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          by Tyranny
        </a>
      </header>
      <OrnamentRule />
      <main id="main" className="flex-1 py-12">
        <Outlet />
      </main>
      <footer className="py-8">
        <OrnamentRule>
          <p
            lang="la"
            className="px-2 font-display text-xs font-semibold tracking-[0.2em] whitespace-nowrap uppercase sm:text-sm sm:tracking-[0.3em]"
          >
            Sic semper tyrannis
          </p>
        </OrnamentRule>
      </footer>
    </div>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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
        {children}
        <Scripts />
      </body>
    </html>
  );
}
