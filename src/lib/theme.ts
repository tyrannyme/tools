import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

const storageKey = "theme";
const darkQuery = "(prefers-color-scheme: dark)";

/** Runs in <head> before first paint so the page never flashes the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${storageKey}");var d=t==="dark"||(t!=="light"&&matchMedia("${darkQuery}").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}})()`;

const listeners = new Set<() => void>();

function readTheme(): Theme {
  const stored = localStorage.getItem(storageKey);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia(darkQuery).matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = matchMedia(darkQuery);
  const onSystemChange = () => {
    if (readTheme() === "system") apply("system");
    listener();
  };
  media.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
  };
}

export function setTheme(theme: Theme) {
  if (theme === "system") localStorage.removeItem(storageKey);
  else localStorage.setItem(storageKey, theme);
  apply(theme);
  for (const listener of listeners) listener();
}

/** The chosen theme, and whether dark is currently showing. Both are `undefined` on the server. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => undefined);
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => undefined,
  );
  return { theme, dark, setTheme };
}
