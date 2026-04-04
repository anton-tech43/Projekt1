export type StoreId = "ica-karrtorp" | "coop-karrtorp";

export interface Store {
  id: StoreId;
  name: string;
  chain: "ica" | "coop";
}

export const STORES: Record<StoreId, Store> = {
  "ica-karrtorp": { id: "ica-karrtorp", name: "ICA Kärrtorp", chain: "ica" },
  "coop-karrtorp": {
    id: "coop-karrtorp",
    name: "Coop Kärrtorp",
    chain: "coop",
  },
};

export interface Deal {
  id: string;
  storeId: StoreId;
  productName: string;
  discountPrice: number;
  originalPrice?: number;
  unit?: string;
  description?: string; // "3 för 2", "halvpris", etc.
  category?: string;
  weekOf: string; // ISO date of Monday, e.g. "2026-03-30"
}

export interface WeeklyFlyer {
  id: string;
  storeId: StoreId;
  weekOf: string;
  uploadedAt: string; // ISO datetime
  fileName: string;
  status: "processing" | "extracted" | "failed";
  deals: Deal[];
}

export interface RecipeIngredient {
  name: string;
  amount: string; // "500g", "2 st", etc.
  isDiscounted: boolean;
  fromStore?: StoreId;
  estimatedPrice?: number;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  estimatedTotalPrice: number;
  discountedIngredientCount: number;
  weekOf: string;
  generatedAt: string; // ISO datetime
}
