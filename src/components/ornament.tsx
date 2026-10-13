import type { ReactNode } from "react";
import { cn } from "cn";

function Scroll({ flip }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 16"
      className={cn("h-4 w-10 shrink-0", flip && "-scale-x-100")}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M1 8 C7 8 11 2.5 17 2.5 C21.5 2.5 23 6.5 20.5 8 C18.5 9.2 16.5 7.6 17.5 6" />
      <path d="M1 8 C9 8 15 13.5 23 12.5 C30 11.6 33 8 40 8" />
      <path d="M27 11.2 C28.5 13.5 31.5 14 33 13 C31.5 11.5 29 11 27 11.2 Z" fill="currentColor" />
    </svg>
  );
}

function Lozenge() {
  return (
    <svg viewBox="0 0 12 16" className="mx-1 h-4 w-3 shrink-0" aria-hidden="true">
      <path d="M6 2 L11 8 L6 14 L1 8 Z" fill="currentColor" />
    </svg>
  );
}

export function OrnamentRule({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center text-gold", className)}>
      <span className="h-px flex-1 bg-linear-to-r from-transparent to-gold" />
      <Scroll flip />
      {children ?? <Lozenge />}
      <Scroll />
      <span className="h-px flex-1 bg-linear-to-l from-transparent to-gold" />
    </div>
  );
}

const corners = [
  "-top-2.5 -left-2.5",
  "-top-2.5 -right-2.5 -scale-x-100",
  "-bottom-2.5 -left-2.5 -scale-y-100",
  "-right-2.5 -bottom-2.5 -scale-100",
];

export function OrnateFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {corners.map((position) => (
        <svg
          key={position}
          viewBox="0 0 32 32"
          className={cn("pointer-events-none absolute size-10 text-gold", position)}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M10 31 V14 C10 11.8 11.8 10 14 10 H31" strokeWidth={1.2} />
          <path d="M5 26 V10 C5 7.2 7.2 5 10 5 H26" strokeWidth={0.8} />
          <path d="M4 1 L7 4 L4 7 L1 4 Z" fill="currentColor" stroke="none" />
          <path d="M5 26 C5 29 7.5 30 8.5 28.5 C9.3 27.2 8 26.2 7.2 27" strokeWidth={0.8} />
          <path d="M26 5 C29 5 30 7.5 28.5 8.5 C27.2 9.3 26.2 8 27 7.2" strokeWidth={0.8} />
        </svg>
      ))}
    </div>
  );
}
