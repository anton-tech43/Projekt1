"use client";

import { useState, useEffect } from "react";
import type { Recipe } from "@/lib/types";
import { STORES, type StoreId } from "@/lib/types";

function usePantry() {
  const [pantry, setPantry] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("matkrig_pantry") ?? "[]");
      setPantry(new Set(saved));
    } catch {
      // ignore
    }
  }, []);

  function toggle(item: string) {
    setPantry((prev) => {
      const next = new Set(prev);
      const key = item.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem("matkrig_pantry", JSON.stringify([...next]));
      return next;
    });
  }

  function has(item: string) {
    return pantry.has(item.toLowerCase());
  }

  return { toggle, has, count: pantry.size };
}

export default function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const [copied, setCopied] = useState<"link" | "list" | null>(null);
  const pantry = usePantry();

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

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied("link");
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyShoppingList() {
    const lines: string[] = [`Handlingslista: ${recipe.title}`, ""];

    for (const [storeId, ingredients] of byStore.entries()) {
      const name = STORES[storeId as StoreId]?.name ?? storeId;
      lines.push(`${name}:`);
      for (const ing of ingredients) {
        lines.push(`  - ${ing.amount} ${ing.name}`);
      }
      lines.push("");
    }

    if (noStore.length > 0) {
      lines.push("Övrigt:");
      for (const ing of noStore) {
        lines.push(`  - ${ing.amount} ${ing.name}`);
      }
    }

    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied("list");
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{recipe.title}</h1>
        <p className="mt-2 text-gray-600">{recipe.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span>{recipe.servings} portioner</span>
          <span>~{recipe.estimatedTotalPrice} kr totalt</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">
            {recipe.discountedIngredientCount} rabatterade ingredienser
          </span>
        </div>
        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={copyLink}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied === "link" ? "Kopierad!" : "Dela recept"}
          </button>
          <button
            onClick={copyShoppingList}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied === "list" ? "Kopierad!" : "Kopiera handlingslista"}
          </button>
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Ingredienser
          </h2>
          {pantry.count > 0 && (
            <span className="text-xs text-gray-400">
              Kryssa i vad du har hemma
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-2">
          Klicka &quot;Har hemma&quot; för att markera ingredienser du redan har.
        </p>
        <ul className="space-y-2">
          {recipe.ingredients.map((ing, i) => {
            const inPantry = pantry.has(ing.name);
            return (
              <li
                key={i}
                className={`flex items-center gap-3 text-sm ${
                  inPantry ? "opacity-40" : ""
                }`}
              >
                <button
                  onClick={() => pantry.toggle(ing.name)}
                  className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center text-[10px] transition-colors ${
                    inPantry
                      ? "bg-gray-200 border-gray-300 text-gray-500"
                      : "border-gray-300 hover:border-gray-400 text-transparent"
                  }`}
                  title={inPantry ? "Markera som behövd" : "Har hemma"}
                >
                  {inPantry ? "✓" : ""}
                </button>
                <span className="text-gray-600 w-20 shrink-0">
                  {ing.amount}
                </span>
                <span
                  className={
                    inPantry
                      ? "text-gray-400 line-through"
                      : ing.isDiscounted
                        ? "text-green-700 font-medium"
                        : "text-gray-900"
                  }
                >
                  {ing.name}
                </span>
                {ing.isDiscounted && ing.fromStore && !inPantry && (
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
                {ing.estimatedPrice != null && !inPantry && (
                  <span className="text-gray-400 text-xs ml-auto">
                    ~{ing.estimatedPrice} kr
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {recipe.ingredients.some((ing) => pantry.has(ing.name)) && (
          <p className="mt-3 text-xs text-gray-500">
            Uppskattad kostnad utan &quot;har hemma&quot;: ~
            {recipe.ingredients
              .filter((ing) => !pantry.has(ing.name))
              .reduce((sum, ing) => sum + (ing.estimatedPrice ?? 0), 0)}{" "}
            kr
          </p>
        )}
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Handlingslista
            </h2>
          </div>
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
