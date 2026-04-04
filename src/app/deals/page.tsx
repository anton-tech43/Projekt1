export default function DealsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Veckans erbjudanden</h1>
        <p className="mt-1 text-gray-600">
          Jämför erbjudanden från ICA och Coop i Kärrtorp.
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
        Inga erbjudanden uppladdade denna vecka. Börja med att{" "}
        <a href="/upload" className="text-blue-600 underline">
          ladda upp ett flygblad
        </a>
        .
      </div>
    </div>
  );
}
