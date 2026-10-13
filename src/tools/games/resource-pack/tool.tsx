import { ChevronDown, Download, File, Folder } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { strToU8, zipSync } from "fflate";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { downloadBlob } from "@/lib/files";
import { Choice, CopyButton, ErrorMessage, Segmented } from "../_shared/controls";
import { png, useLocalImage } from "../_shared/images";
import { jsonText, mcShadow, McText, parseText } from "../_shared/minecraft";
import { ImagePicker } from "../_shared/source";
import { metadata, versions } from "./versions";

type Version = (typeof versions)[number];
const newer = (a: Version, b: Version) =>
  a.major > b.major || (a.major === b.major && a.minor > b.minor);
const find = (label: string) => versions.find((version) => version.label === label)!;
/** Keeps spaces and capitals, since Minecraft lists packs by file name. */
const fileName = (name: string) =>
  name
    // oxlint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f/\\:*?"<>|]+/g, "-")
    .replace(/^[.\s]+|[.\s]+$/g, "");

export default function ResourcePackTool() {
  const [name, setName] = useState("My resource pack");
  const [nameError, setNameError] = useState("");
  const [description, setDescription] = useState("&6A new look for your world.");
  const [minimum, setMinimum] = useState("26.3");
  const [maximum, setMaximum] = useState("26.3");
  const [filter, setFilter] = useState("nearest");
  const [busy, setBusy] = useState(false);
  const { source, load, clear, loading, error, setError } = useLocalImage();
  const icon = useRef<HTMLCanvasElement>(null);
  const low = find(minimum);
  const high = find(maximum);
  const runs = parseText(description);
  const mcmeta = JSON.stringify(metadata(jsonText(runs), low, high), null, 2);
  const letter = name.trim().charAt(0).toUpperCase();
  const zipName = `${fileName(name) || "resource-pack"}.zip`;

  // The canvas is both the preview and the exported pack.png.
  useEffect(() => {
    const context = icon.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, 128, 128);
    if (source) {
      const size = Math.min(source.image.width, source.image.height);
      context.imageSmoothingEnabled = filter === "smooth";
      context.imageSmoothingQuality = "high";
      context.drawImage(
        source.image,
        (source.image.width - size) / 2,
        (source.image.height - size) / 2,
        size,
        size,
        0,
        0,
        128,
        128,
      );
    } else {
      context.fillStyle = "#262626";
      context.fillRect(0, 0, 128, 128);
      context.fillStyle = "#ffffff";
      context.font = "bold 72px ui-monospace, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(letter, 64, 68);
    }
  }, [source, filter, letter]);

  async function download() {
    if (!name.trim()) {
      setNameError("Enter a pack name. It becomes the ZIP file name.");
      document.getElementById("pack-name")?.focus();
      return;
    }
    if (!icon.current) return;
    setError("");
    setBusy(true);
    try {
      const files: Record<string, Uint8Array> = {
        "pack.mcmeta": strToU8(mcmeta),
        "pack.png": new Uint8Array(await (await png(icon.current)).arrayBuffer()),
        "assets/minecraft/textures/block/": new Uint8Array(),
        "assets/minecraft/textures/item/": new Uint8Array(),
      };
      downloadBlob(
        new Blob([new Uint8Array(zipSync(files))], { type: "application/zip" }),
        zipName,
      );
      toast.success(`Downloaded ${zipName}`, {
        description:
          "Add textures under assets/minecraft, then put the pack in your resourcepacks folder.",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the ZIP. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const options = versions.map((version) => ({
    value: version.label,
    label: `Java ${version.label}`,
  }));
  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
      <div className="min-w-0 space-y-6">
        <Field data-invalid={!!nameError || undefined}>
          <FieldLabel htmlFor="pack-name">Pack name</FieldLabel>
          <Input
            id="pack-name"
            value={name}
            maxLength={100}
            aria-invalid={!!nameError || undefined}
            aria-describedby="pack-name-hint"
            onChange={(event) => {
              setName(event.target.value);
              setNameError("");
            }}
          />
          {nameError ? (
            <ErrorMessage id="pack-name-hint">{nameError}</ErrorMessage>
          ) : (
            <FieldDescription id="pack-name-hint">
              Minecraft lists packs by their file name.
            </FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="pack-description">Description</FieldLabel>
          <Textarea
            id="pack-description"
            value={description}
            maxLength={2048}
            spellCheck={false}
            aria-describedby="pack-description-hint"
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-20 font-mono"
          />
          <FieldDescription id="pack-description-hint">
            Format with <span className="font-mono">&amp;</span> or{" "}
            <span className="font-mono">§</span> codes, such as{" "}
            <span className="font-mono">&amp;6</span> for gold and{" "}
            <span className="font-mono">&amp;l</span> for bold.
          </FieldDescription>
        </Field>
        <div className="space-y-2">
          <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
            <Choice
              label="Oldest version"
              value={minimum}
              onChange={(value) => {
                setMinimum(value);
                if (newer(find(value), high)) setMaximum(value);
              }}
              options={options}
            />
            <Choice
              label="Newest version"
              value={maximum}
              onChange={(value) => {
                setMaximum(value);
                if (newer(low, find(value))) setMinimum(value);
              }}
              options={options}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            A range only declares support. Textures are not converted between versions.
          </p>
        </div>
        <ImagePicker
          source={source}
          loading={loading}
          error={error}
          title="Choose a pack icon"
          hint="Optional. Center-cropped to 128 × 128."
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
          onFile={(file) => void load(file)}
          onRemove={clear}
        />
        {source && (
          <Segmented
            label="Icon scaling"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "nearest", label: "Pixel art" },
              { value: "smooth", label: "Smooth" },
            ]}
          />
        )}
        <Button size="lg" disabled={busy} onClick={download}>
          {busy ? <Spinner /> : <Download aria-hidden="true" />}
          {busy ? "Creating ZIP…" : "Download resource pack"}
        </Button>
      </div>

      <div className="min-w-0 space-y-8">
        <figure
          aria-label="Pack list preview"
          className="flex items-start gap-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4 font-mono text-white"
          style={mcShadow}
        >
          <canvas
            ref={icon}
            width={128}
            height={128}
            aria-label="pack.png"
            className="size-16 shrink-0 [image-rendering:pixelated] sm:size-20"
          />
          <div className="min-w-0 space-y-1 leading-snug">
            <p className="truncate">{fileName(name) || "resource-pack"}</p>
            <p className="line-clamp-2 break-words whitespace-pre-wrap text-sm sm:text-base">
              <McText runs={runs} />
            </p>
          </div>
        </figure>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-mono text-sm font-medium">pack.mcmeta</h2>
            <CopyButton value={mcmeta} variant="ghost" size="sm" />
          </div>
          <pre className="max-h-80 overflow-auto overscroll-contain rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
            {mcmeta}
          </pre>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-medium">In the ZIP</h2>
          <ul className="space-y-1.5 rounded-lg border p-3 font-mono text-sm">
            {["pack.mcmeta", "pack.png"].map((file) => (
              <li key={file} className="flex items-center gap-2">
                <File className="size-4 text-muted-foreground" aria-hidden="true" />
                {file}
              </li>
            ))}
            {["block", "item"].map((folder) => (
              <li key={folder} className="flex min-w-0 items-center gap-2">
                <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">assets/minecraft/textures/{folder}/</span>
              </li>
            ))}
          </ul>
        </div>

        <Collapsible className="rounded-lg border">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Resource format by release
            <ChevronDown
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform duration-200 group-data-[panel-open]:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent keepMounted className="px-3 pb-3 text-sm data-[closed]:hidden">
            <table className="w-full text-left tabular-nums">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-normal">Java release</th>
                  <th className="py-1.5 font-normal">Resource format</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {versions.map((version) => (
                  <tr key={version.label}>
                    <td className="py-1.5">
                      <a
                        className="underline underline-offset-4 hover:text-muted-foreground"
                        href={`https://www.minecraft.net/en-us/article/minecraft-java-edition-${version.release}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {version.label}
                      </a>
                    </td>
                    <td className="py-1.5 font-mono">
                      {version.major}
                      {version.major >= 65 ? `.${version.minor}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-muted-foreground">
              Ranges reaching 1.21.9 or newer use min_format and max_format. Ranges reaching older
              releases also get pack_format and supported_formats.
            </p>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
