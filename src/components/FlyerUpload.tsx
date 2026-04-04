"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { Deal, StoreId } from "@/lib/types";

type UploadState = "idle" | "uploading" | "editing" | "error";

export default function FlyerUpload() {
  const [storeId, setStoreId] = useState<StoreId>("ica-karrtorp");
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string>("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [flyerId, setFlyerId] = useState<string>("");

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setState("uploading");
      setError("");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("storeId", storeId);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setState("error");
          setError(data.error || "Uppladdningen misslyckades.");
          return;
        }

        setDeals(data.deals);
        setFlyerId(data.flyerId);
        setState("editing");
      } catch {
        setState("error");
        setError("Kunde inte ansluta till servern. Försök igen.");
      }
    },
    [storeId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/pdf": [".pdf"],
    },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
    disabled: state === "uploading",
  });

  const updateDeal = (index: number, field: keyof Deal, value: string | number) => {
    setDeals((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeDeal = (index: number) => {
    setDeals((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setState("idle");
    setDeals([]);
    setFlyerId("");
    setError("");
  };

  return (
    <div className="space-y-6">
      {/* Store selector */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="store"
            value="ica-karrtorp"
            checked={storeId === "ica-karrtorp"}
            onChange={() => setStoreId("ica-karrtorp")}
            className="text-red-600"
            disabled={state === "uploading"}
          />
          <span className="text-sm font-medium">ICA Kärrtorp</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="store"
            value="coop-karrtorp"
            checked={storeId === "coop-karrtorp"}
            onChange={() => setStoreId("coop-karrtorp")}
            className="text-green-600"
            disabled={state === "uploading"}
          />
          <span className="text-sm font-medium">Coop Kärrtorp</span>
        </label>
      </div>

      {/* Dropzone */}
      {(state === "idle" || state === "error") && (
        <div
          {...getRootProps()}
          className={`rounded-lg border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 bg-white hover:border-gray-400"
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-gray-600">
            {isDragActive
              ? "Släpp filen här..."
              : "Dra och släpp en bild eller PDF hit, eller klicka för att välja fil"}
          </p>
          <p className="mt-2 text-xs text-gray-400">
            JPEG, PNG eller PDF. Max 20MB.
          </p>
        </div>
      )}

      {/* Uploading state */}
      {state === "uploading" && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
          <p className="mt-4 text-gray-600">
            Analyserar flygbladet med AI... Detta kan ta upp till en minut.
          </p>
        </div>
      )}

      {/* Error state */}
      {state === "error" && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Deal editing state */}
      {state === "editing" && deals.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {deals.length} produkter hittade
            </h3>
            <button
              onClick={resetForm}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Ladda upp ny
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">
                      Produkt
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">
                      Pris (SEK)
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">
                      Ord. pris
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">
                      Enhet
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">
                      Info
                    </th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deals.map((deal, i) => (
                    <tr key={deal.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={deal.productName}
                          onChange={(e) =>
                            updateDeal(i, "productName", e.target.value)
                          }
                          className="w-full bg-transparent border-b border-transparent focus:border-gray-300 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={deal.discountPrice}
                          onChange={(e) =>
                            updateDeal(
                              i,
                              "discountPrice",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-20 bg-transparent border-b border-transparent focus:border-gray-300 focus:outline-none"
                          step="0.1"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={deal.originalPrice ?? ""}
                          onChange={(e) =>
                            updateDeal(
                              i,
                              "originalPrice",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-20 bg-transparent border-b border-transparent focus:border-gray-300 focus:outline-none"
                          step="0.1"
                          placeholder="-"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={deal.unit ?? ""}
                          onChange={(e) =>
                            updateDeal(i, "unit", e.target.value)
                          }
                          className="w-16 bg-transparent border-b border-transparent focus:border-gray-300 focus:outline-none"
                          placeholder="-"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={deal.description ?? ""}
                          onChange={(e) =>
                            updateDeal(i, "description", e.target.value)
                          }
                          className="w-28 bg-transparent border-b border-transparent focus:border-gray-300 focus:outline-none"
                          placeholder="-"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => removeDeal(i)}
                          className="text-red-400 hover:text-red-600"
                          title="Ta bort"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Flygblads-ID: {flyerId}. Klicka på valfritt fält för att redigera.
          </p>
        </div>
      )}

      {state === "editing" && deals.length === 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            Inga produkter kunde hittas i flygbladet. Försök med en tydligare
            bild.
          </p>
          <button
            onClick={resetForm}
            className="mt-2 text-sm text-yellow-700 underline"
          >
            Försök igen
          </button>
        </div>
      )}
    </div>
  );
}
