import { createServerFn } from "@tanstack/react-start";
import { tools } from "@/lib/tools";
import type { Tool } from "@/lib/tools";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
}

function words(text: string) {
  return normalize(text).split(/\s+/).filter(Boolean);
}

/** Instant local ranking by name, keywords, category, and description. Every query word must match. */
export function searchTools(query: string): Tool[] {
  const terms = words(query);
  if (terms.length === 0) return [];
  const scored = tools.map((tool) => {
    const name = words(tool.name);
    const keywords = (tool.keywords ?? []).flatMap(words);
    const category = words(tool.category.name);
    const description = normalize(tool.description);
    let score = normalize(tool.name).startsWith(terms.join(" ")) ? 20 : 0;
    for (const term of terms) {
      const termScore = Math.max(
        name.some((word) => word.startsWith(term)) ? 10 : 0,
        keywords.some((word) => word.startsWith(term)) ? 6 : 0,
        category.some((word) => word.startsWith(term)) ? 4 : 0,
        description.includes(term) ? 2 : 0,
      );
      if (termScore === 0) return { tool, score: 0 };
      score += termScore;
    }
    return { tool, score };
  });
  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.tool);
}

const cache = new Map<string, string[]>();

/**
 * Asks Jev which tools fit a free-form request, such as "make my video small enough for
 * Discord". One `choice` question lists every tool, so a single call scores all of them.
 * Returns tool ids, best first, or null when Jev is not configured or fails.
 */
export const rankWithJev = createServerFn({ method: "POST" })
  .validator((query: string) => query.trim().slice(0, 200))
  .handler(async ({ data: query }): Promise<string[] | null> => {
    const { ENV } = await import("varlock/env");
    const key = ENV.OPENROUTER_API_KEY;
    if (!key || query.length < 3) return null;

    const cacheKey = normalize(query);
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const criteria: Record<string, string> = { none: "None of these tools fits the request." };
    tools.forEach((tool, index) => {
      const keywords = tool.keywords?.length ? ` Also known as: ${tool.keywords.join(", ")}.` : "";
      criteria[`t${index}`] =
        `${tool.name} (${tool.category.name}): ${tool.description}${keywords}`;
    });

    try {
      const response = await fetch("https://openrouter.ai/api/v1/systemone", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "~typesafe/jev-latest",
          state: query,
          questions: {
            tool: {
              type: "choice",
              instructions:
                "This is what a visitor typed into the search box of a site with free browser tools. Which tool would do what they want?",
              criteria,
            },
          },
        }),
      });
      if (!response.ok) return null;
      const result = (await response.json()) as {
        answers: { tool: { probabilities: Record<string, number> } };
      };
      const ranked = Object.entries(result.answers.tool.probabilities)
        .filter(([option, probability]) => option !== "none" && probability >= 0.05)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([option]) => tools[Number(option.slice(1))]!.id);
      if (cache.size > 500) cache.clear();
      cache.set(cacheKey, ranked);
      return ranked;
    } catch {
      return null;
    }
  });
