import type { Recipe } from "@/lib/types";
import { STORES, type StoreId } from "@/lib/types";

export default function RecipeDetail({ recipe }: { recipe: Recipe }) {
  // Group ingredients by store for shopping list
  const byStore = new Map<string, typeof recipe.ingredients>();
  const noStore: typeof recipe.ingredients = [];

  for (const ing of recipe.ingredients) {
    if (ing.fromStore) {
      const list = byStore.get(ing.fromStore) ?? [];
      list.push(ing);
      byStore.set(ing.fromStore, list);
    } else {
      noStore.push(ing);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{recipe.title}</h1>
        <p className="mt-2 text-gray-600">{recipe.description}</p>
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
          <span>{recipe.servings} portioner</span>
          <span>~{recipe.estimatedTotalPrice} kr totalt</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">
            {recipe.discountedIngredientCount} rabatterade ingredienser
          </span>
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Ingredienser
        </h2>
        <ul className="space-y-2">
          {recipe.ingredients.map((ing, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span className="text-gray-600 w-20 shrink-0">{ing.amount}</span>
              <span
                className={
                  ing.isDiscounted
                    ? "text-green-700 font-medium"
                    : "text-gray-900"
                }
              >
                {ing.name}
              </span>
              {ing.isDiscounted && ing.fromStore && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    ing.fromStore === "ica-karrtorp"
                      ? "bg-red-50 text-red-600"
                      : "bg-green-50 text-green-700"
                  }`}
                >
                  {STORES[ing.fromStore as StoreId]?.name ?? ing.fromStore}
                </span>
              )}
              {ing.estimatedPrice != null && (
                <span className="text-gray-400 text-xs ml-auto">
                  ~{ing.estimatedPrice} kr
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Instructions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Instruktioner
        </h2>
        <ol className="space-y-3">
          {recipe.instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                {i + 1}
              </span>
              <span className="text-gray-700 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Shopping list by store */}
      {(byStore.size > 0 || noStore.length > 0) && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Handlingslista
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from(byStore.entries()).map(([storeId, ingredients]) => (
              <div
                key={storeId}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <h3
                  className={`font-medium text-sm mb-2 ${
                    storeId === "ica-karrtorp"
                      ? "text-red-600"
                      : "text-green-700"
                  }`}
                >
                  {STORES[storeId as StoreId]?.name ?? storeId}
                </h3>
                <ul className="space-y-1 text-sm text-gray-700">
                  {ingredients.map((ing, i) => (
                    <li key={i}>
                      {ing.amount} {ing.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {noStore.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="font-medium text-sm mb-2 text-gray-600">
                  Övrigt (valfri butik)
                </h3>
                <ul className="space-y-1 text-sm text-gray-700">
                  {noStore.map((ing, i) => (
                    <li key={i}>
                      {ing.amount} {ing.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
