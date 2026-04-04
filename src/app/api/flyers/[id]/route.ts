import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { storage } from "@/lib/storage/json-storage";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Endast administratörer kan ta bort flygblad." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const flyer = await storage.getFlyer(id);

  if (!flyer) {
    return NextResponse.json(
      { error: "Flygbladet hittades inte." },
      { status: 404 }
    );
  }

  await storage.deleteFlyer(id);

  return NextResponse.json({ ok: true });
}
