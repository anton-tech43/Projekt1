import RecipeCard from "@/components/RecipeCard";
import { storage } from "@/lib/storage/json-storage";
import { getCurrentWeekMonday } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const weekOf = getCurrentWeekMonday();
  const recipes = await storage.getRecipesForWeek(weekOf);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recept</h1>
        <p className="mt-1 text-gray-600">
          Receptförslag baserade på veckans rabatterade varor.
        </p>
      </div>

      {recipes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          Inga recept för denna vecka ännu.
        </div>
      )}
    </div>
  );
}
