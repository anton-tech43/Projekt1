"use client";

import { useState } from "react";
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

export default function DealComparison({ stores }: { stores: StoreDeals[] }) {
  const [activeTab, setActiveTab] = useState<string>(
    stores[0]?.storeId ?? "ica-karrtorp"
  );

  if (stores.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
        Inga erbjudanden uppladdade denna vecka. Börja med att{" "}
        <a href="/upload" className="text-blue-600 underline">
          ladda upp ett flygblad
        </a>
        .
      </div>
    );
  }

  // Group deals by category within each store
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
    const groups = groupByCategory(storeDeals.deals);
    const sortedCategories = Object.keys(groups).sort();

    return (
      <div className="space-y-2">
        {sortedCategories.map((cat) => (
          <div key={cat} className="space-y-2">
            {groups[cat].map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        ))}
        {storeDeals.deals.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            Inga erbjudanden
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile: tabs */}
      <div className="md:hidden">
        <div className="flex rounded-lg bg-gray-100 p-1 mb-4">
          {stores.map((s) => {
            const storeName =
              STORES[s.storeId as StoreId]?.name ?? s.storeId;
            const colors = TAB_COLORS[s.storeId] ?? TAB_COLORS["ica-karrtorp"];
            return (
              <button
                key={s.storeId}
                onClick={() => setActiveTab(s.storeId)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === s.storeId ? colors.active : colors.inactive
                }`}
              >
                {storeName} ({s.deals.length})
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
          return (
            <div key={s.storeId}>
              <h3
                className={`text-lg font-semibold mb-3 pb-2 border-b-2 ${borderColor}`}
              >
                {storeName}{" "}
                <span className="text-sm font-normal text-gray-400">
                  ({s.deals.length} erbjudanden)
                </span>
              </h3>
              {renderStoreDeals(s)}
            </div>
          );
        })}
      </div>
    </>
  );
}
