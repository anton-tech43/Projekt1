import "server-only";
import { getAnthropicClient } from "./client";
import { ExtractedDealsArraySchema, type ExtractedDeal } from "./schemas";

const SYSTEM_PROMPT = `Du är en expert på att läsa svenska matvarubutikens reklamblad och flygblad.
Extrahera alla rabatterade produkter som syns i bilden.

För varje produkt, returnera ett JSON-objekt med:
- productName: string (produktnamn på svenska, som det står i flygbladet)
- discountPrice: number (pris i SEK, t.ex. 29.9 för 29,90 kr)
- originalPrice: number | null (ordinarie pris om det syns, annars null)
- unit: string | null ("kg", "st", "förp", "l", "port", eller null)
- weight: string | null (vikt/volym om det syns, t.ex. "500g", "1kg", "750ml", "400g", eller null)
- comparisonPrice: number | null (jämförpris per kg eller liter om det syns eller kan beräknas, annars null. T.ex. om 500g kostar 25kr -> comparisonPrice = 50)
- comparisonUnit: string | null ("kr/kg", "kr/l", eller null)
- description: string | null (extra info som "3 för 2", "halvpris", "veckans erbjudande", eller null)
- category: "meat" | "fish" | "dairy" | "produce" | "bread" | "pantry" | "frozen" | "drinks" | "snacks" | "other"

Regler:
- Inkludera BARA produkter med ett tydligt rabatterat pris
- Alla priser i SEK (kronor). Skriv 29.9 inte 29:90
- Om priset är "2 för 40kr", skriv discountPrice som 20 (enhetspris)
- Om priset är "3 för 2" utan specifikt pris, skriv vad du kan och notera det i description
- VIKTIGT: Försök alltid beräkna jämförpris (comparisonPrice) per kg eller liter om vikt/volym finns. Detta behövs för att jämföra priser mellan butiker rättvist.
- Om jämförpris (jmf-pris) syns direkt i flygbladet, använd det.
- Ignorera reklam utan tydligt pris
- Returnera BARA en JSON-array, ingen annan text`;

/**
 * Extract deals from a flyer image using Claude Vision API.
 * Accepts a base64-encoded JPEG image.
 */
export async function extractDealsFromImage(
  imageBase64: string
): Promise<ExtractedDeal[]> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: "Extrahera alla rabatterade produkter från detta flygblad.",
          },
        ],
      },
    ],
  });

  // Check for truncation
  if (response.stop_reason === "max_tokens") {
    console.warn("Claude response was truncated (hit max_tokens)");
  }

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude Vision API");
  }

  // Parse JSON - handle both raw JSON and markdown-wrapped JSON
  const rawText = textBlock.text.trim();
  const jsonStr = rawText.startsWith("[")
    ? rawText
    : extractJsonFromMarkdown(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Retry once asking Claude to fix the format
    console.warn("Failed to parse Claude response as JSON, retrying...");
    return retryWithCorrection(client, rawText);
  }

  // Validate with Zod
  const result = ExtractedDealsArraySchema.safeParse(parsed);
  if (!result.success) {
    console.warn("Zod validation failed:", result.error.issues);
    // Try to salvage partial results
    if (Array.isArray(parsed)) {
      const valid: ExtractedDeal[] = [];
      for (const item of parsed) {
        const single = ExtractedDealsArraySchema.element.safeParse(item);
        if (single.success) valid.push(single.data);
      }
      if (valid.length > 0) return valid;
    }
    throw new Error("Kunde inte tolka flygbladet. Försök med en tydligare bild.");
  }

  return result.data;
}

function extractJsonFromMarkdown(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text;
}

async function retryWithCorrection(
  client: ReturnType<typeof getAnthropicClient>,
  originalResponse: string
): Promise<ExtractedDeal[]> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: `Följande text var tänkt att vara en JSON-array med produkter men kunde inte parsas.
Vänligen returnera BARA en giltig JSON-array (ingen annan text):

${originalResponse.slice(0, 3000)}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Retry failed: no text response");
  }

  const rawText = textBlock.text.trim();
  const jsonStr = rawText.startsWith("[")
    ? rawText
    : extractJsonFromMarkdown(rawText);

  const parsed = JSON.parse(jsonStr);
  const result = ExtractedDealsArraySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Kunde inte tolka flygbladet efter två försök.");
  }
  return result.data;
}
