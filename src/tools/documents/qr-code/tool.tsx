import { Download, QrCode, TriangleAlert } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { QrCodeGenerateOptions } from "uqr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Choice, saveFile } from "../_shared/controls";
import { contactPayload, contrastRatio, generateQr, wifiPayload } from "./qr";

type FieldName = "url" | "email" | "size" | "quiet" | "foreground" | "background";

/** Either a code, a problem with one field, or a prompt for missing content. */
type Result =
  | { qr: ReturnType<typeof generateQr>; payload: string }
  | { field: FieldName; error: string }
  | { prompt: string };

const hexColor = /^#[0-9a-f]{6}$/i;

/** Accepts "tyranny.me" as well as full URLs. */
function normalizeUrl(value: string) {
  const trimmed = value.trim();
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withScheme);
  if (!["https:", "http:"].includes(parsed.protocol) || !parsed.hostname) throw new Error();
  return withScheme;
}

/** "Guest Wi-Fi" -> "qr-guest-wi-fi.png". */
function fileName(label: string, extension: string) {
  const slug = label
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[^a-z\d]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `qr${slug ? `-${slug}` : ""}.${extension}`;
}

export default function QrCodeTool() {
  const [kind, setKind] = useState("url");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("https://tyranny.me");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState("WPA");
  const [hidden, setHidden] = useState(false);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", organization: "" });
  const [ecc, setEcc] = useState("M");
  const [size, setSize] = useState("512");
  const [quiet, setQuiet] = useState("4");
  const [foreground, setForeground] = useState("#000000");
  const [background, setBackground] = useState("#ffffff");
  const [downloadError, setDownloadError] = useState("");
  const [busy, setBusy] = useState(false);

  const label =
    kind === "url" ? url : kind === "wifi" ? ssid : kind === "contact" ? contact.name : "text";

  const result = useMemo((): Result => {
    let payload = text;
    if (kind === "url") {
      if (!url.trim()) return { prompt: "Enter a URL to make a code." };
      try {
        payload = normalizeUrl(url);
      } catch {
        return { field: "url", error: "Enter a web address, such as tyranny.me/tools." };
      }
    } else if (kind === "wifi") {
      if (!ssid) return { prompt: "Enter the network name to make a code." };
      if (security !== "nopass" && !password)
        return { prompt: "Enter the password, or set Security to Open network." };
      payload = wifiPayload(ssid, password, security, hidden);
    } else if (kind === "contact") {
      if (contact.email && !/^\S+@\S+\.\S+$/.test(contact.email.trim()))
        return { field: "email", error: "Enter an email such as name@example.com." };
      if (!contact.name.trim()) return { prompt: "Enter a name to make a contact card." };
      payload = contactPayload(
        contact.name.trim(),
        contact.phone.trim(),
        contact.email.trim(),
        contact.organization.trim(),
      );
    } else if (!payload) return { prompt: "Enter text to make a code." };

    if (!Number.isInteger(Number(size)) || Number(size) < 128 || Number(size) > 4096)
      return { field: "size", error: "Enter a whole number from 128 to 4096." };
    if (
      quiet.trim() === "" ||
      !Number.isInteger(Number(quiet)) ||
      Number(quiet) < 0 ||
      Number(quiet) > 16
    )
      return { field: "quiet", error: "Enter a whole number from 0 to 16." };
    if (!hexColor.test(foreground))
      return { field: "foreground", error: "Enter a hex color such as #000000." };
    if (!hexColor.test(background))
      return { field: "background", error: "Enter a hex color such as #ffffff." };

    let qr;
    try {
      qr = generateQr(
        payload,
        ecc as QrCodeGenerateOptions["ecc"],
        Number(quiet),
        Number(size),
        foreground,
        background,
      );
    } catch {
      return {
        prompt:
          ecc === "L"
            ? "This is too long for a QR code. Shorten it to make a code."
            : "This is too long at this error correction. Shorten it or choose a lower level.",
      };
    }
    if (Number(size) < qr.modules * 2)
      return {
        field: "size",
        error: `This code needs at least ${qr.modules * 2} px. Increase the size or shorten the content.`,
      };
    return { qr, payload };
  }, [
    kind,
    text,
    url,
    ssid,
    password,
    security,
    hidden,
    contact,
    ecc,
    size,
    quiet,
    foreground,
    background,
  ]);

  const qr = "qr" in result ? result.qr : null;
  const described =
    kind === "url"
      ? "qr" in result
        ? result.payload
        : url
      : kind === "wifi"
        ? `the ${ssid} Wi-Fi network`
        : kind === "contact"
          ? `${contact.name}'s contact card`
          : "your text";
  const errorFor = (field: FieldName) =>
    "field" in result && result.field === field ? result.error : "";
  const lowContrast =
    hexColor.test(foreground) && hexColor.test(background)
      ? contrastRatio(foreground, background) < 4.5
      : false;
  // Many scanners only read dark modules on a light background.
  const inverted =
    hexColor.test(foreground) &&
    hexColor.test(background) &&
    contrastRatio(foreground, "#ffffff") < contrastRatio(background, "#ffffff");
  const warning = !qr
    ? ""
    : lowContrast
      ? "Low contrast. Some phones may not scan this code."
      : inverted
        ? "Light on dark. Some scanners only read dark codes on a light background."
        : Number(quiet) < 4
          ? "Quiet zone under 4. Leave clear space around the code when you print it."
          : "";

  async function downloadPng() {
    if (!qr) return;
    setDownloadError("");
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = Number(size);
      canvas.height = Number(size);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error();
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = foreground;
      const scale = canvas.width / qr.modules;
      qr.matrix.forEach((row, y) =>
        row.forEach((filled, x) => {
          if (filled)
            ctx.fillRect(
              Math.round(x * scale),
              Math.round(y * scale),
              Math.round((x + 1) * scale) - Math.round(x * scale),
              Math.round((y + 1) * scale) - Math.round(y * scale),
            );
        }),
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error())), "image/png"),
      );
      saveFile(blob, fileName(label, "png"), `${size} × ${size} px`);
    } catch {
      setDownloadError("The PNG could not be created. Try a smaller size, or download the SVG.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr]">
      <div className="min-w-0 space-y-5">
        <Choice
          label="Content"
          value={kind}
          onChange={setKind}
          options={[
            { value: "url", label: "Link" },
            { value: "text", label: "Text" },
            { value: "wifi", label: "Wi-Fi network" },
            { value: "contact", label: "Contact card" },
          ]}
        />
        {kind === "url" && (
          <Field data-invalid={!!errorFor("url") || undefined}>
            <FieldLabel htmlFor="qr-url">URL</FieldLabel>
            <Input
              id="qr-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://example.com"
              value={url}
              aria-invalid={!!errorFor("url")}
              aria-describedby="qr-url-error"
              onChange={(event) => setUrl(event.target.value)}
            />
            <FieldError id="qr-url-error">{errorFor("url")}</FieldError>
          </Field>
        )}
        {kind === "text" && (
          <Field>
            <FieldLabel htmlFor="qr-text">Text</FieldLabel>
            <Textarea
              id="qr-text"
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </Field>
        )}
        {kind === "wifi" && (
          <div className="space-y-5">
            <Field>
              <FieldLabel htmlFor="qr-ssid">Network name (SSID)</FieldLabel>
              <Input
                id="qr-ssid"
                autoComplete="off"
                value={ssid}
                onChange={(event) => setSsid(event.target.value)}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Choice
                label="Security"
                value={security}
                onChange={setSecurity}
                options={[
                  { value: "WPA", label: "WPA, WPA2, WPA3" },
                  { value: "WEP", label: "WEP" },
                  { value: "nopass", label: "Open network" },
                ]}
              />
              {security !== "nopass" && (
                <Field>
                  <FieldLabel htmlFor="qr-password">Password</FieldLabel>
                  <Input
                    id="qr-password"
                    type="password"
                    autoComplete="off"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>
              )}
            </div>
            <Field orientation="horizontal">
              <Checkbox id="qr-hidden" checked={hidden} onCheckedChange={setHidden} />
              <FieldLabel htmlFor="qr-hidden">Hidden network</FieldLabel>
            </Field>
          </div>
        )}
        {kind === "contact" && (
          <div className="grid gap-5 sm:grid-cols-2">
            {(
              [
                { key: "name", label: "Name", type: "text", autoComplete: "name" },
                {
                  key: "organization",
                  label: "Organization",
                  type: "text",
                  autoComplete: "organization",
                },
                { key: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
                { key: "email", label: "Email", type: "email", autoComplete: "email" },
              ] as const
            ).map(({ key, label, type, autoComplete }) => (
              <Field key={key} data-invalid={(key === "email" && !!errorFor("email")) || undefined}>
                <FieldLabel htmlFor={`qr-${key}`}>{label}</FieldLabel>
                <Input
                  id={`qr-${key}`}
                  type={type}
                  autoComplete={autoComplete}
                  value={contact[key]}
                  aria-invalid={key === "email" && !!errorFor("email")}
                  aria-describedby={key === "email" ? "qr-email-error" : undefined}
                  onChange={(event) =>
                    setContact((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
                {key === "email" && (
                  <FieldError id="qr-email-error">{errorFor("email")}</FieldError>
                )}
              </Field>
            ))}
          </div>
        )}
      </div>

      <Card className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-3 lg:row-start-1">
        <CardContent className="space-y-4">
          <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted/50 p-6 sm:p-8">
            {qr ? (
              <img
                src={`data:image/svg+xml,${encodeURIComponent(qr.svg)}`}
                alt={`QR code for ${described}`}
                width={qr.modules * 8}
                height={qr.modules * 8}
                className="size-full max-w-96 rounded-sm shadow-sm ring-1 ring-black/10 [image-rendering:pixelated] dark:ring-white/10"
              />
            ) : (
              <div className="flex max-w-60 flex-col items-center gap-3 text-center text-sm text-muted-foreground">
                <QrCode className="size-8 opacity-50" aria-hidden="true" />
                <output className="block">
                  {"prompt" in result
                    ? result.prompt
                    : "Fix the highlighted field to see the code."}
                </output>
              </div>
            )}
          </div>
          {warning && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {warning}
            </p>
          )}
          <FieldError>{downloadError}</FieldError>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" disabled={!qr || busy} onClick={downloadPng}>
              {busy ? <Spinner aria-hidden="true" /> : <Download aria-hidden="true" />}
              Download PNG
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={!qr}
              onClick={() => {
                if (qr)
                  saveFile(
                    new Blob([qr.svg], { type: "image/svg+xml" }),
                    fileName(label, "svg"),
                    "Scales to any size",
                  );
              }}
            >
              <Download aria-hidden="true" />
              Download SVG
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Static code: it never expires and works without this site.
          </p>
        </CardContent>
      </Card>

      <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-5 lg:border-t lg:pt-8">
        <ColorField
          label="Code color"
          value={foreground}
          onChange={setForeground}
          error={errorFor("foreground")}
        />
        <ColorField
          label="Background"
          value={background}
          onChange={setBackground}
          error={errorFor("background")}
        />
        <Choice
          label="Error correction"
          value={ecc}
          onChange={setEcc}
          options={[
            { value: "L", label: "Low (7%)" },
            { value: "M", label: "Medium (15%)" },
            { value: "Q", label: "Quartile (25%)" },
            { value: "H", label: "High (30%)" },
          ]}
        />
        <NumberField
          id="qr-size"
          label="PNG size (px)"
          value={size}
          min={128}
          max={4096}
          onChange={setSize}
          error={errorFor("size")}
        />
        <NumberField
          id="qr-quiet"
          label="Quiet zone (modules)"
          value={quiet}
          min={0}
          max={16}
          onChange={setQuiet}
          error={errorFor("quiet")}
          className="col-span-2"
          description="The clear border scanners need. 4 is the standard."
        />
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string;
}) {
  const id = useId();
  return (
    <Field data-invalid={!!error || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={hexColor.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="size-8 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-1 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <Input
          id={id}
          value={value}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          className="font-mono uppercase"
          aria-invalid={!!error}
          aria-describedby={`${id}-error`}
          onChange={(event) => {
            const next = event.target.value.trim();
            onChange(next.startsWith("#") ? next : `#${next}`);
          }}
        />
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
  error,
  description,
  className,
}: {
  id: string;
  label: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
  error: string;
  description?: string;
  className?: string;
}) {
  return (
    <Field data-invalid={!!error || undefined} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-invalid={!!error}
        aria-describedby={`${id}-help ${id}-error`}
        onChange={(event) => onChange(event.target.value)}
      />
      {description && !error && (
        <FieldDescription id={`${id}-help`}>{description}</FieldDescription>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  );
}
