import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import favicon from "../public/favicon.png?inline";
import "@/styles.css";

const sampleDoor = document.getElementById("sample-source")?.getAttribute("src") ?? "";

const limits = [
  { label: "Under 2 MB", value: "2" },
  { label: "Under 1 MB", value: "1" },
  { label: "Under 500 KB", value: "0.5" },
];
const formats = [
  { label: "JPEG", value: "JPEG" },
  { label: "WebP", value: "WebP" },
  { label: "PNG", value: "PNG" },
];

function ImageResizeProposal() {
  const [loaded, setLoaded] = useState(true);
  const [library, setLibrary] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [limit, setLimit] = useState<string | null>("2");
  const [format, setFormat] = useState<string | null>("JPEG");
  const [width, setWidth] = useState("512");
  const [height, setHeight] = useState("512");
  const [locked, setLocked] = useState(true);
  const [message, setMessage] = useState("");

  function showImage(checked: boolean) {
    setLoaded(checked);
    setMessage("");
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">Layout preview · illustrative file details</p>
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor="sample-image">Sample image</FieldLabel>
          <Switch id="sample-image" checked={loaded} onCheckedChange={showImage} />
        </Field>
      </div>
      <div className="rounded-xl bg-background p-4 text-foreground sm:p-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 font-semibold">
            <img src={favicon} alt="" width={28} height={28} />
            Tools
          </div>
          <Button
            variant="link"
            nativeButton={false}
            render={
              <a
                href="https://tyranny.me"
                aria-label="Tyranny’s website"
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            by Tyranny
          </Button>
        </header>
        <Separator className="mt-5" />
        <main className="mx-auto max-w-md py-8">
          {library ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
                <p className="text-sm text-muted-foreground">
                  Useful things, right in your browser.
                </p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Image resize</CardTitle>
                  <CardDescription>Make an image fit a file size limit.</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button variant="outline" onClick={() => setLibrary(false)}>
                    Open tool <ArrowRight aria-hidden="true" />
                  </Button>
                </CardFooter>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              <Button variant="ghost" onClick={() => setLibrary(true)}>
                <ArrowLeft aria-hidden="true" /> All tools
              </Button>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Image resize</h1>
                <p className="text-sm text-muted-foreground">
                  Make an image fit a file size limit.
                </p>
              </div>
              <Card>
                <CardContent>
                  {loaded ? (
                    <div className="space-y-5">
                      <div className="flex items-center gap-4">
                        <img
                          src={sampleDoor}
                          alt="Tyranny's stone doorway"
                          width={72}
                          height={80}
                          className="h-20 w-18 rounded-md bg-muted object-contain"
                        />
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium">door.png</p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            1,024 × 1,024 · 2.6 MB
                          </p>
                          <Button variant="ghost" size="sm" onClick={() => showImage(false)}>
                            Change image
                          </Button>
                        </div>
                      </div>
                      <Field>
                        <FieldLabel htmlFor="file-limit">File size limit</FieldLabel>
                        <Select
                          items={limits}
                          value={limit}
                          onValueChange={(value) => {
                            setLimit(value);
                            setMessage("");
                          }}
                        >
                          <SelectTrigger id="file-limit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {limits.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldDescription>
                          Keep as much image quality as the limit allows.
                        </FieldDescription>
                      </Field>
                      <Separator />
                      <Collapsible open={expanded} onOpenChange={setExpanded}>
                        <CollapsibleTrigger render={<Button variant="ghost" />}>
                          <ChevronDown
                            aria-hidden="true"
                            className={expanded ? "rotate-180" : ""}
                          />
                          Dimensions and format
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <FieldGroup className="pt-5">
                            <div className="grid grid-cols-2 gap-4">
                              <Field>
                                <FieldLabel htmlFor="image-width">Width</FieldLabel>
                                <Input
                                  id="image-width"
                                  type="number"
                                  min={1}
                                  max={16384}
                                  value={width}
                                  onChange={(event) => {
                                    setWidth(event.target.value);
                                    if (locked) setHeight(event.target.value);
                                    setMessage("");
                                  }}
                                />
                              </Field>
                              <Field>
                                <FieldLabel htmlFor="image-height">Height</FieldLabel>
                                <Input
                                  id="image-height"
                                  type="number"
                                  min={1}
                                  max={16384}
                                  value={height}
                                  onChange={(event) => {
                                    setHeight(event.target.value);
                                    if (locked) setWidth(event.target.value);
                                    setMessage("");
                                  }}
                                />
                              </Field>
                            </div>
                            <Field orientation="horizontal">
                              <Checkbox
                                id="keep-ratio"
                                checked={locked}
                                onCheckedChange={setLocked}
                              />
                              <FieldLabel htmlFor="keep-ratio">Keep aspect ratio</FieldLabel>
                            </Field>
                            <Field>
                              <FieldLabel htmlFor="image-format">Format</FieldLabel>
                              <Select
                                items={formats}
                                value={format}
                                onValueChange={(value) => {
                                  setFormat(value);
                                  setMessage("");
                                }}
                              >
                                <SelectTrigger id="image-format">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {formats.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                          </FieldGroup>
                        </CollapsibleContent>
                      </Collapsible>
                      {message && (
                        <output className="block text-sm" aria-live="polite">
                          {message}
                        </output>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-8 text-center">
                      <div className="space-y-1">
                        <p className="font-medium">Choose an image</p>
                        <p className="text-sm text-muted-foreground">PNG, JPEG, or WebP</p>
                      </div>
                      <Button onClick={() => showImage(true)}>Choose image</Button>
                    </div>
                  )}
                </CardContent>
                {loaded && (
                  <CardFooter className="flex-wrap justify-between gap-4">
                    <div>
                      <p className="font-medium">Ready to resize</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {width} × {height} · {format}
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        setMessage("Preview only. The resized file will download here.")
                      }
                    >
                      Resize image
                    </Button>
                  </CardFooter>
                )}
              </Card>
              <p className="text-center text-xs text-muted-foreground">
                Your image stays on your device.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const container = document.getElementById("tools-proposal");
if (container) createRoot(container).render(<ImageResizeProposal />);
