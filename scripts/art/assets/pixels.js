// Small helpers for the pixel art in the games artwork: a hand-drawn 5x7 font and sprite drawing.
// Every texel is drawn as a filled square, so edges stay crisp at any size.

const glyphs = {
  A: ".###.|#...#|#...#|#####|#...#|#...#|#...#",
  B: "####.|#...#|#...#|####.|#...#|#...#|####.",
  C: ".###.|#...#|#....|#....|#....|#...#|.###.",
  D: "####.|#...#|#...#|#...#|#...#|#...#|####.",
  E: "#####|#....|#....|####.|#....|#....|#####",
  F: "#####|#....|#....|####.|#....|#....|#....",
  G: ".###.|#...#|#....|#.###|#...#|#...#|.###.",
  H: "#...#|#...#|#...#|#####|#...#|#...#|#...#",
  I: "###|.#.|.#.|.#.|.#.|.#.|###",
  J: "....#|....#|....#|....#|#...#|#...#|.###.",
  K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
  L: "#....|#....|#....|#....|#....|#....|#####",
  M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#",
  N: "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#",
  O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
  P: "####.|#...#|#...#|####.|#....|#....|#....",
  Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
  R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
  S: ".####|#....|#....|.###.|....#|....#|####.",
  T: "#####|..#..|..#..|..#..|..#..|..#..|..#..",
  U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
  V: "#...#|#...#|#...#|#...#|.#.#.|.#.#.|..#..",
  W: "#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#",
  X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
  Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..",
  Z: "#####|....#|...#.|..#..|.#...|#....|#####",
  0: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
  1: "..#..|.##..|..#..|..#..|..#..|..#..|#####",
  2: ".###.|#...#|....#|..##.|.#...|#....|#####",
  3: ".###.|#...#|....#|..##.|....#|#...#|.###.",
  4: "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.",
  5: "#####|#....|####.|....#|....#|#...#|.###.",
  6: "..##.|.#...|#....|####.|#...#|#...#|.###.",
  7: "#####|#...#|....#|...#.|..#..|..#..|..#..",
  8: ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
  9: ".###.|#...#|#...#|.####|....#|...#.|.##..",
  " ": "...|...|...|...|...|...|...",
};
const font = Object.fromEntries(
  Object.entries(glyphs).map(([key, rows]) => [key, rows.split("|")]),
);

/** Width of `text` in texels, with one texel between letters and one more per letter when bold. */
export function textWidth(text, bold = false) {
  return [...text].reduce((sum, char, index) => {
    const width = font[char][0].length + (bold ? 1 : 0);
    return sum + width + (index ? 1 : 0);
  }, 0);
}

/** Draws text like Minecraft does: bold doubles each stroke one texel right, shadow sits one down and right. */
export function drawText(context, text, x, y, size, color, { bold = false, shadow } = {}) {
  const pass = (fill, dx, dy) => {
    context.fillStyle = fill;
    let cursor = x;
    for (const char of text) {
      const rows = font[char];
      rows.forEach((row, ty) =>
        [...row].forEach((cell, tx) => {
          if (cell !== "#") return;
          for (let b = 0; b <= (bold ? 1 : 0); b++)
            context.fillRect(cursor + (tx + b + dx) * size, y + (ty + dy) * size, size, size);
        }),
      );
      cursor += (rows[0].length + (bold ? 1 : 0) + 1) * size;
    }
  };
  if (shadow) pass(shadow, 1, 1);
  pass(color, 0, 0);
}

/** Draws `rows` (strings, one char per texel, "." for empty) using `palette` at `size` px per texel. */
export function drawSprite(context, rows, palette, x, y, size) {
  rows.forEach((row, ty) =>
    [...row].forEach((cell, tx) => {
      if (cell === "." || !palette[cell]) return;
      context.fillStyle = palette[cell];
      context.fillRect(x + tx * size, y + ty * size, size, size);
    }),
  );
}

/** A canvas sized for crisp drawing in CSS pixels. */
export function canvas(element, width, height) {
  element.width = width;
  element.height = height;
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  return element.getContext("2d");
}

/** A small seeded random generator, so the art is the same on every render. */
export function random(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
