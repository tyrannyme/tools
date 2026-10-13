import { Download } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { renameExtension } from "@/lib/files";
import { Check, ErrorMessage, enter, saveFile } from "../_shared/controls";
import { modelStats } from "../_shared/models";
import { Studio, type StudioHandle } from "../_shared/studio";
import { useModel } from "../_shared/use-model";

const number = new Intl.NumberFormat("en");

export default function ModelViewer() {
  const { model, input, error, setError } = useModel();
  const [wireframe, setWireframe] = useState(false),
    [rotate, setRotate] = useState(false),
    [saving, setSaving] = useState(false);
  const studio = useRef<StudioHandle | null>(null);
  const stats = useMemo(() => (model ? modelStats(model.object) : null), [model]);

  async function screenshot() {
    if (!model || !studio.current) return;
    setSaving(true);
    setError("");
    try {
      saveFile(await studio.current.screenshot(), renameExtension(model.name, "png"));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to capture the preview.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {input}
      <ErrorMessage error={error} />
      {model && stats && (
        <div className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem] ${enter}`}>
          <div className="space-y-2">
            <Studio object={model.object} handle={studio} wireframe={wireframe} rotate={rotate} />
            <p className="text-xs text-muted-foreground">Drag to orbit. Scroll or pinch to zoom.</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="truncate font-medium" title={model.name}>
                {model.name}
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[
                  ["Triangles", number.format(stats.triangles)],
                  ["Vertices", number.format(stats.vertices)],
                  ["Materials", number.format(stats.materials)],
                  ["Textures", number.format(stats.textures)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Size in model units</dt>
                  <dd className="font-medium tabular-nums">
                    {stats.size
                      .toArray()
                      .map((value) => number.format(Number(value.toPrecision(4))))
                      .join(" × ")}
                  </dd>
                </div>
              </dl>
              {model.animations.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {model.animations.length === 1
                    ? "Has 1 animation clip. The preview shows the rest pose."
                    : `Has ${model.animations.length} animation clips. The preview shows the rest pose.`}
                </p>
              )}
            </div>
            <div className="space-y-3">
              <Check label="Wireframe" value={wireframe} onChange={setWireframe} />
              <Check label="Auto-rotate" value={rotate} onChange={setRotate} />
            </div>
            <Button variant="outline" disabled={saving} onClick={screenshot}>
              {saving ? <Spinner aria-hidden="true" /> : <Download aria-hidden="true" />}
              Save PNG
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
