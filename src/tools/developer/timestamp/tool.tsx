import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "cn";
import { useHydrated } from "@/lib/use-hydrated";
import { useNow } from "../_shared/use-now";
import { Choice, CopyButton, ErrorMessage } from "../_shared/ui";

type Kind = "seconds" | "milliseconds" | "iso" | "local";

function parseDate(source: string, kind: Kind) {
  const input = source.trim();
  if (!input) throw new Error("Enter a timestamp or date.");
  if (kind === "seconds" || kind === "milliseconds") {
    if (!/^-?\d+(?:\.\d+)?$/.test(input))
      throw new Error(
        kind === "seconds"
          ? "Enter Unix seconds as digits, for example 1735689600."
          : "Enter Unix milliseconds as digits, for example 1735689600000.",
      );
    if (input.length > 100) throw new Error("This timestamp is outside the supported date range.");
    const [whole, fraction = ""] = input.replace(/^-/, "").split(".");
    const precision = kind === "seconds" ? 3 : 0;
    if (/[1-9]/.test(fraction.slice(precision)))
      throw new Error("Use at most millisecond precision.");
    const magnitude =
      BigInt(whole!) * (kind === "seconds" ? 1000n : 1n) +
      BigInt(fraction.slice(0, precision).padEnd(precision, "0") || "0");
    const milliseconds = Number(input.startsWith("-") ? -magnitude : magnitude);
    if (!Number.isSafeInteger(milliseconds))
      throw new Error("This timestamp is outside the supported date range.");
    return new Date(milliseconds);
  }
  const pattern =
    kind === "iso"
      ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i
      : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;
  if (!pattern.test(input))
    throw new Error(
      kind === "iso"
        ? "Use ISO 8601 with a time zone, for example 2025-01-01T12:00:00Z."
        : "Enter a complete date and time.",
    );
  const [year, month, day] = input.slice(0, 10).split("-").map(Number) as [number, number, number];
  const calendar = new Date(`${input.slice(0, 10)}T00:00:00Z`);
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() + 1 !== month ||
    calendar.getUTCDate() !== day ||
    Number(input.slice(11, 13)) > 23 ||
    Number(input.slice(14, 16)) > 59 ||
    (input[16] === ":" && Number(input.slice(17, 19)) > 59)
  )
    throw new Error("That date or time does not exist on the calendar.");
  const date = new Date(input);
  if (
    kind === "local" &&
    (date.getHours() !== Number(input.slice(11, 13)) ||
      date.getMinutes() !== Number(input.slice(14, 16)))
  )
    throw new Error(
      "This local time is skipped when clocks move forward. Pick another time, or use ISO 8601 with an offset.",
    );
  if (Number.isNaN(date.getTime())) throw new Error("This date is outside the supported range.");
  return date;
}

function human(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "full",
    timeStyle: "long",
  }).format(date);
}

function relative(milliseconds: number) {
  const seconds = milliseconds / 1000;
  const absolute = Math.abs(seconds);
  const [unit, size] =
    absolute >= 31_536_000
      ? (["year", 31_536_000] as const)
      : absolute >= 2_592_000
        ? (["month", 2_592_000] as const)
        : absolute >= 86_400
          ? (["day", 86_400] as const)
          : absolute >= 3600
            ? (["hour", 3600] as const)
            : absolute >= 60
              ? (["minute", 60] as const)
              : (["second", 1] as const);
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round(seconds / size),
    unit,
  );
}

/** The current time written in the given input format. */
function format(milliseconds: number, kind: Kind) {
  if (kind === "seconds") return String(Math.floor(milliseconds / 1000));
  if (kind === "milliseconds") return String(milliseconds);
  const date = new Date(milliseconds);
  if (kind === "iso") return date.toISOString();
  const local = new Date(milliseconds - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 19);
}

const examples: Record<Kind, string> = {
  seconds: "1735689600",
  milliseconds: "1735689600000",
  iso: "2025-01-01T00:00:00Z",
  local: "2025-01-01T00:00",
};

function validZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export default function TimestampTool() {
  const [source, setSource] = useState(examples.seconds);
  const [kind, setKind] = useState<Kind>("seconds");
  const [zone, setZone] = useState("Asia/Tokyo");
  const hydrated = useHydrated();
  const localZone = hydrated ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;
  const now = useNow();
  const zones = useMemo(
    () => (hydrated && "supportedValuesOf" in Intl ? Intl.supportedValuesOf("timeZone") : []),
    [hydrated],
  );
  const zoneValid = validZone(zone.trim());

  const result = useMemo(() => {
    // A local date means nothing until the browser knows its time zone.
    if (kind === "local" && localZone === null) return { date: null, error: "" };
    try {
      return { date: parseDate(source, kind), error: "" };
    } catch (cause) {
      return {
        date: null,
        error: cause instanceof Error ? cause.message : "Unable to read this date.",
      };
    }
  }, [source, kind, localZone]);
  // Keep showing the last valid date while the input is mid-edit.
  const [last, setLast] = useState<Date | null>(null);
  if (result.date && result.date.getTime() !== last?.getTime()) setLast(result.date);
  const date = result.date ?? last;

  // Every row renders on the server too, so values that need the browser fill in without a shift.
  const rows: { label: string; value: string | null }[] = date
    ? [
        { label: "Unix seconds", value: String(date.getTime() / 1000) },
        { label: "Unix milliseconds", value: String(date.getTime()) },
        { label: "ISO 8601", value: date.toISOString() },
        { label: "Relative", value: now === null ? null : relative(date.getTime() - now) },
        {
          label: localZone ? `Local, ${localZone}` : "Local",
          value: localZone && human(date, localZone),
        },
        { label: "UTC", value: human(date, "UTC") },
        {
          label: zoneValid ? zone.trim() : "Time zone",
          value: zoneValid ? human(date, zone.trim()) : null,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] lg:grid-cols-[12rem_minmax(0,1fr)_16rem]">
        <Choice
          id="timestamp-kind"
          label="Input format"
          value={kind}
          onChange={(value) => {
            const next = value as Kind;
            // Rewrite the current input in the new format, so switching never loses the date.
            setSource(date ? format(date.getTime(), next) : examples[next]);
            setKind(next);
          }}
          options={[
            { value: "seconds", label: "Unix seconds" },
            { value: "milliseconds", label: "Unix milliseconds" },
            { value: "iso", label: "ISO 8601" },
            { value: "local", label: "Local date and time" },
          ]}
        />
        <Field data-invalid={!!result.error || undefined}>
          <FieldLabel htmlFor="timestamp-source">
            {kind === "local" ? "Date and time" : "Timestamp"}
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="timestamp-source"
              type={kind === "local" ? "datetime-local" : "text"}
              step={kind === "local" ? "1" : undefined}
              inputMode={kind === "seconds" || kind === "milliseconds" ? "numeric" : undefined}
              value={source}
              spellCheck={false}
              aria-invalid={!!result.error || undefined}
              aria-describedby="timestamp-hint"
              onChange={(event) => setSource(event.target.value)}
              className="font-mono"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                variant="secondary"
                disabled={now === null}
                onClick={() => now !== null && setSource(format(now, kind))}
              >
                Now
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <div id="timestamp-hint" aria-live="polite" className="min-h-5">
            {result.error ? (
              <ErrorMessage>{result.error}</ErrorMessage>
            ) : (
              <FieldDescription className="tabular-nums">
                {kind === "local"
                  ? "In a repeated daylight-saving hour, the earlier one is used."
                  : now === null
                    ? " "
                    : `Now is ${format(now, kind)}`}
              </FieldDescription>
            )}
          </div>
        </Field>
        <Field data-invalid={!zoneValid || undefined} className="sm:col-span-2 lg:col-span-1">
          <FieldLabel htmlFor="timestamp-zone">Also show in</FieldLabel>
          <Input
            id="timestamp-zone"
            value={zone}
            list="timestamp-zones"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!zoneValid || undefined}
            aria-describedby="timestamp-zone-hint"
            onChange={(event) => setZone(event.target.value)}
          />
          <datalist id="timestamp-zones">
            {zones.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </datalist>
          <div id="timestamp-zone-hint" aria-live="polite" className="min-h-5">
            {zoneValid ? (
              <FieldDescription>IANA time zone</FieldDescription>
            ) : (
              <ErrorMessage>Use an IANA name such as Europe/London.</ErrorMessage>
            )}
          </div>
        </Field>
      </div>

      {date && (
        <Card className={cn("py-0 transition-opacity", !result.date && "opacity-50")}>
          <CardContent className="p-0">
            <dl className="divide-y">
              {rows.map(({ label, value }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 gap-1 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="font-mono text-sm break-words">{value ?? " "}</dd>
                  </div>
                  <CopyButton name={label} text={value ?? ""} disabled={!value} />
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
