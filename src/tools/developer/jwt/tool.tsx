import { CircleCheck, CircleX, Clock, KeyRound, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { decodeBase64, encodeBase64 } from "../_shared/base64";
import { useNow } from "../_shared/use-now";
import { CopyButton, ErrorMessage, enter } from "../_shared/ui";

const claims: Record<string, string> = {
  iss: "Issuer",
  sub: "Subject",
  aud: "Audience",
  exp: "Expires",
  nbf: "Not before",
  iat: "Issued",
  jti: "Token ID",
};

/** A token that was issued just now and expires in an hour. */
function example() {
  const now = Math.floor(Date.now() / 1000);
  const part = (value: object) =>
    encodeBase64(new TextEncoder().encode(JSON.stringify(value)), true);
  return [
    part({ alg: "HS256", typ: "JWT" }),
    part({
      sub: "user_123",
      name: "Kaf",
      iss: "tools.tyranny.me",
      aud: "developer",
      iat: now,
      nbf: now,
      exp: now + 3600,
      jti: "example",
    }),
    "ZXhhbXBsZQ",
  ].join(".");
}

function relative(seconds: number, now: number) {
  const difference = seconds - now / 1000;
  const absolute = Math.abs(difference);
  // Pick the unit from the rounded value, so 3599 seconds reads as 1 hour, not 60 minutes.
  const [unit, size] =
    Math.round(absolute / 60) < 1
      ? (["second", 1] as const)
      : Math.round(absolute / 60) < 60
        ? (["minute", 60] as const)
        : Math.round(absolute / 3600) < 24
          ? (["hour", 3600] as const)
          : (["day", 86400] as const);
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round(difference / size),
    unit,
  );
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "long" });

function decodeToken(source: string) {
  if (source.length > 1_000_000) throw new Error("Use a token up to 1 million characters.");
  const parts = source.trim().split(".");
  if (parts.length === 5)
    throw new Error("This is an encrypted token (JWE). Only signed tokens (JWS) can be decoded.");
  if (parts.length !== 3)
    throw new Error("A JWT has three parts separated by dots: header.payload.signature.");
  const decode = (part: string, name: string): Record<string, unknown> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64(part, true)),
      );
    } catch {
      throw new Error(
        `The ${name} is not Base64url-encoded JSON. Check that the token is complete.`,
      );
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error(`The ${name} must be a JSON object.`);
    return parsed as Record<string, unknown>;
  };
  const header = decode(parts[0]!, "header");
  const payload = decode(parts[1]!, "payload");
  try {
    decodeBase64(parts[2]!, true);
  } catch {
    throw new Error("The signature is not Base64url. Check that the token is complete.");
  }
  return { header, payload };
}

function Status({ payload, now }: { payload: Record<string, unknown>; now: number | null }) {
  const { exp, nbf } = payload;
  if (now === null) return null;
  const seconds = now / 1000;
  const [Icon, text, bad] =
    typeof exp === "number" && exp <= seconds
      ? [CircleX, `Expired ${relative(exp, now)}`, true]
      : typeof nbf === "number" && nbf > seconds
        ? [Clock, `Not valid until ${relative(nbf, now)}`, true]
        : typeof exp === "number"
          ? [CircleCheck, `Expires ${relative(exp, now)}`, false]
          : [CircleCheck, "Never expires", false];
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-base font-medium",
        bad ? "text-destructive" : "text-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {text}
    </p>
  );
}

export default function JwtTool() {
  const [source, setSource] = useState("");
  const now = useNow();
  const result = useMemo(() => {
    if (!source.trim()) return null;
    try {
      return { ...decodeToken(source), error: "" };
    } catch (cause) {
      return {
        header: null,
        payload: null,
        error: cause instanceof Error ? cause.message : "Unable to decode this token.",
      };
    }
  }, [source]);
  const known = result?.payload
    ? Object.entries(result.payload).filter(([key]) => Object.hasOwn(claims, key))
    : [];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <FieldLabel htmlFor="jwt-source">Token</FieldLabel>
          {source && (
            <Button variant="ghost" onClick={() => setSource("")}>
              Clear
            </Button>
          )}
        </div>
        <Textarea
          id="jwt-source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.signature"
          className="h-28 field-sizing-fixed font-mono break-all"
          spellCheck={false}
          aria-invalid={!!result?.error || undefined}
          aria-describedby="jwt-status"
        />
        <div id="jwt-status" aria-live="polite">
          <ErrorMessage>{result?.error}</ErrorMessage>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          The signature is not verified, so treat the claims as unconfirmed.
        </p>
      </div>

      {!source.trim() && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRound aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Paste a token to decode it</EmptyTitle>
            <EmptyDescription>
              See its header, claims, and when it expires. Nothing leaves this page.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => setSource(example())}>
              Try an example
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {result?.header && result.payload && (
        <div className={cn("space-y-6", enter)}>
          <Card>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Status payload={result.payload} now={now} />
                {typeof result.header.alg === "string" && (
                  <p className="text-sm text-muted-foreground">
                    Signed with <span className="font-mono">{result.header.alg}</span>
                  </p>
                )}
              </div>
              {known.length > 0 && (
                <dl className="divide-y border-t">
                  {known.map(([key, value]) => {
                    const temporal = key === "exp" || key === "iat" || key === "nbf";
                    const date =
                      temporal && typeof value === "number" && Number.isFinite(value)
                        ? new Date(value * 1000)
                        : null;
                    const validDate = date && !Number.isNaN(date.getTime());
                    return (
                      <div key={key} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                        <dt className="text-sm text-muted-foreground">
                          {claims[key]} <code className="text-xs">{key}</code>
                        </dt>
                        <dd className="min-w-0 text-sm">
                          {temporal ? (
                            validDate ? (
                              <>
                                <span>{dateFormat.format(date)}</span>
                                {now !== null && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    · {relative(value as number, now)}
                                  </span>
                                )}
                              </>
                            ) : (
                              <ErrorMessage>
                                {`${JSON.stringify(value)} is not a date. Expected Unix seconds.`}
                              </ErrorMessage>
                            )
                          ) : (
                            <span className="font-mono break-all">
                              {typeof value === "string" ? value : JSON.stringify(value)}
                            </span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {(
              [
                ["Header", result.header],
                ["Payload", result.payload],
              ] as const
            ).map(([name, data]) => {
              const json = JSON.stringify(data, null, 2);
              return (
                <section key={name} className="min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-medium">{name}</h2>
                    <CopyButton name={name.toLowerCase()} text={json} />
                  </div>
                  <pre className="max-h-96 overflow-auto overscroll-contain rounded-lg border bg-muted/30 p-4 font-mono text-sm">
                    {json}
                  </pre>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
