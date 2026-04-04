import Link from "next/link";
import { notFound } from "next/navigation";
import RecipeDetail from "@/components/RecipeDetail";
import { storage } from "@/lib/storage/json-storage";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await storage.getRecipe(id);

  if (!recipe) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/recipes"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Tillbaka till recept
      </Link>
      <RecipeDetail recipe={recipe} />
    </div>
  );
}
