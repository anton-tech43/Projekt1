import { redirect } from "next/navigation";
import FlyerUpload from "@/components/FlyerUpload";
import { isAdmin } from "@/lib/admin";
import { storage } from "@/lib/storage/json-storage";
import { getCurrentWeekMonday } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  if (!(await isAdmin())) {
    redirect("/admin");
  }

  const weekOf = getCurrentWeekMonday();
  const flyers = await storage.getFlyersForWeek(weekOf);
  const existingFlyers = flyers
    .filter((f) => f.status === "extracted")
    .map((f) => ({
      id: f.id,
      storeId: f.storeId,
      uploadedAt: f.uploadedAt,
      fileName: f.fileName,
      deals: f.deals,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Ladda upp flygblad
        </h1>
        <p className="mt-1 text-gray-600">
          Ladda upp en bild av veckans erbjudanden från ICA eller Coop.
          AI:n analyserar flygbladet och extraherar alla rabatterade produkter.
        </p>
      </div>
      <FlyerUpload existingFlyers={existingFlyers} />
    </div>
  );
}
