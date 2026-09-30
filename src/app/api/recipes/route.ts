import { NextResponse } from "next/server";
import { storage } from "@/lib/storage/json-storage";
import { getCurrentWeekMonday } from "@/lib/week";

export const dynamic = "force-dynamic";

// Recipes are written to data/uploads/_recipes/{weekOf}.json by the weekly
// routine (.claude/skills/veckans-matkrig). The app only reads them.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekOf = searchParams.get("weekOf") ?? getCurrentWeekMonday();

  const recipes = await storage.getRecipesForWeek(weekOf);
  return NextResponse.json({ weekOf, recipes });
}
