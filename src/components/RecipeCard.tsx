import Link from "next/link";
import type { Recipe } from "@/lib/types";

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-5 hover:border-gray-300 transition-colors space-y-3"
    >
      <h3 className="font-semibold text-gray-900">{recipe.title}</h3>
      <p className="text-sm text-gray-600 line-clamp-2">
        {recipe.description}
      </p>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700">
          {recipe.discountedIngredientCount} rabatterade
        </span>
        <span>{recipe.servings} portioner</span>
        <span className="font-medium text-gray-700">
          ~{recipe.estimatedTotalPrice} kr
        </span>
      </div>
    </Link>
  );
}
