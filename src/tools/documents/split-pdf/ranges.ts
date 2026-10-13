export function parseRanges(input: string, total: number): number[] {
  if (!input.trim()) throw new Error('Enter pages such as "1-3, 5, 8-".');
  const pages = new Set<number>();
  for (const part of input.split(",")) {
    const match = /^(\d+)\s*(?:-\s*(\d*)\s*)?$/.exec(part.trim());
    if (!match)
      throw new Error(
        `“${part.trim()}” is not a page range. Use numbers separated by commas, such as 1-3, 5, 8-.`,
      );
    const first = Number(match[1]);
    const last = match[2] === undefined ? first : match[2] === "" ? total : Number(match[2]);
    if (first < 1 || first > total || last < 1 || last > total)
      throw new Error(`Page numbers must be between 1 and ${total}.`);
    if (first > last)
      throw new Error(`Range ${first}-${last} is reversed. Put the smaller page number first.`);
    for (let page = first; page <= last; page++) pages.add(page - 1);
  }
  return [...pages];
}
