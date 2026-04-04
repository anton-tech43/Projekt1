import Link from "next/link";
import { storage } from "@/lib/storage/json-storage";
import { getCurrentWeekMonday } from "@/lib/week";
import { STORES, type StoreId } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const weekOf = getCurrentWeekMonday();
  const stores = await storage.getDealsForWeek(weekOf);
  const recipes = await storage.getRecipesForWeek(weekOf);

  // Calculate week number
  const monday = new Date(weekOf);
  const jan1 = new Date(monday.getFullYear(), 0, 1);
  const daysSinceJan1 = Math.floor(
    (monday.getTime() - jan1.getTime()) / 86400000
  );
  const weekNumber = Math.ceil((daysSinceJan1 + jan1.getDay() + 1) / 7);

  const totalDeals = stores.reduce((sum, s) => sum + s.deals.length, 0);
  const hasIca = stores.some((s) => s.storeId === "ica-karrtorp" && s.deals.length > 0);
  const hasCoop = stores.some((s) => s.storeId === "coop-karrtorp" && s.deals.length > 0);

  return (
    <div className="space-y-8">
      {/* New deals banner */}
      {totalDeals > 0 && (
        <Link
          href="/deals"
          className="block rounded-lg bg-gradient-to-r from-red-500 to-green-600 p-4 text-white hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">
                Veckans erbjudanden är klara!
              </p>
              <p className="text-sm text-white/90">
                {totalDeals} erbjudanden från {[hasIca && "ICA", hasCoop && "Coop"].filter(Boolean).join(" och ")}
                {recipes.length > 0 && ` + ${recipes.length} receptförslag`}
              </p>
            </div>
            <span className="text-white/80 text-lg">&rarr;</span>
          </div>
        </Link>
      )}

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Matkrig</h1>
        <p className="mt-2 text-gray-600">
          Jämför veckans erbjudanden från ICA och Coop i Kärrtorp. Få
          receptförslag baserade på rabatterade varor.
        </p>
      </div>

      {/* Week status */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Vecka {weekNumber}, {monday.getFullYear()}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                hasIca ? "bg-red-500" : "bg-gray-300"
              }`}
            />
            <span className="text-sm text-gray-700">
              {STORES["ica-karrtorp"].name}:{" "}
              {hasIca ? (
                <span className="font-medium">
                  {stores.find((s) => s.storeId === "ica-karrtorp")?.deals
                    .length ?? 0}{" "}
                  erbjudanden
                </span>
              ) : (
                <span className="text-gray-400">Ej uppladdat</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                hasCoop ? "bg-green-600" : "bg-gray-300"
              }`}
            />
            <span className="text-sm text-gray-700">
              {STORES["coop-karrtorp"].name}:{" "}
              {hasCoop ? (
                <span className="font-medium">
                  {stores.find((s) => s.storeId === "coop-karrtorp")?.deals
                    .length ?? 0}{" "}
                  erbjudanden
                </span>
              ) : (
                <span className="text-gray-400">Ej uppladdat</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                recipes.length > 0 ? "bg-blue-500" : "bg-gray-300"
              }`}
            />
            <span className="text-sm text-gray-700">
              Recept:{" "}
              {recipes.length > 0 ? (
                <span className="font-medium">{recipes.length} st</span>
              ) : (
                <span className="text-gray-400">Ej genererade</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/upload"
          className="block rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors"
        >
          <h2 className="font-semibold text-gray-900">Ladda upp flygblad</h2>
          <p className="mt-1 text-sm text-gray-500">
            {totalDeals > 0
              ? "Ladda upp fler flygblad eller uppdatera befintliga."
              : "Börja med att ladda upp veckans erbjudanden."}
          </p>
        </Link>

        <Link
          href="/deals"
          className="block rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors"
        >
          <h2 className="font-semibold text-gray-900">Se erbjudanden</h2>
          <p className="mt-1 text-sm text-gray-500">
            {totalDeals > 0
              ? `${totalDeals} erbjudanden att jämföra.`
              : "Jämför priser sida vid sida mellan butikerna."}
          </p>
        </Link>

        <Link
          href="/recipes"
          className="block rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors"
        >
          <h2 className="font-semibold text-gray-900">Recept</h2>
          <p className="mt-1 text-sm text-gray-500">
            {recipes.length > 0
              ? `${recipes.length} recept baserade på veckans erbjudanden.`
              : "Receptförslag baserade på rabatterade varor."}
          </p>
        </Link>
      </div>
    </div>
  );
}
