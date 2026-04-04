"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">
        Något gick fel
      </h2>
      <p className="text-gray-600 text-sm max-w-md text-center">
        {error.message || "Ett oväntat fel uppstod. Försök igen."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
      >
        Försök igen
      </button>
    </div>
  );
}
