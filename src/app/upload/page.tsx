import { redirect } from "next/navigation";
import FlyerUpload from "@/components/FlyerUpload";
import { isAdmin } from "@/lib/admin";

export default async function UploadPage() {
  if (!(await isAdmin())) {
    redirect("/admin");
  }

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
      <FlyerUpload />
    </div>
  );
}
