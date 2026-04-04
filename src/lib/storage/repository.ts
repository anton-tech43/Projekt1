import type { WeeklyFlyer, Deal, Recipe } from "../types";

export interface DealRepository {
  saveFlyer(flyer: WeeklyFlyer): Promise<void>;
  getFlyer(id: string): Promise<WeeklyFlyer | null>;
  getFlyersForWeek(weekOf: string): Promise<WeeklyFlyer[]>;
  getDealsForWeek(weekOf: string): Promise<{ storeId: string; deals: Deal[] }[]>;
  deleteFlyer(id: string): Promise<void>;
}

export interface RecipeRepository {
  saveRecipes(weekOf: string, recipes: Recipe[]): Promise<void>;
  getRecipesForWeek(weekOf: string): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | null>;
}

export interface StorageRepository extends DealRepository, RecipeRepository {}
