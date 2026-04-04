import { NextResponse } from "next/server";
import { storage } from "@/lib/storage/json-storage";
import { getCurrentWeekMonday } from "@/lib/week";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekOf = searchParams.get("weekOf") ?? getCurrentWeekMonday();

  const dealsByStore = await storage.getDealsForWeek(weekOf);

  return NextResponse.json({
    weekOf,
    stores: dealsByStore,
  });
}
