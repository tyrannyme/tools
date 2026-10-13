export class JsonSyntaxError extends Error {
  constructor(
    message: string,
    public position: number,
  ) {
    super(message);
  }
}

// Validate with a cursor so errors have the same exact offset in every browser.
export function parseJson(source: string): unknown {
  if (source.length > 1_000_000)
    throw new JsonSyntaxError("JSON is limited to 1 million characters.", 0);
  let position = 0;
  const fail = (message: string): never => {
    throw new JsonSyntaxError(message, position);
  };
  const space = () => {
    while (/[\t\n\r ]/.test(source[position] ?? "x")) position++;
  };
  function string() {
    if (source[position] !== '"') fail("Expected a quoted property name.");
    position++;
    while (position < source.length) {
      const character = source[position++]!;
      if (character === '"') return;
      if (character.charCodeAt(0) < 32) {
        position--;
        fail("Unescaped control character in string.");
      }
      if (character === "\\") {
        const escape = source[position];
        if (escape === "u") {
          position++;
          for (let i = 0; i < 4; i++, position++)
            if (!/[0-9a-f]/i.test(source[position] ?? "x"))
              fail("Expected four hexadecimal digits after \\u.");
        } else if (escape && '"\\/bfnrt'.includes(escape)) position++;
        else fail("Invalid string escape.");
      }
    }
    fail("Unterminated string.");
  }
  function value(depth: number) {
    space();
    if (depth > 100) fail("Nesting is limited to 100 levels.");
    const character = source[position];
    if (character === '"') {
      string();
      return;
    }
    if (character === "{" || character === "[") {
      const object = character === "{";
      const close = object ? "}" : "]";
      position++;
      space();
      if (source[position] === close) {
        position++;
        return;
      }
      while (true) {
        if (object) {
          string();
          space();
          if (source[position] !== ":") fail("Expected a colon after the property name.");
          position++;
        }
        value(depth + 1);
        space();
        if (source[position] === close) {
          position++;
          return;
        }
        if (source[position] !== ",") fail(`Expected a comma or ${close}.`);
        position++;
        space();
      }
    }
    for (const literal of ["true", "false", "null"]) {
      if (character === literal[0]) {
        for (const letter of literal) {
          if (source[position] !== letter) fail(`Expected ${literal}.`);
          position++;
        }
        return;
      }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(position));
    if (number) {
      position += number[0].length;
      return;
    }
    fail(
      position === source.length
        ? "Expected a value before the end of input."
        : "Expected a JSON value.",
    );
  }
  value(0);
  space();
  if (position !== source.length) fail("Unexpected character after a value.");
  return JSON.parse(source);
}

export function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  return value;
}
