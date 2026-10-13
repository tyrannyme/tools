export interface Edit {
  before: string;
  after: string;
  decision: "accept" | "reject";
}
export type DiffPart = { text: string } | Edit;

/** A word diff preserves whitespace and gives each independent correction a decision. */
export function diffWords(original: string, corrected: string): DiffPart[] {
  const tokenize = (text: string) => text.match(/\s+|[\p{L}\p{N}_]+|[^\s]/gu) ?? [];
  const left = tokenize(original);
  const right = tokenize(corrected);
  if (left.length * right.length > 4_000_000) {
    return original === corrected
      ? [{ text: original }]
      : [{ before: original, after: corrected, decision: "accept" }];
  }
  const width = right.length + 1;
  const table = new Uint16Array((left.length + 1) * width);
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      table[i * width + j] =
        left[i] === right[j]
          ? 1 + table[(i + 1) * width + j + 1]
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  let i = 0,
    j = 0;
  function add(kind: "text" | "before" | "after", value: string) {
    const last = parts[parts.length - 1];
    if (kind === "text") {
      if (last && "text" in last) last.text += value;
      else parts.push({ text: value });
    } else if (last && "before" in last) last[kind] += value;
    else
      parts.push({
        before: kind === "before" ? value : "",
        after: kind === "after" ? value : "",
        decision: "accept",
      });
  }
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      add("text", left[i++]);
      j++;
    } else if (
      j < right.length &&
      (i === left.length || table[i * width + j + 1] > table[(i + 1) * width + j])
    )
      add("after", right[j++]);
    else add("before", left[i++]);
  }
  const grouped: DiffPart[] = [];
  for (const part of parts) {
    const gap = grouped[grouped.length - 1];
    const previous = grouped[grouped.length - 2];
    if (
      "before" in part &&
      gap &&
      "text" in gap &&
      /^\s+$/.test(gap.text) &&
      previous &&
      "before" in previous
    ) {
      previous.before += gap.text + part.before;
      previous.after += gap.text + part.after;
      grouped.pop();
    } else grouped.push(part);
  }
  return grouped;
}
export function resolvedText(parts: DiffPart[]) {
  return parts
    .map((part) =>
      "text" in part ? part.text : part.decision === "accept" ? part.after : part.before,
    )
    .join("");
}
