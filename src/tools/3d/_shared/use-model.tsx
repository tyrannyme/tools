import { useEffect, useRef, useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { FileDrop } from "@/components/file-drop";
import { Button } from "@/components/ui/button";
import { Pending } from "./controls";
import { disposeModel, loadModel, modelAccept, sampleModel, type Model } from "./models";

/** `locked` keeps the current model in place, for example while a video records. */
export function useModel(locked = false) {
  const hydrated = useHydrated();
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const version = useRef(0);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (model) disposeModel(model.object);
    },
    [model],
  );
  async function open(files: File[]) {
    if (locked) return;
    const current = ++version.current;
    const primary = files.find((file) => /\.(gltf|glb|obj|stl|ply|fbx)$/i.test(file.name));
    setOpening(primary?.name ?? files[0]?.name ?? "model");
    setError("");
    try {
      const result = await loadModel(files);
      if (current === version.current) setModel(result);
      else disposeModel(result.object);
    } catch (error) {
      if (current === version.current)
        setError(error instanceof Error ? error.message : "Unable to open this model.");
    } finally {
      if (current === version.current) setOpening(null);
    }
  }
  const busy = opening !== null;
  const input = (
    <fieldset disabled={!hydrated || locked} className="min-w-0" data-ready={hydrated}>
      <FileDrop
        onFiles={open}
        multiple
        accept={modelAccept}
        title={model ? "Drop another model" : "Drop a model"}
        hint={
          model
            ? "GLB, glTF, OBJ, STL, PLY, or FBX"
            : "GLB, glTF, OBJ, STL, PLY, or FBX, with any textures and .bin files it uses"
        }
        compact={!!model}
        className={model ? "max-sm:[&_p]:hidden" : undefined}
      >
        {busy ? (
          <Pending>Opening {opening}</Pending>
        ) : (
          <Button
            variant="outline"
            disabled={!hydrated || locked}
            onClick={() => {
              version.current++;
              setError("");
              setModel(sampleModel());
            }}
          >
            Try a sample
          </Button>
        )}
      </FileDrop>
    </fieldset>
  );
  return { model, input, error, setError, busy };
}
