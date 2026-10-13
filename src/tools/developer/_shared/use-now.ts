import { useSyncExternalStore } from "react";

let now: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function update() {
  now = Date.now();
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    update();
    timer = setInterval(update, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      now = null;
    }
  };
}
const snapshot = () => now;
const serverSnapshot = () => null;

export function useNow() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
