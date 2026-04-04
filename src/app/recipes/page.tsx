"use client";

import { useEffect, useState } from "react";
import RecipeCard from "@/components/RecipeCard";
import type { Recipe } from "@/lib/types";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRecipes();
  }, []);

  async function fetchRecipes() {
    try {
      const res = await fetch("/api/recipes");
      const data = await res.json();
      setRecipes(data.recipes ?? []);
    } catch {
      setError("Kunde inte hämta recept.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/recipes", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kunde inte generera recept.");
        return;
      }

      setRecipes(data.recipes ?? []);
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recept</h1>
          <p className="mt-1 text-gray-600">
            Receptförslag baserade på veckans rabatterade varor.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? "Genererar..." : "Generera recept"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {generating && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
          <p className="mt-4 text-gray-600">
            Genererar recept med AI... Detta kan ta upp till en minut.
          </p>
        </div>
      )}

      {!generating && recipes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}

      {!generating && recipes.length === 0 && !error && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          Inga recept genererade ännu. Klicka &quot;Generera recept&quot; för att
          få förslag baserade på veckans erbjudanden.
        </div>
      )}
    </div>
  );
}
