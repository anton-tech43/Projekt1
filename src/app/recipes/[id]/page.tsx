export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Recept</h1>
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
        Recept {id} - detaljer kommer snart...
      </div>
    </div>
  );
}
