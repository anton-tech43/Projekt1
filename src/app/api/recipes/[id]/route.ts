import { NextResponse } from "next/server";
import { storage } from "@/lib/storage/json-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const recipe = await storage.getRecipe(id);

  if (!recipe) {
    return NextResponse.json(
      { error: "Receptet hittades inte." },
      { status: 404 }
    );
  }

  return NextResponse.json(recipe);
}
