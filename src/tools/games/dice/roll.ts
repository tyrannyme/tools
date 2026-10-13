export function parseDice(input: string) {
  const match = input
    .toLowerCase()
    .replace(/\s/g, "")
    .match(/^(\d*)d(\d+)(?:(kh|kl)(\d+))?([+-]\d+)?$/);
  if (!match) throw new Error("Use dice notation such as 2d6+3, 4d6kh3, 2d20kl1, or d100.");
  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  const keep = match[3] ? Number(match[4]) : count;
  const modifier = Number(match[5] || 0);
  if (count < 1 || count > 100) throw new Error("Roll between 1 and 100 dice.");
  if (sides < 2 || sides > 1_000_000)
    throw new Error("Each die needs between 2 and 1,000,000 sides.");
  if (keep < 1 || keep > count)
    throw new Error("The number of dice kept must be between 1 and the number rolled.");
  if (!Number.isSafeInteger(modifier) || Math.abs(modifier) > 1_000_000)
    throw new Error("Use a modifier between -1,000,000 and 1,000,000.");
  return { count, sides, keep, keepLow: match[3] === "kl", modifier };
}
export function secureDie(sides: number) {
  const limit = Math.floor(0x100000000 / sides) * sides;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0]! >= limit);
  return (buffer[0]! % sides) + 1;
}
export function rollDice(input: string) {
  const spec = parseDice(input);
  const values = Array.from({ length: spec.count }, (_, index) => ({
    value: secureDie(spec.sides),
    index,
  }));
  const ranked = [...values].sort((a, b) => (spec.keepLow ? a.value - b.value : b.value - a.value));
  const kept = new Set(ranked.slice(0, spec.keep).map((die) => die.index));
  const dice = values.map((die) => ({ ...die, kept: kept.has(die.index) }));
  return {
    notation: input,
    dice,
    modifier: spec.modifier,
    sides: spec.sides,
    total: dice.reduce((sum, die) => sum + (die.kept ? die.value : 0), spec.modifier),
  };
}
