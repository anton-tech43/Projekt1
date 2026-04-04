"use client";

import { useEffect, useState } from "react";
import RecipeCard from "@/components/RecipeCard";
import type { Recipe } from "@/lib/types";

const DIETARY_OPTIONS = [
  { id: "vegetariskt", label: "Vegetariskt" },
  { id: "laktosfritt", label: "Laktosfritt" },
  { id: "glutenfritt", label: "Glutenfritt" },
] as const;

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [dietary, setDietary] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("matkrig_dietary") ?? "[]");
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    fetchRecipes();
    checkAdmin();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("matkrig_dietary", JSON.stringify(dietary));
    }
  }, [dietary]);

  async function checkAdmin() {
    try {
      const res = await fetch("/api/admin");
      const data = await res.json();
      setIsAdmin(data.isAdmin === true);
    } catch {
      setIsAdmin(false);
    }
  }

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

  function toggleDietary(id: string) {
    setDietary((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dietary }),
      });
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recept</h1>
          <p className="mt-1 text-gray-600">
            Receptförslag baserade på veckans rabatterade varor.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? "Genererar..." : "Generera recept"}
          </button>
        )}
      </div>

      {/* Dietary preferences */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Kostpreferenser:</span>
          {DIETARY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => toggleDietary(opt.id)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                dietary.includes(opt.id)
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

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
          Inga recept genererade ännu för denna vecka.
        </div>
      )}
    </div>
  );
}
