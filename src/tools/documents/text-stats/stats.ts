/** Short English function words, left out of the frequency list when asked. */
const commonWords = new Set(
  (
    "a an and are as at be but by for from had has have he her his i if in into is it its me my " +
    "no not of on or our she so than that the their them then there they this to too us was we " +
    "were what when which who will with you your"
  ).split(" "),
);

export function textStats(text: string, skipCommon = false) {
  const trimmed = text.trim();
  const words = Array.from(new Intl.Segmenter("en", { granularity: "word" }).segment(text))
    .filter((segment) => segment.isWordLike)
    .map((segment) => segment.segment);
  const sentences = trimmed
    ? Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(trimmed)).filter(
        (segment) => /[\p{L}\p{N}]/u.test(segment.segment),
      ).length
    : 0;
  const frequencies = new Map<string, number>();
  for (const word of words) {
    const normalized = word.normalize("NFC").toLowerCase();
    if (skipCommon && commonWords.has(normalized)) continue;
    frequencies.set(normalized, (frequencies.get(normalized) ?? 0) + 1);
  }
  return {
    words: words.length,
    characters: graphemes(text),
    withoutSpaces: graphemes(text.replace(/\s/gu, "")),
    sentences,
    paragraphs: trimmed ? trimmed.split(/(?:\r?\n\s*){2,}/).length : 0,
    frequent: [...frequencies]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"))
      .slice(0, 10),
  };
}

export function duration(words: number, perMinute: number) {
  const seconds = Math.ceil((words / perMinute) * 60);
  if (seconds < 60) return `${seconds} sec`;
  return `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} sec` : ""}`;
}

/** Counts what a reader sees as characters, so an emoji or an accented letter is one. */
function graphemes(text: string) {
  let total = 0;
  for (const _ of new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)) total++;
  return total;
}
