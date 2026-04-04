import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { storage } from "@/lib/storage/json-storage";
import { generateRecipes, type DietaryPreference } from "@/lib/anthropic/generate-recipes";
import { getCurrentWeekMonday } from "@/lib/week";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin";
import type { Recipe, Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekOf = searchParams.get("weekOf") ?? getCurrentWeekMonday();

  const recipes = await storage.getRecipesForWeek(weekOf);
  return NextResponse.json({ weekOf, recipes });
}

export async function POST(request: Request) {
  // Admin-only: only authenticated admins can generate recipes
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Endast administratörer kan generera recept." },
      { status: 403 }
    );
  }

  // Rate limit recipe generation (expensive API call)
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(ip, 5, 60 * 60 * 1000); // 5 per hour
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "För många receptförfrågningar. Försök igen senare." },
      { status: 429 }
    );
  }

  const weekOf = getCurrentWeekMonday();

  // Get all deals for the current week
  const storeDeals = await storage.getDealsForWeek(weekOf);
  const allDeals: Deal[] = storeDeals.flatMap((s) => s.deals);

  if (allDeals.length === 0) {
    return NextResponse.json(
      { error: "Inga erbjudanden att basera recept på. Ladda upp flygblad först." },
      { status: 400 }
    );
  }

  // Parse dietary preferences from request body
  let dietary: DietaryPreference[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body.dietary)) {
      const valid: DietaryPreference[] = ["vegetariskt", "laktosfritt", "glutenfritt"];
      dietary = body.dietary.filter((d: string) => valid.includes(d as DietaryPreference));
    }
  } catch {
    // No body or invalid JSON - that's fine, use defaults
  }

  try {
    const generated = await generateRecipes(allDeals, dietary);

    // Convert to Recipe type with IDs
    const recipes: Recipe[] = generated.map((r) => ({
      id: nanoid(),
      title: r.title,
      description: r.description,
      servings: r.servings,
      ingredients: r.ingredients.map((ing) => ({
        name: ing.name,
        amount: ing.amount,
        isDiscounted: ing.isDiscounted,
        fromStore: ing.fromStore as Recipe["ingredients"][0]["fromStore"],
        estimatedPrice: ing.estimatedPrice,
      })),
      instructions: r.instructions,
      estimatedTotalPrice: r.estimatedTotalPrice,
      discountedIngredientCount: r.ingredients.filter((i) => i.isDiscounted)
        .length,
      weekOf,
      generatedAt: new Date().toISOString(),
    }));

    await storage.saveRecipes(weekOf, recipes);

    return NextResponse.json({ weekOf, recipes });
  } catch (error) {
    console.error("Recipe generation failed:", error);
    const message =
      error instanceof Error ? error.message : "Kunde inte generera recept.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
