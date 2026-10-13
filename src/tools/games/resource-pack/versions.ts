// Resource formats, not data pack formats. Sources are the linked Mojang release notes.
export const versions = [
  { label: "26.3", major: 97, minor: 1, release: "26-3" },
  { label: "26.2", major: 88, minor: 0, release: "26-2" },
  { label: "26.1", major: 84, minor: 0, release: "26-1" },
  { label: "1.21.11", major: 75, minor: 0, release: "1-21-11" },
  { label: "1.21.9", major: 69, minor: 0, release: "1-21-9" },
  { label: "1.21.7", major: 64, minor: 0, release: "1-21-7" },
  { label: "1.21.6", major: 63, minor: 0, release: "1-21-6" },
  { label: "1.21.5", major: 55, minor: 0, release: "1-21-5" },
] as const;
export function metadata(
  description: unknown,
  low: (typeof versions)[number],
  high: (typeof versions)[number],
) {
  return {
    pack: {
      description,
      ...(low.major < 65
        ? {
            pack_format: high.major,
            supported_formats: { min_inclusive: low.major, max_inclusive: high.major },
          }
        : {}),
      ...(high.major >= 65
        ? { min_format: [low.major, low.minor], max_format: [high.major, high.minor] }
        : {}),
    },
  };
}
