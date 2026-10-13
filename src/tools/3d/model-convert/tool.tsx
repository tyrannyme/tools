import { useState } from "react";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { PLYExporter } from "three/examples/jsm/exporters/PLYExporter.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { renameExtension } from "@/lib/files";
import { Choice, ErrorMessage, enter, saveFile } from "../_shared/controls";
import { Studio } from "../_shared/studio";
import { useModel } from "../_shared/use-model";

const label = (format: string) => (format === "gltf" ? "glTF" : format.toUpperCase());
const notes: Record<string, string> = {
  glb: "A single binary file with geometry, materials, embedded textures, and supported animation clips.",
  gltf: "JSON glTF with embedded buffers and textures. Keeps materials and supported animation clips.",
  obj: "Geometry, normals, and UVs only. This export does not include an MTL file, textures, or animations.",
  stl: "Binary triangle geometry only. Materials, colors, textures, and animations are discarded. Units are not stored.",
  ply: "Geometry, normals, UVs, and existing vertex colors. No material textures or animations.",
};
export default function ModelConvert() {
  const { model, input, error, setError } = useModel();
  const [format, setFormat] = useState("glb"),
    [exporting, setExporting] = useState(false);
  async function convert() {
    if (!model) return;
    setExporting(true);
    setError("");
    // Exporters run on the main thread. Let the button show its pending state first.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    try {
      model.object.updateMatrixWorld(true);
      let blob: Blob;
      if (format === "obj")
        blob = new Blob([new OBJExporter().parse(model.object)], { type: "text/plain" });
      else if (format === "stl") {
        const data = new STLExporter().parse(model.object, { binary: true });
        blob = new Blob([new Uint8Array(data.buffer as ArrayBuffer)], {
          type: "application/octet-stream",
        });
      } else if (format === "ply") {
        const data = await new Promise<string>((resolve) =>
          new PLYExporter().parse(model.object, resolve),
        );
        blob = new Blob([data], { type: "application/octet-stream" });
      } else {
        const data = await new GLTFExporter().parseAsync(model.object, {
          binary: format === "glb",
          animations: model.animations,
        });
        blob = new Blob([data instanceof ArrayBuffer ? data : JSON.stringify(data)], {
          type: format === "glb" ? "model/gltf-binary" : "model/gltf+json",
        });
      }
      saveFile(blob, renameExtension(model.name, format));
    } catch (error) {
      setError(
        `Unable to convert to ${label(format)}${error instanceof Error ? `: ${error.message}` : "."} Try another format.`,
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="space-y-6">
      {input}
      <ErrorMessage error={error} />
      {model && (
        <div className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] ${enter}`}>
          <Studio object={model.object} />
          <div className="space-y-5">
            <p className="truncate font-medium" title={model.name}>
              {model.name}
            </p>
            <div className="space-y-2">
              <Choice
                label="Convert to"
                value={format}
                onChange={setFormat}
                options={Object.keys(notes).map((value) => ({ value, label: label(value) }))}
              />
              <p className="text-sm text-muted-foreground">{notes[format]}</p>
            </div>
            <Button className="w-full" disabled={exporting} onClick={convert}>
              {exporting ? <Spinner aria-hidden="true" /> : <Download aria-hidden="true" />}
              {exporting ? "Converting" : `Download ${label(format)}`}
            </Button>
            <p className="text-xs text-muted-foreground">
              Coordinates and scale are kept. Exports are not Draco compressed. KTX2 textures are
              not supported.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
