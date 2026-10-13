import { Dices } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/lib/use-hydrated";
import { CopyButton, ErrorMessage, Segmented } from "../_shared/controls";
import { parseDice, rollDice } from "./roll";

type Roll = ReturnType<typeof rollDice> & { id: number; animate: boolean };

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

export default function DiceTool() {
  const [notation, setNotation] = useState("2d6+3");
  const [mode, setMode] = useState("normal");
  const [history, setHistory] = useState<Roll[]>([]);
  const [error, setError] = useState("");
  const hydrated = useHydrated();
  const sequence = useRef(0);
  const result = useRef<HTMLDivElement>(null);
  const latest = history[0];
  let d20 = false;
  try {
    const parsed = parseDice(notation);
    d20 = parsed.count === 1 && parsed.sides === 20;
  } catch {
    // Reported when you roll.
  }
  // A small settle on each pointer roll. Keyboard rolls stay instant.
  useEffect(() => {
    if (!latest?.animate || !result.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const easing = "cubic-bezier(0.23, 1, 0.32, 1)";
    const animations = Array.from(
      result.current.querySelectorAll<HTMLElement>("[data-die], [data-total]"),
      (element, index) =>
        element.animate(
          reduce
            ? [{ opacity: 0.4 }, { opacity: 1 }]
            : [
                {
                  transform: element.dataset.total
                    ? "translateY(6px) scale(0.96)"
                    : `translateY(-8px) rotate(${index % 2 ? 8 : -8}deg) scale(0.96)`,
                  opacity: 0.4,
                },
                { transform: "none", opacity: 1 },
              ],
          { duration: 220, easing, delay: element.dataset.total ? 0 : Math.min(index, 8) * 25 },
        ),
    );
    return () => animations.forEach((animation) => animation.cancel());
  }, [latest]);
  function roll(input: string, animate: boolean) {
    try {
      const parsed = parseDice(input);
      const effective =
        parsed.count === 1 && parsed.sides === 20 && mode !== "normal"
          ? `2d20${mode === "advantage" ? "kh" : "kl"}1${parsed.modifier ? signed(parsed.modifier) : ""}`
          : input.replace(/\s/g, "");
      const next = { ...rollDice(effective), id: ++sequence.current, animate };
      setError("");
      setHistory((items) => [next, ...items].slice(0, 50));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Secure randomness is unavailable in this browser.",
      );
    }
  }
  const historyText = history
    .map(
      (item) =>
        `${item.notation}: ${item.dice.map((die) => (die.kept ? die.value : `(${die.value} dropped)`)).join(", ")}${item.modifier ? `; modifier ${signed(item.modifier)}` : ""} = ${item.total}`,
    )
    .join("\n");
  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[20rem_1fr]">
      <div className="space-y-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            roll(notation, false);
          }}
        >
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="dice-notation">Dice notation</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="dice-notation"
                value={notation}
                maxLength={60}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? "dice-error" : "dice-hint"}
                onChange={(event) => {
                  setNotation(event.target.value);
                  setError("");
                }}
                className="font-mono"
              />
              <Button
                type="button"
                disabled={!hydrated}
                onClick={(event) => roll(notation, event.detail > 0)}
              >
                <Dices aria-hidden="true" />
                Roll
              </Button>
            </div>
            {error ? (
              <ErrorMessage id="dice-error">{error}</ErrorMessage>
            ) : (
              <FieldDescription id="dice-hint">
                Like <span className="font-mono">2d6+3</span>, or{" "}
                <span className="font-mono">4d6kh3</span> to keep the highest 3.
              </FieldDescription>
            )}
          </Field>
        </form>
        {d20 && (
          <Segmented
            label="d20 roll"
            value={mode}
            onChange={setMode}
            options={[
              { value: "normal", label: "Normal" },
              { value: "advantage", label: "Advantage" },
              { value: "disadvantage", label: "Disadvantage" },
            ]}
          />
        )}
        <fieldset className="space-y-3">
          <legend className="mb-3 text-sm font-medium">Quick roll</legend>
          <div className="grid grid-cols-4 gap-2">
            {[4, 6, 8, 10, 12, 20, 100].map((sides) => (
              <Button
                key={sides}
                variant="outline"
                className="font-mono"
                disabled={!hydrated}
                onClick={(event) => {
                  setNotation(`d${sides}`);
                  roll(`d${sides}`, event.detail > 0);
                }}
              >
                d{sides}
              </Button>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="min-w-0 space-y-8">
        <section
          ref={result}
          aria-label="Latest roll"
          className="flex min-h-72 flex-col items-center justify-center gap-6 rounded-xl border bg-card p-6 text-center sm:p-8"
        >
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {latest ? `Rolled ${latest.total} on ${latest.notation}` : ""}
          </p>
          {latest ? (
            <>
              <div className="space-y-1">
                <p className="font-mono text-sm text-muted-foreground">{latest.notation}</p>
                <p
                  data-total="true"
                  className="font-mono text-7xl font-semibold tracking-tight tabular-nums sm:text-8xl"
                >
                  {latest.total}
                </p>
              </div>
              <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
                {latest.dice.map((die) => (
                  <div
                    key={die.index}
                    data-die="true"
                    className={cn(
                      "flex min-h-14 min-w-14 flex-col items-center justify-center rounded-lg border px-2.5 py-1.5 font-mono tabular-nums",
                      die.kept ? "bg-background shadow-xs" : "border-dashed text-muted-foreground",
                    )}
                  >
                    <span className={cn("text-xl font-semibold", !die.kept && "line-through")}>
                      {die.value}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {die.kept ? `d${latest.sides}` : "dropped"}
                    </span>
                  </div>
                ))}
                {latest.modifier !== 0 && (
                  <span className="px-1 font-mono text-xl text-muted-foreground">
                    {signed(latest.modifier)}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Dices className="size-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">No rolls yet</p>
                <p className="text-sm text-muted-foreground">
                  Pick a die, or enter notation and press Roll.
                </p>
              </div>
            </div>
          )}
        </section>
        {history.length > 1 && (
          <section aria-labelledby="dice-history" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 id="dice-history" className="text-sm font-medium">
                History
              </h2>
              <div className="flex gap-1">
                <CopyButton value={historyText} variant="ghost" size="sm" />
                <Button variant="ghost" size="sm" onClick={() => setHistory([])}>
                  Clear
                </Button>
              </div>
            </div>
            <ol className="max-h-80 divide-y overflow-auto overscroll-contain rounded-xl border">
              {history.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                  <span className="w-24 shrink-0 font-mono text-muted-foreground">
                    {item.notation}
                  </span>
                  <span className="min-w-0 flex-1 font-mono break-words text-muted-foreground tabular-nums">
                    {item.dice.map((die) => (
                      <span
                        key={die.index}
                        className={cn("mr-2", !die.kept && "line-through opacity-60")}
                      >
                        {die.value}
                      </span>
                    ))}
                    {item.modifier !== 0 && <span>{signed(item.modifier)}</span>}
                  </span>
                  <strong className="font-mono text-base tabular-nums">{item.total}</strong>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
