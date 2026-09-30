import Link from "next/link";
import DealComparison from "@/components/DealComparison";
import { storage } from "@/lib/storage/json-storage";
import { getCurrentWeekMonday } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const weekOf = getCurrentWeekMonday();
  const stores = await storage.getDealsForWeek(weekOf);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Veckans erbjudanden
          </h1>
          <p className="mt-1 text-gray-600">
            Jämför erbjudanden från ICA och Coop i Kärrtorp.
          </p>
        </div>
        {stores.some((s) => s.deals.length > 0) && (
          <Link
            href="/recipes"
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
          >
            Se recept
          </Link>
        )}
      </div>

      <DealComparison stores={stores} />
    </div>
  );
}
