import { NextResponse } from "next/server";
import { isAdmin, verifyAdminSecret } from "@/lib/admin";

export async function GET() {
  const admin = await isAdmin();
  return NextResponse.json({ isAdmin: admin });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { secret } = body as { secret?: string };

  if (!secret || !verifyAdminSecret(secret)) {
    return NextResponse.json(
      { error: "Felaktig adminkod." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("matkrig_admin", secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("matkrig_admin");
  return response;
}
