import type { Segment } from "./worker-types";
export function timestamp(seconds: number, separator = ".") {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor(milliseconds / 60000) % 60;
  const secs = Math.floor(milliseconds / 1000) % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${separator}${String(milliseconds % 1000).padStart(3, "0")}`;
}
export function subtitles(segments: Segment[], format: "srt" | "vtt") {
  const separator = format === "srt" ? "," : ".";
  return (
    (format === "vtt" ? "WEBVTT\n\n" : "") +
    segments
      .map(
        (segment, index) =>
          `${format === "srt" ? `${index + 1}\n` : ""}${timestamp(segment.start, separator)} --> ${timestamp(Math.max(segment.start + 0.001, segment.end), separator)}\n${segment.text.replace(/\r?\n\s*\r?\n/g, "\n")}\n`,
      )
      .join("\n")
  );
}
