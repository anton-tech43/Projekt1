"use client";

import { useState, useMemo } from "react";
import DealCard from "./DealCard";
import type { Deal } from "@/lib/types";
import { STORES, type StoreId } from "@/lib/types";

interface StoreDeals {
  storeId: string;
  deals: Deal[];
}

const STORE_COLORS: Record<string, string> = {
  "ica-karrtorp": "border-red-500",
  "coop-karrtorp": "border-green-600",
};

const TAB_COLORS: Record<string, { active: string; inactive: string }> = {
  "ica-karrtorp": {
    active: "bg-red-500 text-white",
    inactive: "text-red-600 hover:bg-red-50",
  },
  "coop-karrtorp": {
    active: "bg-green-600 text-white",
    inactive: "text-green-700 hover:bg-green-50",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  meat: "Kött",
  fish: "Fisk",
  dairy: "Mejeri",
  produce: "Frukt & Grönt",
  bread: "Bröd",
  pantry: "Skafferi",
  frozen: "Fryst",
  drinks: "Dryck",
  snacks: "Snacks",
  other: "Övrigt",
};

/** Key used to match the same kind of product across stores */
function matchKey(deal: Deal): string {
  return (deal.compareKey ?? deal.productName)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Find best-price deal IDs by comparing across stores.
 * Deals match on compareKey (falls back to product name). Prices are compared
 * on jämförpris when every deal in the group has one in the same unit
 * (kr/kg vs kr/kg), otherwise on the item price when the units agree.
 */
function findBestPriceIds(stores: StoreDeals[]): Set<string> {
  if (stores.length < 2) return new Set();

  const bestPriceIds = new Set<string>();

  const byKey = new Map<string, Deal[]>();
  for (const store of stores) {
    for (const deal of store.deals) {
      const key = matchKey(deal);
      const list = byKey.get(key) ?? [];
      list.push(deal);
      byKey.set(key, list);
    }
  }

  for (const deals of byKey.values()) {
    const uniqueStores = new Set(deals.map((d) => d.storeId));
    if (uniqueStores.size < 2) continue;

    const useComparison =
      deals.every((d) => d.comparisonPrice != null) &&
      new Set(deals.map((d) => d.comparisonUnit)).size === 1;
    const sameUnit = new Set(deals.map((d) => d.unit)).size === 1;
    if (!useComparison && !sameUnit) continue;

    const price = (d: Deal) =>
      useComparison ? d.comparisonPrice! : d.discountPrice;

    let cheapest = deals[0];
    for (const d of deals) {
      if (price(d) < price(cheapest)) cheapest = d;
    }
    // A tie between stores is not a best price
    const tied = deals.some(
      (d) => d.storeId !== cheapest.storeId && price(d) === price(cheapest)
    );
    if (!tied) bestPriceIds.add(cheapest.id);
  }

  return bestPriceIds;
}

export default function DealComparison({ stores }: { stores: StoreDeals[] }) {
  const [activeTab, setActiveTab] = useState<string>(
    stores[0]?.storeId ?? "ica-karrtorp"
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Find best prices across stores
  const bestPriceIds = useMemo(() => findBestPriceIds(stores), [stores]);

  // Collect all categories across all stores
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const s of stores) {
      for (const d of s.deals) {
        cats.add(d.category ?? "other");
      }
    }
    return Array.from(cats).sort();
  }, [stores]);

  if (stores.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
        Inga erbjudanden hämtade för denna vecka ännu.
      </div>
    );
  }

  // Filter deals
  const filterDeals = (deals: Deal[]) => {
    let filtered = deals;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.productName.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      filtered = filtered.filter(
        (d) => (d.category ?? "other") === categoryFilter
      );
    }
    return filtered;
  };

  // Group deals by category
  const groupByCategory = (deals: Deal[]) => {
    const groups: Record<string, Deal[]> = {};
    for (const deal of deals) {
      const cat = deal.category ?? "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(deal);
    }
    return groups;
  };

  const renderStoreDeals = (storeDeals: StoreDeals) => {
    const filtered = filterDeals(storeDeals.deals);
    const groups = groupByCategory(filtered);
    const sortedCategories = Object.keys(groups).sort();

    return (
      <div className="space-y-2">
        {sortedCategories.map((cat) => (
          <div key={cat} className="space-y-2">
            {groups[cat].map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                isBestPrice={bestPriceIds.has(deal.id)}
              />
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            {search || categoryFilter
              ? "Inga erbjudanden matchar filtret"
              : "Inga erbjudanden"}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* F6: Search and filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök produkt..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              !categoryFilter
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Alla
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setCategoryFilter(categoryFilter === cat ? null : cat)
              }
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                categoryFilter === cat
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: tabs */}
      <div className="md:hidden">
        <div className="flex rounded-lg bg-gray-100 p-1 mb-4">
          {stores.map((s) => {
            const storeName =
              STORES[s.storeId as StoreId]?.name ?? s.storeId;
            const colors = TAB_COLORS[s.storeId] ?? TAB_COLORS["ica-karrtorp"];
            const filteredCount = filterDeals(s.deals).length;
            return (
              <button
                key={s.storeId}
                onClick={() => setActiveTab(s.storeId)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === s.storeId ? colors.active : colors.inactive
                }`}
              >
                {storeName} ({filteredCount})
              </button>
            );
          })}
        </div>
        {stores
          .filter((s) => s.storeId === activeTab)
          .map((s) => (
            <div key={s.storeId}>{renderStoreDeals(s)}</div>
          ))}
      </div>

      {/* Desktop: side by side */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-6">
        {stores.map((s) => {
          const storeName =
            STORES[s.storeId as StoreId]?.name ?? s.storeId;
          const borderColor =
            STORE_COLORS[s.storeId] ?? "border-gray-300";
          const filteredCount = filterDeals(s.deals).length;
          return (
            <div key={s.storeId}>
              <h3
                className={`text-lg font-semibold mb-3 pb-2 border-b-2 ${borderColor}`}
              >
                {storeName}{" "}
                <span className="text-sm font-normal text-gray-400">
                  ({filteredCount} erbjudanden)
                </span>
              </h3>
              {renderStoreDeals(s)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
