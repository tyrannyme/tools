export const colors = [
  ["0", "black", "#000000"],
  ["1", "dark_blue", "#0000aa"],
  ["2", "dark_green", "#00aa00"],
  ["3", "dark_aqua", "#00aaaa"],
  ["4", "dark_red", "#aa0000"],
  ["5", "dark_purple", "#aa00aa"],
  ["6", "gold", "#ffaa00"],
  ["7", "gray", "#aaaaaa"],
  ["8", "dark_gray", "#555555"],
  ["9", "blue", "#5555ff"],
  ["a", "green", "#55ff55"],
  ["b", "aqua", "#55ffff"],
  ["c", "red", "#ff5555"],
  ["d", "light_purple", "#ff55ff"],
  ["e", "yellow", "#ffff55"],
  ["f", "white", "#ffffff"],
] as const;
export const decorations = {
  k: "obfuscated",
  l: "bold",
  m: "strikethrough",
  n: "underlined",
  o: "italic",
} as const;
type Decoration = (typeof decorations)[keyof typeof decorations];
export type TextRun = { text: string; color: string } & Partial<Record<Decoration, boolean>>;
const plain = (): Omit<TextRun, "text"> => ({ color: "white" });
export function parseText(input: string, mini = false): TextRun[] {
  const runs: TextRun[] = [];
  let state = plain();
  let text = "";
  const stack: { name: string; state: Omit<TextRun, "text"> }[] = [];
  const flush = () => {
    if (text) runs.push({ ...state, text });
    text = "";
  };
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    if (mini && char === "\\" && ["<", "\\"].includes(input[i + 1] ?? "")) {
      text += input[++i];
      continue;
    }
    if (mini && char === "<") {
      const end = input.indexOf(">", i);
      if (end < 0)
        throw new Error(
          "Close the MiniMessage tag with >, or escape a literal < with a backslash.",
        );
      const tag = input.slice(i + 1, end).toLowerCase();
      flush();
      if (tag === "reset") {
        state = plain();
        stack.length = 0;
      } else if (tag === "newline" || tag === "br") text += "\n";
      else if (tag.startsWith("/")) {
        const index = stack.map((item) => item.name).lastIndexOf(tag.slice(1));
        if (index < 0) throw new Error(`No opening tag for <${tag}>.`);
        state = stack[index]!.state;
        stack.splice(index);
      } else {
        const name = tag.replace(/^color:/, "");
        const aliases: Record<string, string> = {
          b: "bold",
          i: "italic",
          em: "italic",
          u: "underlined",
          st: "strikethrough",
          obf: "obfuscated",
        };
        const decoration = aliases[name] ?? name;
        stack.push({ name: tag, state: { ...state } });
        if (colors.some((color) => color[1] === name) || /^#[0-9a-f]{6}$/.test(name))
          state = { ...state, color: name };
        else if (Object.values(decorations).includes(decoration as Decoration))
          state = { ...state, [decoration]: true };
        else
          throw new Error(
            `Unsupported tag <${tag}>. Use named or hex colors, bold, italic, underlined, strikethrough, obfuscated, reset, or newline.`,
          );
      }
      i = end;
      continue;
    }
    if (!mini && (char === "§" || char === "&")) {
      const rest = input.slice(i);
      const hex = rest.match(/^[§&]x(?:[§&][0-9a-f]){6}/i);
      if (hex) {
        flush();
        state = { color: `#${hex[0].slice(2).replace(/[§&]/g, "")}` };
        i += hex[0].length - 1;
        continue;
      }
      const code = input[i + 1]?.toLowerCase();
      if (code && /^[0-9a-fklmnor]$/.test(code)) {
        flush();
        const color = colors.find((item) => item[0] === code);
        if (color) state = { color: color[1] };
        else if (code === "r") state = plain();
        else state = { ...state, [decorations[code as keyof typeof decorations]]: true };
        i++;
        continue;
      }
    }
    text += char;
  }
  flush();
  return runs;
}
export function legacy(runs: TextRun[], prefix = "§") {
  let previous: TextRun | undefined;
  return runs
    .map((run) => {
      const color = colors.find((item) => item[1] === run.color);
      const code = color
        ? prefix + color[0]
        : prefix +
          "x" +
          run.color
            .slice(1)
            .split("")
            .map((char) => prefix + char)
            .join("");
      // Java resets styles on a color code, but Bedrock does not, so reset only
      // when the previous run had a style this one drops.
      const before = previous;
      const reset = Object.values(decorations).some((name) => before?.[name] && !run[name]);
      previous = run;
      return (
        (reset ? prefix + "r" : "") +
        code +
        Object.entries(decorations)
          .filter(([, name]) => run[name])
          .map(([key]) => prefix + key)
          .join("") +
        run.text
      );
    })
    .join("");
}
export function miniMessage(runs: TextRun[]) {
  return runs
    .map((run) => {
      const tags = [run.color, ...Object.values(decorations).filter((name) => run[name])];
      return (
        tags.map((tag) => `<${tag}>`).join("") +
        run.text.replace(/\\/g, "\\\\").replace(/</g, "\\<") +
        [...tags]
          .reverse()
          .map((tag) => `</${tag}>`)
          .join("")
      );
    })
    .join("");
}
export function jsonText(runs: TextRun[]) {
  return { text: "", italic: false, ...(runs.length ? { extra: runs } : {}) };
}
export function McText({ runs }: { runs: TextRun[] }) {
  return runs.map((run, index) => (
    <span
      key={index}
      title={run.obfuscated ? "Obfuscated in Minecraft" : undefined}
      style={{
        color: colors.find((color) => color[1] === run.color)?.[2] ?? run.color,
        fontWeight: run.bold ? 700 : 400,
        fontStyle: run.italic ? "italic" : "normal",
        textDecoration: [
          run.underlined ? "underline" : "",
          run.strikethrough ? "line-through" : "",
        ].join(" "),
      }}
    >
      {run.obfuscated ? run.text.replace(/\S/g, "▒") : run.text}
    </span>
  ));
}
/** Text shadow Minecraft draws under chat and menu text, one pixel down and right. */
export const mcShadow = { textShadow: "0.125em 0.125em 0 rgb(0 0 0 / 0.6)" };
export function MinecraftPreview({ runs, label }: { runs: TextRun[]; label: string }) {
  return (
    <figure
      aria-label={label}
      className="min-h-32 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 p-6 font-mono text-lg leading-relaxed break-words whitespace-pre-wrap text-white"
      style={mcShadow}
    >
      <McText runs={runs} />
    </figure>
  );
}
