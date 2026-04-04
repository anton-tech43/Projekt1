import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Matkrig</h1>
        <p className="mt-2 text-gray-600">
          Jämför veckans erbjudanden från ICA och Coop i Kärrtorp. Få
          receptförslag baserade på rabatterade varor.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/upload"
          className="block rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors"
        >
          <h2 className="font-semibold text-gray-900">Ladda upp flygblad</h2>
          <p className="mt-1 text-sm text-gray-500">
            Ladda upp veckans erbjudanden från ICA eller Coop.
          </p>
        </Link>

        <Link
          href="/deals"
          className="block rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors"
        >
          <h2 className="font-semibold text-gray-900">Se erbjudanden</h2>
          <p className="mt-1 text-sm text-gray-500">
            Jämför priser sida vid sida mellan butikerna.
          </p>
        </Link>

        <Link
          href="/recipes"
          className="block rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors"
        >
          <h2 className="font-semibold text-gray-900">Recept</h2>
          <p className="mt-1 text-sm text-gray-500">
            Receptförslag baserade på veckans rabatterade varor.
          </p>
        </Link>
      </div>
    </div>
  );
}
