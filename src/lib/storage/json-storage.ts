import { promises as fs } from "fs";
import path from "path";
import type { StorageRepository } from "./repository";
import type { WeeklyFlyer, Deal, Recipe } from "../types";

const DATA_DIR = path.join(process.cwd(), "data", "uploads");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/** Atomic write: write to temp file, then rename */
async function atomicWrite(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tmp = filePath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, filePath);
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export class JsonStorage implements StorageRepository {
  private flyerDir(id: string) {
    return path.join(DATA_DIR, id);
  }

  async saveFlyer(flyer: WeeklyFlyer): Promise<void> {
    const dir = this.flyerDir(flyer.id);
    await atomicWrite(path.join(dir, "flyer.json"), flyer);

    // Update the index for week-based lookups
    const indexPath = path.join(DATA_DIR, "index.json");
    const index = (await readJsonFile<Record<string, string[]>>(indexPath)) ?? {};
    const weekKey = flyer.weekOf;
    if (!index[weekKey]) index[weekKey] = [];
    if (!index[weekKey].includes(flyer.id)) index[weekKey].push(flyer.id);
    await atomicWrite(indexPath, index);
  }

  async getFlyer(id: string): Promise<WeeklyFlyer | null> {
    return readJsonFile<WeeklyFlyer>(
      path.join(this.flyerDir(id), "flyer.json")
    );
  }

  async getFlyersForWeek(weekOf: string): Promise<WeeklyFlyer[]> {
    const indexPath = path.join(DATA_DIR, "index.json");
    const index = (await readJsonFile<Record<string, string[]>>(indexPath)) ?? {};
    const flyerIds = index[weekOf] ?? [];

    const flyers: WeeklyFlyer[] = [];
    for (const id of flyerIds) {
      const flyer = await this.getFlyer(id);
      if (flyer) flyers.push(flyer);
    }
    return flyers;
  }

  async getDealsForWeek(
    weekOf: string
  ): Promise<{ storeId: string; deals: Deal[] }[]> {
    const indexPath = path.join(DATA_DIR, "index.json");
    const index = (await readJsonFile<Record<string, string[]>>(indexPath)) ?? {};
    const flyerIds = index[weekOf] ?? [];

    const results: { storeId: string; deals: Deal[] }[] = [];
    for (const id of flyerIds) {
      const flyer = await this.getFlyer(id);
      if (flyer && flyer.status === "extracted") {
        results.push({ storeId: flyer.storeId, deals: flyer.deals });
      }
    }
    return results;
  }

  async deleteFlyer(id: string): Promise<void> {
    const dir = this.flyerDir(id);
    await fs.rm(dir, { recursive: true, force: true });

    // Clean up index
    const indexPath = path.join(DATA_DIR, "index.json");
    const index = (await readJsonFile<Record<string, string[]>>(indexPath)) ?? {};
    for (const week of Object.keys(index)) {
      index[week] = index[week].filter((fid) => fid !== id);
      if (index[week].length === 0) delete index[week];
    }
    await atomicWrite(indexPath, index);
  }

  async saveRecipes(weekOf: string, recipes: Recipe[]): Promise<void> {
    const recipesDir = path.join(DATA_DIR, "_recipes");
    await atomicWrite(path.join(recipesDir, `${weekOf}.json`), recipes);
  }

  async getRecipesForWeek(weekOf: string): Promise<Recipe[]> {
    const recipesDir = path.join(DATA_DIR, "_recipes");
    return (
      (await readJsonFile<Recipe[]>(path.join(recipesDir, `${weekOf}.json`))) ??
      []
    );
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    // Scan recipe files to find by ID - acceptable for MVP scale
    const recipesDir = path.join(DATA_DIR, "_recipes");
    try {
      const files = await fs.readdir(recipesDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const recipes = await readJsonFile<Recipe[]>(
          path.join(recipesDir, file)
        );
        const found = recipes?.find((r) => r.id === id);
        if (found) return found;
      }
    } catch {
      // Directory may not exist yet
    }
    return null;
  }
}

/** Singleton instance */
export const storage = new JsonStorage();
