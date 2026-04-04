import { z } from "zod/v4";

export const ExtractedDealSchema = z.object({
  productName: z.string().min(1),
  discountPrice: z.number().positive(),
  originalPrice: z.number().positive().nullable().optional(),
  unit: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  category: z
    .enum([
      "meat",
      "fish",
      "dairy",
      "produce",
      "bread",
      "pantry",
      "frozen",
      "drinks",
      "snacks",
      "other",
    ])
    .nullable()
    .optional(),
});

export const ExtractedDealsArraySchema = z.array(ExtractedDealSchema);

export type ExtractedDeal = z.infer<typeof ExtractedDealSchema>;

export const RecipeIngredientSchema = z.object({
  name: z.string().min(1),
  amount: z.string().min(1),
  isDiscounted: z.boolean(),
  fromStore: z.string().optional(),
  estimatedPrice: z.number().optional(),
});

export const GeneratedRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  servings: z.number().int().positive(),
  ingredients: z.array(RecipeIngredientSchema),
  instructions: z.array(z.string().min(1)),
  estimatedTotalPrice: z.number().positive(),
});

export const GeneratedRecipesArraySchema = z.array(GeneratedRecipeSchema);

export type GeneratedRecipe = z.infer<typeof GeneratedRecipeSchema>;
