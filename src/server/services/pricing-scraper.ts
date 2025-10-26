import { env } from "~/env";

export type PricingSearchParams = {
  query: string;
  location?: string;
  currency?: string;
  limit?: number;
};

export type PricingSource = "serpapi" | "mock";

export type PricingResult = {
  title: string;
  priceText?: string;
  priceValue?: number;
  currency?: string;
  sourceUrl?: string;
  source: PricingSource;
  seller?: string;
  relevanceScore?: number;
};

export type PricingSearchResponse = {
  results: PricingResult[];
  source: PricingSource;
  meta: {
    query: string;
    location?: string;
    currency?: string;
  };
  warnings?: string[];
};

const SERP_API_ENDPOINT = "https://serpapi.com/search.json";

/**
 * Fetch shopping/pricing data from Google Search via SerpAPI.
 * Falls back to a mocked empty response when API credentials are missing.
 */
export async function searchPricing(
  params: PricingSearchParams,
): Promise<PricingSearchResponse> {
  const { query, location, currency, limit = 6 } = params;

  if (!env.SERPAPI_API_KEY) {
    return {
      results: [],
      source: "mock",
      meta: { query, location, currency },
      warnings: [
        "SERPAPI_API_KEY not configured. Add it to .env to enable live pricing.",
      ],
    };
  }

  const searchParams = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: env.SERPAPI_API_KEY,
    google_domain: "google.com",
    num: limit.toString(),
  });

  if (location) searchParams.set("location", location);
  if (currency) searchParams.set("gl", currency.slice(0, 2).toUpperCase());

  const response = await fetch(`${SERP_API_ENDPOINT}?${searchParams.toString()}`, {
    headers: {
      "User-Agent":
        "PlanwiseBot/1.0 (+https://planwise.ai; contact: support@planwise.ai)",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return {
      results: [],
      source: "serpapi",
      meta: { query, location, currency },
      warnings: [
        `SerpAPI request failed with status ${response.status}: ${response.statusText}`,
      ],
    };
  }

  const data = (await response.json()) as SerpApiShoppingResponse;
  const shoppingResults = data.shopping_results ?? data.local_results ?? [];

  const results: PricingResult[] = shoppingResults
    .slice(0, limit)
    .map((item) => ({
      title: item.title,
      priceText: item.price,
      priceValue: parsePrice(item.extracted_price ?? item.price),
      currency: item.currency ?? currency,
      sourceUrl: item.link,
      source: "serpapi" as const,
      seller: item.source,
      relevanceScore: typeof item.position === "number" ? 1 / item.position : undefined,
    }))
    .filter((result) => !!result.title);

  return {
    results,
    source: "serpapi",
    meta: { query, location, currency },
    warnings: results.length === 0 ? ["No pricing results returned"] : undefined,
  };
}

type SerpApiShoppingResult = {
  title: string;
  price?: string;
  extracted_price?: number;
  currency?: string;
  source?: string;
  link?: string;
  position?: number;
};

type SerpApiShoppingResponse = {
  shopping_results?: SerpApiShoppingResult[];
  local_results?: SerpApiShoppingResult[];
};

function parsePrice(price: unknown): number | undefined {
  if (typeof price === "number") return price;
  if (typeof price === "string") {
    const numeric = Number(price.replace(/[^0-9.]/g, ""));
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
}
