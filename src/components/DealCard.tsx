import type { Deal } from "@/lib/types";

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

export default function DealCard({ deal }: { deal: Deal }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-gray-900 text-sm leading-tight">
          {deal.productName}
        </h3>
        {deal.category && (
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {CATEGORY_LABELS[deal.category] ?? deal.category}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-gray-900">
          {deal.discountPrice.toFixed(deal.discountPrice % 1 ? 2 : 0)} kr
        </span>
        {deal.originalPrice && (
          <span className="text-sm text-gray-400 line-through">
            {deal.originalPrice.toFixed(deal.originalPrice % 1 ? 2 : 0)} kr
          </span>
        )}
        {deal.unit && (
          <span className="text-xs text-gray-400">/ {deal.unit}</span>
        )}
      </div>
      {deal.description && (
        <p className="text-xs text-gray-500">{deal.description}</p>
      )}
    </div>
  );
}
