export default function RecipesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recept</h1>
        <p className="mt-1 text-gray-600">
          Receptförslag baserade på veckans rabatterade varor.
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
        Inga recept genererade ännu. Ladda upp flygblad och generera recept
        från erbjudandesidan.
      </div>
    </div>
  );
}
