import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { validateFile, validateImageDimensions } from "@/lib/processing/validate-file";
import { prepareImageForVision } from "@/lib/processing/image-resize";
import { extractDealsFromImage } from "@/lib/anthropic/extract-deals";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin";
import { storage } from "@/lib/storage/json-storage";
import { getCurrentWeekMonday } from "@/lib/week";
import type { StoreId, Deal, WeeklyFlyer } from "@/lib/types";
import pLimit from "p-limit";

export const runtime = "nodejs";

const limit = pLimit(2); // Max 2 concurrent Claude API calls

const VALID_STORES: StoreId[] = ["ica-karrtorp", "coop-karrtorp"];

export async function POST(request: Request) {
  // Admin-only: only authenticated admins can upload flyers
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Endast administratörer kan ladda upp flygblad." },
      { status: 403 }
    );
  }

  // Validate Origin header (CSRF protection)
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json(
      { error: "Ogiltig förfrågan." },
      { status: 403 }
    );
  }

  // Rate limiting
  const ip = getClientIp(request);
  const maxPerHour = parseInt(process.env.MAX_UPLOADS_PER_HOUR ?? "10", 10);
  const rateCheck = checkRateLimit(ip, maxPerHour, 60 * 60 * 1000);
  if (!rateCheck.allowed) {
    const retryMin = Math.ceil((rateCheck.retryAfterMs ?? 0) / 60000);
    return NextResponse.json(
      { error: `För många uppladdningar. Försök igen om ${retryMin} minuter.` },
      { status: 429 }
    );
  }

  // Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Ogiltig förfrågan. Förväntade multipart/form-data." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const storeId = formData.get("storeId") as string;

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Ingen fil bifogad." },
      { status: 400 }
    );
  }

  if (!storeId || !VALID_STORES.includes(storeId as StoreId)) {
    return NextResponse.json(
      { error: "Ogiltig butik. Välj ICA eller Coop Kärrtorp." },
      { status: 400 }
    );
  }

  // Read file into buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate file (magic bytes + size)
  const validation = await validateFile(buffer);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  const flyerId = nanoid();
  const weekOf = getCurrentWeekMonday();

  try {
    let imageBuffers: Buffer[];

    if (validation.mimeType === "application/pdf") {
      // For MVP: inform user to upload images instead of PDFs
      // PDF support will be added in a future phase
      return NextResponse.json(
        { error: "PDF-stöd kommer snart. Ladda upp bilder (JPEG/PNG) istället." },
        { status: 400 }
      );
    } else {
      // Validate image dimensions
      const dimCheck = await validateImageDimensions(buffer);
      if (!dimCheck.valid) {
        return NextResponse.json(
          { error: dimCheck.error },
          { status: 400 }
        );
      }
      imageBuffers = [buffer];
    }

    // Process each image through Claude Vision (with concurrency limit)
    const allDeals: Deal[] = [];

    await Promise.all(
      imageBuffers.map((imgBuffer) =>
        limit(async () => {
          const prepared = await prepareImageForVision(imgBuffer);
          const extracted = await extractDealsFromImage(prepared.base64);

          for (const deal of extracted) {
            allDeals.push({
              id: nanoid(),
              storeId: storeId as StoreId,
              productName: deal.productName,
              discountPrice: deal.discountPrice,
              originalPrice: deal.originalPrice ?? undefined,
              unit: deal.unit ?? undefined,
              description: deal.description ?? undefined,
              category: deal.category ?? undefined,
              weekOf,
            });
          }
        })
      )
    );

    // Save flyer with deals
    const flyer: WeeklyFlyer = {
      id: flyerId,
      storeId: storeId as StoreId,
      weekOf,
      uploadedAt: new Date().toISOString(),
      fileName: file.name,
      status: "extracted",
      deals: allDeals,
    };

    await storage.saveFlyer(flyer);

    return NextResponse.json({
      flyerId,
      dealCount: allDeals.length,
      deals: allDeals,
    });
  } catch (error) {
    console.error("Upload processing failed:", error);

    // Save failed flyer record
    const failedFlyer: WeeklyFlyer = {
      id: flyerId,
      storeId: storeId as StoreId,
      weekOf,
      uploadedAt: new Date().toISOString(),
      fileName: file.name,
      status: "failed",
      deals: [],
    };
    await storage.saveFlyer(failedFlyer).catch(() => {});

    const message =
      error instanceof Error ? error.message : "Oväntat fel vid bearbetning.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
