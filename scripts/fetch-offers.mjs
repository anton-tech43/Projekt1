#!/usr/bin/env node
/**
 * Matkrig CLI - Fetches weekly offers from ICA and Coop automatically.
 *
 * Usage:
 *   node scripts/fetch-offers.mjs                    # Fetch both stores
 *   node scripts/fetch-offers.mjs --store ica        # ICA only
 *   node scripts/fetch-offers.mjs --store coop       # Coop only
 *   node scripts/fetch-offers.mjs --method api       # Force API method (ICA)
 *   node scripts/fetch-offers.mjs --method scrape    # Force Playwright scrape
 *
 * Environment:
 *   ICA_USERNAME / ICA_PASSWORD  - For ICA API (optional, falls back to scraping)
 *
 * Output: Writes deals to data/uploads/{id}/flyer.json in Matkrig format.
 */

import { writeFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const DATA_DIR = join(PROJECT_ROOT, "data", "uploads");

// --- Utilities ---

function getCurrentWeekMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split("T")[0];
}

function nanoid() {
  return randomUUID().replace(/-/g, "").slice(0, 21);
}

async function atomicWrite(filePath, data) {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmp = filePath + ".tmp";
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  const { rename } = await import("fs/promises");
  await rename(tmp, filePath);
}

async function updateIndex(weekOf, flyerId) {
  const indexPath = join(DATA_DIR, "index.json");
  let index = {};
  try {
    index = JSON.parse(await readFile(indexPath, "utf-8"));
  } catch {
    // file doesn't exist yet
  }
  if (!index[weekOf]) index[weekOf] = [];
  if (!index[weekOf].includes(flyerId)) index[weekOf].push(flyerId);
  await atomicWrite(indexPath, index);
}

const CLI_ARGS = process.argv.slice(2);

// On Windows, use the installed Microsoft Edge so no separate browser download is needed.
async function launchBrowser(playwright) {
  const useEdge = CLI_ARGS.includes("--edge") || process.platform === "win32";
  const headless = !CLI_ARGS.includes("--headed");
  if (useEdge) {
    return playwright.chromium.launch({ channel: "msedge", headless });
  }
  return playwright.chromium.launch({
    executablePath: existsSync("/opt/pw-browsers/chromium")
      ? "/opt/pw-browsers/chromium"
      : undefined,
    headless,
  });
}

// --- ICA API Method ---

async function fetchIcaApi() {
  const username = process.env.ICA_USERNAME;
  const password = process.env.ICA_PASSWORD;

  if (!username || !password) {
    console.log("  ICA API: Inga ICA-uppgifter (ICA_USERNAME/ICA_PASSWORD). Hoppar över API-metod.");
    return null;
  }

  console.log("  ICA API: Loggar in...");

  // Step 1: Login
  const authHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  const loginRes = await fetch("https://handla.api.ica.se/api/login", {
    headers: { Authorization: authHeader },
  });

  if (!loginRes.ok) {
    console.log(`  ICA API: Inloggning misslyckades (${loginRes.status})`);
    return null;
  }

  const ticket = loginRes.headers.get("authenticationticket");
  if (!ticket) {
    console.log("  ICA API: Ingen AuthenticationTicket i svaret");
    return null;
  }

  // Step 2: Fetch offers
  console.log("  ICA API: Hämtar erbjudanden för butik 1004317...");
  const offersRes = await fetch("https://handla.api.ica.se/api/offers?Stores=1004317", {
    headers: { AuthenticationTicket: ticket },
  });

  if (!offersRes.ok) {
    console.log(`  ICA API: Kunde inte hämta erbjudanden (${offersRes.status})`);
    return null;
  }

  const data = await offersRes.json();
  const offers = data.Offers || [];

  console.log(`  ICA API: ${offers.length} erbjudanden hittade`);

  return offers.map((o) => ({
    productName: o.ProductName || "Okänd produkt",
    discountPrice: parsePrice(o.OfferCondition) || 0,
    originalPrice: undefined,
    unit: extractUnit(o.SizeOrQuantity),
    weight: o.SizeOrQuantity || undefined,
    description: o.OfferCondition || undefined,
    category: mapIcaCategory(o.ArticleGroupId),
  }));
}

// --- ICA Scrape Method (Playwright) ---

async function fetchIcaScrape() {
  console.log("  ICA Scrape: Startar Playwright...");

  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    console.log("  ICA Scrape: Playwright inte installerat. Kör: npm install playwright");
    return null;
  }

  const browser = await launchBrowser(playwright);

  try {
    const page = await browser.newPage();
    await page.goto("https://www.ica.se/erbjudanden/ica-nara-karrtorp-1004317/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for offers to load
    await page.waitForTimeout(3000);

    // Extract offers from the page
    const offers = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-testid="offer-card"], .offer-card, [class*="offer"], [class*="product-card"]');
      const results = [];

      cards.forEach((card) => {
        const name =
          card.querySelector('[class*="name"], [class*="title"], h3, h4')?.textContent?.trim() ||
          card.querySelector("p")?.textContent?.trim();
        const price = card.querySelector('[class*="price"]')?.textContent?.trim();

        if (name && price) {
          results.push({ name, price, fullText: card.textContent?.trim() });
        }
      });

      // Fallback: try to find any structured offer data in the page
      if (results.length === 0) {
        // Check for JSON-LD
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        scripts.forEach((s) => {
          try {
            const data = JSON.parse(s.textContent);
            if (data.offers || data["@type"] === "Offer") {
              results.push({ jsonLd: data });
            }
          } catch {}
        });
      }

      return results;
    });

    console.log(`  ICA Scrape: ${offers.length} erbjudanden hittade`);

    // Also try capturing network requests that contain offer data
    const networkOffers = [];
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("offer") || url.includes("campaign") || url.includes("erbjud")) {
        try {
          const json = await response.json();
          networkOffers.push({ url, data: json });
        } catch {}
      }
    });

    // Reload to capture API calls
    await page.reload({ waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    if (networkOffers.length > 0) {
      console.log(`  ICA Scrape: ${networkOffers.length} API-anrop upptäckta med erbjudandedata`);
    }

    return parseScrapedOffers(offers, networkOffers, "ica");
  } finally {
    await browser.close();
  }
}

// --- Coop Scrape Method ---

async function fetchCoopScrape() {
  console.log("  Coop Scrape: Startar Playwright...");

  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    console.log("  Coop Scrape: Playwright inte installerat. Kör: npm install playwright");
    return null;
  }

  const browser = await launchBrowser(playwright);

  try {
    const page = await browser.newPage();

    // Capture API responses
    const apiResponses = [];
    page.on("response", async (response) => {
      const url = response.url();
      if (
        url.includes("offer") ||
        url.includes("campaign") ||
        url.includes("product") ||
        url.includes("erbjud") ||
        url.includes("reklamblad")
      ) {
        try {
          const contentType = response.headers()["content-type"] || "";
          if (contentType.includes("json")) {
            const json = await response.json();
            apiResponses.push({ url, data: json });
          }
        } catch {}
      }
    });

    // Try the digital flyer page
    await page.goto("https://www.coop.se/butiker-erbjudanden/coop/coop-karrtorp/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // Extract offers from the page
    const offers = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="offer"], [class*="product"], [class*="deal"], [class*="campaign"]');
      const results = [];

      cards.forEach((card) => {
        const name =
          card.querySelector('[class*="name"], [class*="title"], h3, h4, h2')?.textContent?.trim();
        const price = card.querySelector('[class*="price"]')?.textContent?.trim();

        if (name && name.length > 2) {
          results.push({
            name,
            price: price || "",
            fullText: card.textContent?.trim().slice(0, 200),
          });
        }
      });

      return results;
    });

    console.log(`  Coop Scrape: ${offers.length} erbjudanden från HTML`);
    console.log(`  Coop Scrape: ${apiResponses.length} API-svar fångade`);

    return parseScrapedOffers(offers, apiResponses, "coop");
  } finally {
    await browser.close();
  }
}

// --- Parse helpers ---

function parsePrice(text) {
  if (!text) return 0;
  const match = text.match(/(\d+)[,.]?(\d*)\s*(?:kr|:-)/i);
  if (match) {
    return parseFloat(match[1] + (match[2] ? "." + match[2] : ""));
  }
  const numMatch = text.match(/(\d+)[,.]?(\d*)/);
  if (numMatch) {
    return parseFloat(numMatch[1] + (numMatch[2] ? "." + numMatch[2] : ""));
  }
  return 0;
}

function extractUnit(text) {
  if (!text) return undefined;
  if (/\/kg/i.test(text)) return "kg";
  if (/\/st/i.test(text)) return "st";
  if (/\/l/i.test(text)) return "l";
  if (/\/förp/i.test(text)) return "förp";
  if (/\bkg\b/i.test(text)) return "kg";
  if (/\bst\b/i.test(text)) return "st";
  if (/\bl\b/i.test(text)) return "l";
  return undefined;
}

function mapIcaCategory(groupId) {
  // ICA article group IDs - rough mapping
  const map = {
    1: "meat", 2: "meat", 3: "fish", 4: "dairy", 5: "dairy",
    6: "produce", 7: "produce", 8: "bread", 9: "pantry", 10: "frozen",
    11: "drinks", 12: "drinks", 13: "snacks",
  };
  return map[groupId] || "other";
}

function parseScrapedOffers(htmlOffers, apiResponses, store) {
  const deals = [];

  // Parse HTML offers
  for (const offer of htmlOffers) {
    if (offer.jsonLd) continue; // Skip JSON-LD for now
    const name = offer.name;
    const price = parsePrice(offer.price || offer.fullText);
    if (name && price > 0) {
      deals.push({
        productName: name,
        discountPrice: price,
        unit: extractUnit(offer.fullText),
        weight: undefined,
        description: undefined,
        category: "other",
      });
    }
  }

  // Parse API responses - look for array of product/offer objects
  for (const resp of apiResponses) {
    const items = findOfferArrays(resp.data);
    for (const item of items) {
      const name = item.productName || item.name || item.title || item.ProductName;
      const price =
        item.price || item.discountPrice || item.currentPrice || item.Price ||
        parsePrice(item.priceText || item.PriceText || "");

      if (name && price > 0 && !deals.some((d) => d.productName === name)) {
        deals.push({
          productName: name,
          discountPrice: typeof price === "number" ? price : parsePrice(String(price)),
          originalPrice: item.originalPrice || item.wasPrice || item.OriginalPrice || undefined,
          unit: extractUnit(item.unit || item.sizeOrQuantity || item.SizeOrQuantity || ""),
          weight: item.weight || item.sizeOrQuantity || item.SizeOrQuantity || undefined,
          comparisonPrice: item.comparisonPrice || item.unitPrice || undefined,
          comparisonUnit: item.comparisonUnit || item.unitPriceText || undefined,
          description: item.description || item.offerCondition || item.OfferCondition || undefined,
          category: "other",
        });
      }
    }
  }

  return deals;
}

function findOfferArrays(obj) {
  if (!obj || typeof obj !== "object") return [];
  if (Array.isArray(obj)) {
    // Check if this looks like an array of offers
    if (obj.length > 0 && obj[0] && (obj[0].productName || obj[0].name || obj[0].ProductName || obj[0].title)) {
      return obj;
    }
    return obj.flatMap(findOfferArrays);
  }
  return Object.values(obj).flatMap(findOfferArrays);
}

// --- Save to Matkrig format ---

async function saveDeals(storeId, rawDeals, method) {
  if (!rawDeals || rawDeals.length === 0) {
    console.log(`  Inga erbjudanden att spara för ${storeId}`);
    return;
  }

  const weekOf = getCurrentWeekMonday();
  const flyerId = nanoid();

  const deals = rawDeals.map((d) => ({
    id: nanoid(),
    storeId,
    productName: d.productName,
    discountPrice: d.discountPrice,
    originalPrice: d.originalPrice || undefined,
    unit: d.unit || undefined,
    weight: d.weight || undefined,
    comparisonPrice: d.comparisonPrice || undefined,
    comparisonUnit: d.comparisonUnit || undefined,
    description: d.description || undefined,
    category: d.category || "other",
    weekOf,
  }));

  const flyer = {
    id: flyerId,
    storeId,
    weekOf,
    uploadedAt: new Date().toISOString(),
    fileName: `auto-${method}-${new Date().toISOString().split("T")[0]}`,
    status: "extracted",
    deals,
  };

  const flyerPath = join(DATA_DIR, flyerId, "flyer.json");
  await atomicWrite(flyerPath, flyer);
  await updateIndex(weekOf, flyerId);

  console.log(`  ✓ Sparade ${deals.length} erbjudanden från ${storeId} (flygblads-ID: ${flyerId})`);
}

// --- Vision fallback: use Claude to analyze screenshot ---

async function fetchWithVision(storeId, url) {
  console.log(`  Vision fallback: Tar screenshot av ${url}...`);

  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    console.log("  Vision: Playwright inte installerat.");
    return null;
  }

  const browser = await launchBrowser(playwright);

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 4000 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Scroll down to load all offers
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    const screenshot = await page.screenshot({ fullPage: true, type: "jpeg", quality: 85 });
    const base64 = screenshot.toString("base64");

    console.log(`  Vision: Screenshot tagen (${Math.round(base64.length / 1024)}KB). Skickar till Claude...`);

    // Load API key
    const envPath = join(PROJECT_ROOT, ".env.local");
    let apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey && existsSync(envPath)) {
      const envContent = await readFile(envPath, "utf-8");
      const match = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
      if (match) apiKey = match[1].trim();
    }

    if (!apiKey) {
      console.log("  Vision: Ingen ANTHROPIC_API_KEY hittad. Kan inte analysera screenshot.");
      return null;
    }

    // Call Claude Vision API
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      temperature: 0,
      system: `Du är en expert på att läsa svenska matvarubutikens erbjudandesidor.
Extrahera alla rabatterade produkter som syns i bilden.

Returnera BARA en JSON-array med objekt:
{
  "productName": "produktnamn",
  "discountPrice": number i SEK,
  "originalPrice": number | null,
  "unit": "kg" | "st" | "förp" | "l" | null,
  "weight": "500g" | "1kg" | null,
  "comparisonPrice": number (jämförpris per kg/l) | null,
  "comparisonUnit": "kr/kg" | "kr/l" | null,
  "description": "extra info" | null,
  "category": "meat" | "fish" | "dairy" | "produce" | "bread" | "pantry" | "frozen" | "drinks" | "snacks" | "other"
}`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: base64 },
            },
            {
              type: "text",
              text: "Extrahera alla rabatterade produkter från denna erbjudandesida.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) return null;

    const raw = textBlock.text.trim();
    const jsonStr = raw.startsWith("[") ? raw : (raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() || raw);

    try {
      const parsed = JSON.parse(jsonStr);
      console.log(`  Vision: ${parsed.length} produkter extraherade av Claude`);
      return parsed;
    } catch {
      console.log("  Vision: Kunde inte parsa Claudes svar som JSON");
      return null;
    }
  } finally {
    await browser.close();
  }
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const storeFilter = args.includes("--store") ? args[args.indexOf("--store") + 1] : "both";
  const methodFilter = args.includes("--method") ? args[args.indexOf("--method") + 1] : "auto";

  console.log("🛒 Matkrig - Hämtar veckans erbjudanden");
  console.log(`   Vecka som börjar: ${getCurrentWeekMonday()}`);
  console.log(`   Butiker: ${storeFilter}, Metod: ${methodFilter}\n`);

  // --- ICA ---
  if (storeFilter === "both" || storeFilter === "ica") {
    console.log("📍 ICA Nära Kärrtorp");

    let icaDeals = null;

    // Method 1: ICA API (needs credentials)
    if (methodFilter === "auto" || methodFilter === "api") {
      icaDeals = await fetchIcaApi().catch((e) => {
        console.log(`  ICA API fel: ${e.message}`);
        return null;
      });
    }

    // Method 2: Playwright scrape
    if (!icaDeals && (methodFilter === "auto" || methodFilter === "scrape")) {
      icaDeals = await fetchIcaScrape().catch((e) => {
        console.log(`  ICA Scrape fel: ${e.message}`);
        return null;
      });
    }

    // Method 3: Vision fallback (screenshot + Claude)
    if (!icaDeals || icaDeals.length === 0) {
      icaDeals = await fetchWithVision(
        "ica-karrtorp",
        "https://www.ica.se/erbjudanden/ica-nara-karrtorp-1004317/"
      ).catch((e) => {
        console.log(`  ICA Vision fel: ${e.message}`);
        return null;
      });
    }

    await saveDeals("ica-karrtorp", icaDeals, icaDeals ? "auto" : "none");
  }

  // --- Coop ---
  if (storeFilter === "both" || storeFilter === "coop") {
    console.log("\n📍 Coop Kärrtorp");

    let coopDeals = null;

    // Method 1: Playwright scrape
    if (methodFilter === "auto" || methodFilter === "scrape") {
      coopDeals = await fetchCoopScrape().catch((e) => {
        console.log(`  Coop Scrape fel: ${e.message}`);
        return null;
      });
    }

    // Method 2: Vision fallback
    if (!coopDeals || coopDeals.length === 0) {
      coopDeals = await fetchWithVision(
        "coop-karrtorp",
        "https://www.coop.se/butiker-erbjudanden/coop/coop-karrtorp/"
      ).catch((e) => {
        console.log(`  Coop Vision fel: ${e.message}`);
        return null;
      });
    }

    await saveDeals("coop-karrtorp", coopDeals, coopDeals ? "auto" : "none");
  }

  console.log("\n✅ Klar! Starta appen med: npm run dev");
}

main().catch((e) => {
  console.error("Fel:", e);
  process.exit(1);
});
