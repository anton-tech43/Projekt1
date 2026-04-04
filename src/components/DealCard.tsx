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

interface DealCardProps {
  deal: Deal;
  isBestPrice?: boolean;
}

export default function DealCard({ deal, isBestPrice }: DealCardProps) {
  const discountPercent =
    deal.originalPrice && deal.originalPrice > deal.discountPrice
      ? Math.round((1 - deal.discountPrice / deal.originalPrice) * 100)
      : null;

  return (
    <div
      className={`rounded-lg border bg-white p-4 space-y-1 ${
        isBestPrice
          ? "border-yellow-400 ring-1 ring-yellow-200"
          : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-medium text-gray-900 text-sm leading-tight truncate">
            {deal.productName}
          </h3>
          {isBestPrice && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
              Bästa pris
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {discountPercent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
              −{discountPercent}%
            </span>
          )}
          {deal.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {CATEGORY_LABELS[deal.category] ?? deal.category}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
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
        {deal.weight && (
          <span className="text-xs text-gray-400">{deal.weight}</span>
        )}
      </div>
      {deal.comparisonPrice && deal.comparisonUnit && (
        <p className="text-[10px] text-gray-400">
          Jmf: {deal.comparisonPrice.toFixed(deal.comparisonPrice % 1 ? 2 : 0)} {deal.comparisonUnit}
        </p>
      )}
      {deal.description && (
        <p className="text-xs text-gray-500">{deal.description}</p>
      )}
    </div>
  );
}
