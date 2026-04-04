import "server-only";
import { getAnthropicClient } from "./client";
import { GeneratedRecipesArraySchema, type GeneratedRecipe } from "./schemas";
import type { Deal } from "../types";

const SYSTEM_PROMPT = `Du är en kreativ och kunnig kock som hjälper familjer laga god vardagsmat på budget.
Du får en lista med rabatterade produkter från matbutiker.

Ditt uppdrag:
- Föreslå 3-5 recept där minst 2 rabatterade produkter används per recept
- Minst en av de rabatterade produkterna ska vara en huvudingrediens
- Recepten ska vara god mat först och främst - vilken matkultur som helst fungerar (svensk/nordisk, italiensk, asiatisk, etc.)
- Vardagsvänliga recept, max 45 minuter tillagningstid
- Inkludera icke-rabatterade ingredienser som behövs (anta vanliga skafferivaror finns hemma)
- Var specifik med mängder
- Uppskatta pris i SEK för varje ingrediens
- Skriv allt på svenska

Returnera BARA en JSON-array med recept, ingen annan text. Varje recept ska ha:
{
  "title": "Receptnamn",
  "description": "Kort beskrivning (1-2 meningar)",
  "servings": 4,
  "ingredients": [
    { "name": "produktnamn", "amount": "500g", "isDiscounted": true, "fromStore": "ica-karrtorp", "estimatedPrice": 45 }
  ],
  "instructions": ["Steg 1...", "Steg 2..."],
  "estimatedTotalPrice": 89
}`;

export async function generateRecipes(
  deals: Deal[]
): Promise<GeneratedRecipe[]> {
  const client = getAnthropicClient();

  // Build a summary of available deals for the prompt
  const dealsSummary = deals.map((d) => ({
    product: d.productName,
    price: d.discountPrice,
    unit: d.unit,
    store: d.storeId,
    category: d.category,
  }));

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Här är veckans rabatterade produkter:\n\n${JSON.stringify(dealsSummary, null, 2)}\n\nFöreslå 3-5 recept baserade på dessa erbjudanden.`,
      },
    ],
  });

  if (response.stop_reason === "max_tokens") {
    console.warn("Recipe generation was truncated");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Inget svar från Claude API");
  }

  const rawText = textBlock.text.trim();
  const jsonStr = rawText.startsWith("[")
    ? rawText
    : extractJsonFromMarkdown(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("Kunde inte tolka receptförslag. Försök igen.");
  }

  const result = GeneratedRecipesArraySchema.safeParse(parsed);
  if (!result.success) {
    console.warn("Recipe validation failed:", result.error.issues);
    // Try to salvage individual recipes
    if (Array.isArray(parsed)) {
      const valid: GeneratedRecipe[] = [];
      for (const item of parsed) {
        const single = GeneratedRecipesArraySchema.element.safeParse(item);
        if (single.success) valid.push(single.data);
      }
      if (valid.length > 0) return valid;
    }
    throw new Error("Receptförslag kunde inte valideras. Försök igen.");
  }

  return result.data;
}

function extractJsonFromMarkdown(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text;
}
