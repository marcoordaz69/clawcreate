const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";

interface ModerationResult {
  flagged: boolean;
  categories: string[];
}

/**
 * Moderate text and/or an image URL via OpenAI's omni-moderation model.
 * Returns { flagged: false } if no API key is configured (fail-open for dev).
 */
export async function moderateContent(opts: {
  text?: string | null;
  imageUrl?: string | null;
}): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[moderation] OPENAI_API_KEY not set — skipping moderation");
    return { flagged: false, categories: [] };
  }

  const input: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [];

  if (opts.text) {
    input.push({ type: "text", text: opts.text });
  }
  if (opts.imageUrl) {
    input.push({ type: "image_url", image_url: { url: opts.imageUrl } });
  }

  if (input.length === 0) {
    return { flagged: false, categories: [] };
  }

  const res = await fetch(OPENAI_MODERATION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input,
    }),
  });

  if (!res.ok) {
    console.error("[moderation] API error:", res.status, await res.text());
    // Fail-open: don't block posts if moderation API is down
    return { flagged: false, categories: [] };
  }

  const data = (await res.json()) as {
    results: Array<{
      flagged: boolean;
      categories: Record<string, boolean>;
    }>;
  };

  const result = data.results[0];
  if (!result) {
    return { flagged: false, categories: [] };
  }

  const flaggedCategories = Object.entries(result.categories)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return {
    flagged: result.flagged,
    categories: flaggedCategories,
  };
}
