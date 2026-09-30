#!/usr/bin/env node
/**
 * Matkrig CLI - Fetches the week's offers from ICA Nära Kärrtorp and Coop Kärrtorp.
 * No paid APIs: structured data is read from the stores' own pages, and when that
 * fails the script saves screenshots for Claude (in the chat session) to read.
 *
 * Usage:
 *   node scripts/fetch-offers.mjs                     # Both stores
 *   node scripts/fetch-offers.mjs --store ica         # ICA only
 *   node scripts/fetch-offers.mjs --store coop        # Coop only
 *   node scripts/fetch-offers.mjs --method page       # Only the page data
 *   node scripts/fetch-offers.mjs --method api        # Only ICA's handla API (needs ICA_USERNAME/ICA_PASSWORD)
 *   node scripts/fetch-offers.mjs --method screenshot # Only save screenshots, no parsing
 *   node scripts/fetch-offers.mjs --screenshots       # Also save screenshots when parsing works
 *   node scripts/fetch-offers.mjs --headed            # Show the browser (e.g. to log in)
 *
 * Sources (checked 2026-09-30, week 40):
 *   ICA:  www.ica.se/erbjudanden/ica-nara-karrtorp-1004317/ renders the offers into
 *         window.__INITIAL_DATA__.offers.weeklyOffers. No login needed.
 *   Coop: www.coop.se/butiker-erbjudanden/coop/coop-karrtorp/ calls
 *         external.api.coop.se/dke/offers/sorting-groups/015070 with a key the page
 *         supplies (a direct request gets 401), so the response is captured in Edge.
 *         The printed flyer is a PDF at dr.coop.se/Butik/Coop-K%C3%A4rrtorp?c=<år>-<vecka>.
 *
 * Output:
 *   data/uploads/{id}/flyer.json + data/uploads/index.json (replaces the store's
 *   earlier flyer for the same week).
 *   data/screenshots/{weekOf}/  screenshots, the Coop PDF, and needs-review-{store}.json
 *   with offers the parser could not price.
 */

import { writeFile, mkdir, readFile, rename, rm } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const DATA_DIR = join(PROJECT_ROOT, "data", "uploads");
const SCREENSHOT_ROOT = join(PROJECT_ROOT, "data", "screenshots");

const ICA_STORE_ID = "1004317";
const ICA_STORE_NAME = "ICA Nära Kärrtorp";
const ICA_URL = "https://www.ica.se/erbjudanden/ica-nara-karrtorp-1004317/";
const COOP_STORE_ID = "015070";
const COOP_STORE_NAME = "Coop Kärrtorp";
const COOP_URL = "https://www.coop.se/butiker-erbjudanden/coop/coop-karrtorp/";
const COOP_FLYER_URL = "https://dr.coop.se/Butik/Coop-K%C3%A4rrtorp";

const CLI_ARGS = process.argv.slice(2);
const argValue = (name, fallback) =>
  CLI_ARGS.includes(name) ? CLI_ARGS[CLI_ARGS.indexOf(name) + 1] : fallback;

// --- Utilities ---

/** The fetched data belongs to another store. Nothing is saved for that store. */
class StoreCheckError extends Error {}

function getCurrentWeekMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO week number and ISO week-year of a date */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7) };
}

function shortId() {
  return randomUUID().replace(/-/g, "").slice(0, 21);
}

async function atomicWrite(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  const tmp = filePath + ".tmp";
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmp, filePath);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

/** "22,51" / "38,95-53,95" / "60:00" -> first number */
function parseNumber(text) {
  if (text == null) return undefined;
  const m = String(text).match(/(\d+)(?:[,.:](\d+))?/);
  if (!m) return undefined;
  return parseFloat(m[1] + (m[2] ? "." + m[2] : ""));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** "60:00/kg", "33:86-37:59/kg", "80:00/liter", "Jfr-pris 88,33/kg" -> { price, unit } */
function parseComparison(text) {
  if (!text) return {};
  const price = parseNumber(text);
  if (price == null) return {};
  let unit;
  if (/\/\s*kg/i.test(text)) unit = "kr/kg";
  else if (/\/\s*(l|liter)\b/i.test(text)) unit = "kr/l";
  else if (/\/\s*st/i.test(text)) unit = "kr/st";
  return unit ? { price, unit } : {};
}

// --- Categories and cross-store matching ---

const NON_FOOD = /papper|servett|ljus\b|kronljus|kattmat|hundmat|hushållsduk|rosor|ljung|blomm|tvätt|diskmedel|schampo|tandkräm/i;
const CATEGORY_KEYWORDS = [
  ["fish", /lax|torsk|fisk|fish|räk|sill|tonfisk|\bsej\b|kolja|makrill/i],
  ["meat", /kyckling|fläsk|\bnöt|färs|korv|bacon|skinka|högrev|kebab|entrecote|lamm|kött|kalkon|medaljong/i],
  ["dairy", /yoghurt|mjölk|ost\b|ost®|grädde|smör|kvarg|\bfil\b|filmjölk|frutti|crème fraiche/i],
  ["produce", /potatis|morot|morötter|tomater i ask|plommontomat|druv|päron|plommon|satsumas|clementin|paprika|purjolök|\blök|palsternack|äpple|banan|sallad|gurka|broccoli|kål|svamp|avokado/i],
  ["bread", /bröd|gifflar|bulle|bullar|rågbitar|chiagod|rosta|frönuftig|baguette|tortilla/i],
  ["drinks", /^läsk|\släsk|juice|kaffe|\bte\b|vatten|dryck|saft|(^|\s)öl\b/i],
  ["snacks", /choklad|godis|chips|proteinbar|snacks|kex|nötter|chrunchy|crunchy/i],
  ["pantry", /mjöl|socker|müsli|krydd|tomater på burk|krossade|pasta|\bris\b|havregryn|buljong|sylt|olja/i],
];
const HINTS = [
  ["frozen", /djupfryst|fryst|frys/i],
  ["produce", /frukt|grönt/i],
  ["bread", /bröd|bageri/i],
  ["dairy", /mejeri|ost/i],
  ["meat", /protein|chark|kött/i],
  ["drinks", /dryck/i],
  ["snacks", /konfektyr|godis/i],
  ["pantry", /skafferi|kolonial/i],
];

function categorize(name, hint = "") {
  if (NON_FOOD.test(name) || /\bhem/i.test(hint)) return "other";
  if (/djupfryst|frys/i.test(hint)) return "frozen";
  for (const [cat, re] of CATEGORY_KEYWORDS) if (re.test(name)) return cat;
  for (const [cat, re] of HINTS) if (re.test(hint)) return cat;
  return "other";
}

// Generic product keys so the same kind of product matches across stores
// ("Delikatesspotatis i påse" and "Potatis i påse" -> "potatis").
// Checked in order; the first match wins. Anything else is matched by hand.
const COMPARE_KEYS = [
  ["toalettpapper", /toalettpapper/i],
  ["hushållspapper", /hushållspapper/i],
  ["körsbärstomater", /plommontomat|körsbärstomat|babytomat/i],
  ["krossade tomater", /tomater på burk|krossade tomater/i],
  ["potatis", /potatis/i],
  ["morötter", /morot|morötter/i],
  ["plommon", /plommon/i],
  ["päron", /päron/i],
  ["äpplen", /äpple/i],
  ["druvor", /druv/i],
  ["paprika", /paprika/i],
  ["purjolök", /purjolök/i],
  ["palsternacka", /palsternack/i],
  ["kycklinglårfilé", /kycklinglårfilé/i],
  ["kycklingfilé", /kycklingfilé|kycklingbröst/i],
  ["blandfärs", /blandfärs/i],
  ["nötfärs", /nötfärs/i],
  ["fläskfilé", /fläskfilé/i],
  ["lax", /\blax/i],
  ["läsk", /^läsk|\släsk/i],
  ["juice", /juice/i],
  ["bryggkaffe", /bryggkaffe/i],
  ["fryst pizza", /pizza/i],
  ["yoghurt", /yoghurt/i],
  ["vetemjöl", /vetemjöl/i],
];

function compareKeyFor(name) {
  for (const [key, re] of COMPARE_KEYS) if (re.test(name)) return key;
  return undefined;
}

// --- Browser ---

async function launchBrowser() {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error("Playwright saknas. Kör: npm install");
  }
  const headless = !CLI_ARGS.includes("--headed");
  // On Windows, use the installed Microsoft Edge so no separate browser download is needed.
  if (CLI_ARGS.includes("--edge") || process.platform === "win32") {
    return playwright.chromium.launch({ channel: "msedge", headless });
  }
  return playwright.chromium.launch({
    executablePath: existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined,
    headless,
  });
}

async function newPage(browser) {
  const context = await browser.newContext({
    locale: "sv-SE",
    viewport: { width: 1280, height: 1600 },
  });
  return context.newPage();
}

/** Scroll to the bottom so lazy-loaded offers render */
async function scrollThrough(page) {
  for (let i = 0; i < 30; i++) {
    const atBottom = await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.8);
      return window.innerHeight + window.scrollY >= document.body.scrollHeight - 5;
    });
    await page.waitForTimeout(400);
    if (atBottom) break;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

/**
 * Save the page as viewport-sized screenshots (easier to read than one tall image).
 * Returns the saved paths.
 */
async function screenshotChunks(page, dir, prefix, max = 20) {
  await mkdir(dir, { recursive: true });
  const paths = [];
  const { height, view } = await page.evaluate(() => ({
    height: document.body.scrollHeight,
    view: window.innerHeight,
  }));
  const steps = Math.min(max, Math.ceil(height / view));
  for (let i = 0; i < steps; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * view);
    await page.waitForTimeout(500);
    const path = join(dir, `${prefix}-${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path });
    paths.push(path);
  }
  return paths;
}

/** Accept only necessary cookies if a consent banner blocks the page */
async function dismissCookieBanner(page) {
  const labels = [/endast nödvändiga/i, /avvisa/i, /neka/i, /reject/i];
  for (const label of labels) {
    const button = page.getByRole("button", { name: label }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => {});
      await page.waitForTimeout(500);
      return;
    }
  }
}

// --- ICA: page data ---

async function fetchIcaPage(browser, shotDir) {
  console.log("  ICA sida: Läser window.__INITIAL_DATA__...");
  const page = await newPage(browser);
  await page.goto(ICA_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  const { offers, activeStore } = await page.evaluate(() => {
    const data = window.__INITIAL_DATA__;
    const list = data?.offers?.weeklyOffers;
    const store = data?.headerStore?.activeStore;
    return {
      offers: Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : null,
      activeStore: store ? { id: store.id, accountNumber: store.accountNumber, name: store.name } : null,
    };
  });

  // The page must be for our store: URL, the page's active store, and every offer.
  const finalUrl = page.url();
  if (!finalUrl.includes(ICA_STORE_ID)) {
    await page.close();
    throw new StoreCheckError(`ICA: sidan hamnade på ${finalUrl}, inte butik ${ICA_STORE_ID}`);
  }
  if (activeStore?.accountNumber !== ICA_STORE_ID || activeStore?.name !== ICA_STORE_NAME) {
    await page.close();
    throw new StoreCheckError(
      `ICA: sidans butik är ${JSON.stringify(activeStore)}, väntade ${ICA_STORE_NAME} (${ICA_STORE_ID})`
    );
  }
  if (offers) {
    const foreign = offers.filter(
      (o) => !o.stores?.some((s) => s.BMSStoreId === activeStore.id && s.storeMarketingName === ICA_STORE_NAME)
    );
    if (foreign.length) {
      await page.close();
      throw new StoreCheckError(
        `ICA: ${foreign.length} erbjudanden gäller inte ${ICA_STORE_NAME}, t.ex. "${foreign[0].details?.name}" ` +
          `(${foreign[0].stores?.map((s) => s.storeMarketingName).join(", ") || "ingen butik"})`
      );
    }
    console.log(`  ICA sida: Butik bekräftad (${activeStore.name}, ${activeStore.accountNumber})`);
  }

  if (CLI_ARGS.includes("--screenshots")) {
    await dismissCookieBanner(page);
    await scrollThrough(page);
    const paths = await screenshotChunks(page, shotDir, "ica");
    console.log(`  ICA sida: ${paths.length} skärmbilder sparade`);
  }
  await page.close();

  if (!offers) {
    console.log("  ICA sida: Hittade inga weeklyOffers i sidans data");
    return null;
  }
  console.log(`  ICA sida: ${offers.length} erbjudanden`);
  return normalizeIcaOffers(offers);
}

function normalizeIcaOffers(offers) {
  const deals = [];
  const review = [];

  for (const o of offers) {
    const d = o.details ?? {};
    const m = o.parsedMechanics ?? {};
    const name = d.name?.trim();
    if (!name) continue;

    const total = parseNumber(m.value2);
    const qty = m.quantity ?? 0;
    const perKg = /\/kg/i.test(m.value4 ?? "") || /kr\/kg/i.test(d.mechanicInfo ?? "");

    if (m.benefitType !== "FIXED" || total == null) {
      review.push({ reason: `mekanik ${m.type}/${m.benefitType}`, name, mechanicInfo: d.mechanicInfo, raw: o });
      continue;
    }

    let discountPrice = total;
    let unit = perKg ? "kg" : "st";
    if (!perKg && qty > 1) discountPrice = round2(total / qty);

    let { price: comparisonPrice, unit: comparisonUnit } = parseComparison(o.comparisonPrice);
    if (comparisonPrice == null && perKg) {
      comparisonPrice = discountPrice;
      comparisonUnit = "kr/kg";
    }

    const extras = [
      d.mechanicInfo,
      o.traits?.includes("Stammis") ? "Stammispris" : null,
      d.brand,
      o.restriction,
      o.condition,
    ].filter(Boolean);

    deals.push({
      productName: name,
      discountPrice,
      originalPrice: parseNumber(o.stores?.[0]?.regularPrice),
      unit,
      weight: d.packageInformation || undefined,
      comparisonPrice,
      comparisonUnit,
      description: extras.join(" · "),
      category: categorize(name, o.category?.articleGroupName),
      compareKey: compareKeyFor(name),
    });
  }

  return { deals, review };
}

// --- ICA: handla API (optional, unverified) ---

async function fetchIcaApi() {
  const username = process.env.ICA_USERNAME;
  const password = process.env.ICA_PASSWORD;
  if (!username || !password) {
    console.log("  ICA API: Inga ICA_USERNAME/ICA_PASSWORD. Hoppar över.");
    return null;
  }

  // Based on github.com/svendahlstrand/ica-api. Not verified against the live API.
  console.log("  ICA API: Loggar in...");
  const loginRes = await fetch("https://handla.api.ica.se/api/login", {
    headers: { Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString("base64") },
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

  const offersRes = await fetch(`https://handla.api.ica.se/api/offers?Stores=${ICA_STORE_ID}`, {
    headers: { AuthenticationTicket: ticket },
  });
  if (!offersRes.ok) {
    console.log(`  ICA API: Kunde inte hämta erbjudanden (${offersRes.status})`);
    return null;
  }
  const offers = (await offersRes.json()).Offers ?? [];
  console.log(`  ICA API: ${offers.length} erbjudanden`);

  // Unverified API: require a store id on every offer rather than trusting the query.
  const foreign = offers.filter((o) => String(o.StoreId ?? "") !== ICA_STORE_ID);
  if (foreign.length) {
    throw new StoreCheckError(
      `ICA API: ${foreign.length} erbjudanden saknar StoreId ${ICA_STORE_ID} (t.ex. StoreId=${foreign[0].StoreId ?? "saknas"})`
    );
  }

  const deals = [];
  const review = [];
  for (const o of offers) {
    const name = o.ProductName?.trim();
    const price = parseNumber(o.OfferCondition);
    if (!name) continue;
    if (price == null) {
      review.push({ reason: "okänt pris", name, raw: o });
      continue;
    }
    deals.push({
      productName: name,
      discountPrice: price,
      unit: /kg/i.test(o.OfferCondition ?? "") ? "kg" : "st",
      weight: o.SizeOrQuantity || undefined,
      description: o.OfferCondition || undefined,
      category: categorize(name),
      compareKey: compareKeyFor(name),
    });
  }
  return { deals, review };
}

// --- Coop: API response captured in the browser ---

async function fetchCoopPage(browser, shotDir) {
  console.log("  Coop sida: Fångar svaret från dke/offers...");
  const page = await newPage(browser);
  const offersResponse = page
    .waitForResponse((r) => r.url().includes(`/dke/offers/sorting-groups/${COOP_STORE_ID}`) && r.ok(), {
      timeout: 45000,
    })
    .catch(() => null);
  // The page also looks up the store itself; its answer names the store.
  const storeResponse = page
    .waitForResponse((r) => r.url().includes(`/store/stores/${COOP_STORE_ID}`) && r.ok(), { timeout: 45000 })
    .catch(() => null);

  await page.goto(COOP_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await dismissCookieBanner(page);
  await scrollThrough(page);

  const response = await offersResponse;
  const data = response ? await response.json().catch(() => null) : null;
  const storeRes = await storeResponse;
  const store = storeRes ? await storeRes.json().catch(() => null) : null;

  if (CLI_ARGS.includes("--screenshots")) {
    const paths = await screenshotChunks(page, shotDir, "coop");
    console.log(`  Coop sida: ${paths.length} skärmbilder sparade`);
  }
  await page.close();

  const group = data?.sortingGroups?.find((g) => g.id === "alla") ?? data?.sortingGroups?.[0];
  if (!group?.offers) {
    console.log("  Coop sida: Inget offers-svar fångades");
    return null;
  }

  // The store lookup and every offer must be for our store.
  if (store?.ledgerAccountNumber !== COOP_STORE_ID || store?.name !== COOP_STORE_NAME) {
    throw new StoreCheckError(
      `Coop: butiksuppslaget gav ${store ? `${store.name} (${store.ledgerAccountNumber})` : "inget svar"}, ` +
        `väntade ${COOP_STORE_NAME} (${COOP_STORE_ID})`
    );
  }
  const foreign = group.offers.filter((o) => o.storeLedgerAccountNumber !== COOP_STORE_ID);
  if (foreign.length) {
    throw new StoreCheckError(
      `Coop: ${foreign.length} erbjudanden gäller butik ${foreign[0].storeLedgerAccountNumber ?? "okänd"}, ` +
        `inte ${COOP_STORE_ID} (t.ex. "${foreign[0].content?.title}")`
    );
  }
  console.log(`  Coop sida: Butik bekräftad (${store.name}, ${store.ledgerAccountNumber})`);
  console.log(`  Coop sida: ${group.offers.length} erbjudanden`);
  return normalizeCoopOffers(group.offers);
}

/**
 * Package size in kg or l. Reads amountInformation ("310-350 g.", "33 cl.") and
 * uses the upper bound of a range, which gives the lowest jämförpris like ICA's
 * "83:33-138:89/kg" does. Falls back to weightVolume + netContentUnit.
 */
function coopPackageSize(content) {
  const m = (content.amountInformation ?? "").match(
    /(\d+(?:,\d+)?)(?:\s*-\s*(\d+(?:,\d+)?))?\s*(kg|g|ml|cl|l)\b/i
  );
  if (m) {
    const factors = { kg: [1, "kr/kg"], g: [0.001, "kr/kg"], l: [1, "kr/l"], cl: [0.01, "kr/l"], ml: [0.001, "kr/l"] };
    const [factor, unit] = factors[m[3].toLowerCase()];
    return { size: parseFloat((m[2] ?? m[1]).replace(",", ".")) * factor, unit };
  }

  const amount = parseNumber(content.weightVolume);
  if (!amount) return {};
  switch (content.netContentUnit) {
    case "Gram":
      return { size: amount / 1000, unit: "kr/kg" };
    case "Kilogram":
      return { size: amount, unit: "kr/kg" };
    case "Milliliter":
      return { size: amount / 1000, unit: "kr/l" };
    case "Centiliter":
      return { size: amount / 100, unit: "kr/l" };
    case "Liter":
      return { size: amount, unit: "kr/l" };
    default:
      return {};
  }
}

function normalizeCoopOffers(offers) {
  const deals = [];
  const review = [];

  for (const o of offers) {
    const p = o.priceInformation ?? {};
    const c = o.content ?? {};
    const name = c.title?.trim();
    if (!name) continue;

    let discountPrice;
    let unit = p.unit === "kg" ? "kg" : "st";
    let mechanic;
    let comparisonPrice;
    let comparisonUnit;

    if (p.dealType === "styckpris" && p.discountValue != null) {
      discountPrice = p.discountValue;
    } else if (p.dealType === "pris" && p.discountValue != null) {
      const qty = p.quantity ?? 1;
      discountPrice = qty > 1 ? round2(p.discountValue / qty) : p.discountValue;
      unit = "st";
      if (qty > 1) mechanic = `${qty} för ${p.discountValue} kr`;
    } else if (p.dealType === "Ladder Deal" && p.steps?.length) {
      // "3 för 25, 5 för 35, 10 för 50": price by the smallest step
      const first = p.steps[0];
      discountPrice = round2(first.discountValue / first.quantity);
      unit = "st";
      mechanic = p.steps.map((s) => `${s.quantity} för ${s.discountValue} kr`).join(", ");
      ({ price: comparisonPrice, unit: comparisonUnit } = parseComparison(first.comparisonPrice));
    } else {
      review.push({ reason: `dealType ${p.dealType}`, name, raw: o });
      continue;
    }

    if (comparisonPrice == null) {
      if (unit === "kg") {
        comparisonPrice = discountPrice;
        comparisonUnit = "kr/kg";
      } else {
        const { size, unit: cu } = coopPackageSize(c);
        if (size) {
          comparisonPrice = round2(discountPrice / size);
          comparisonUnit = cu;
        }
      }
    }

    const extras = [
      mechanic,
      p.isMemberPrice ? "Medlemspris" : null,
      c.brand,
      c.dealOfferLimitText,
    ].filter(Boolean);

    deals.push({
      productName: name,
      discountPrice,
      unit,
      weight: c.amountInformation?.replace(/\.\s*$/, "") || undefined,
      comparisonPrice,
      comparisonUnit,
      description: extras.join(" · "),
      category: categorize(name, `${o.categoryTeam?.name ?? ""} ${o.categoryGroup ?? ""}`),
      compareKey: compareKeyFor(name),
    });
  }

  return { deals, review };
}

// --- Screenshot fallback ---

async function screenshotIca(browser, shotDir) {
  const page = await newPage(browser);
  await page.goto(ICA_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  await dismissCookieBanner(page);
  await scrollThrough(page);
  const paths = await screenshotChunks(page, shotDir, "ica");
  await page.close();
  console.log(`  ICA: ${paths.length} skärmbilder i ${shotDir}`);
}

/** Download the Coop flyer PDF and screenshot it page by page in Edge's PDF viewer */
async function screenshotCoopFlyer(browser, shotDir, weekOf) {
  const { year, week } = isoWeek(new Date(weekOf + "T12:00:00"));
  const url = `${COOP_FLYER_URL}?c=${year}-${week}`;
  await mkdir(shotDir, { recursive: true });

  const res = await fetch(url);
  if (res.ok && (res.headers.get("content-type") ?? "").includes("pdf")) {
    const pdfPath = join(shotDir, `coop-reklamblad-v${week}.pdf`);
    await writeFile(pdfPath, Buffer.from(await res.arrayBuffer()));
    console.log(`  Coop: Reklambladet sparat (${pdfPath})`);
  } else {
    console.log(`  Coop: Inget reklamblad på ${url} (${res.status})`);
    return;
  }

  const page = await browser.newPage({ viewport: { width: 1400, height: 1900 } });
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.mouse.click(700, 900);
  for (let n = 1; n <= 12; n++) {
    await page.screenshot({ path: join(shotDir, `coop-reklamblad-${String(n).padStart(2, "0")}.png`) });
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, 150);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1200);
  }
  await page.close();
  console.log(`  Coop: 12 skärmbilder av reklambladet i ${shotDir}`);
}

async function screenshotCoopPage(browser, shotDir) {
  const page = await newPage(browser);
  await page.goto(COOP_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await dismissCookieBanner(page);
  await scrollThrough(page);
  const paths = await screenshotChunks(page, shotDir, "coop");
  await page.close();
  console.log(`  Coop: ${paths.length} skärmbilder av erbjudandesidan i ${shotDir}`);
}

// --- Save to Matkrig format ---

async function saveDeals(storeId, result, method, weekOf, shotDir) {
  if (result?.review?.length) {
    const reviewPath = join(shotDir, `needs-review-${storeId}.json`);
    await atomicWrite(reviewPath, result.review);
    console.log(`  ! ${result.review.length} erbjudanden kunde inte prissättas, se ${reviewPath}`);
  }

  const rawDeals = result?.deals ?? [];
  if (rawDeals.length === 0) {
    console.log(`  Inga erbjudanden sparade för ${storeId}`);
    return false;
  }

  const flyerId = shortId();
  const deals = rawDeals.map((d) => ({ id: shortId(), storeId, ...d, weekOf }));

  const flyer = {
    id: flyerId,
    storeId,
    weekOf,
    uploadedAt: new Date().toISOString(),
    fileName: `auto-${method}-${new Date().toISOString().split("T")[0]}`,
    status: "extracted",
    deals,
  };
  await atomicWrite(join(DATA_DIR, flyerId, "flyer.json"), flyer);

  // Replace this store's earlier flyer for the same week
  const indexPath = join(DATA_DIR, "index.json");
  const index = await readJson(indexPath, {});
  const kept = [];
  for (const id of index[weekOf] ?? []) {
    const old = await readJson(join(DATA_DIR, id, "flyer.json"), null);
    if (old?.storeId === storeId) {
      await rm(join(DATA_DIR, id), { recursive: true, force: true });
    } else {
      kept.push(id);
    }
  }
  index[weekOf] = [...kept, flyerId];
  await atomicWrite(indexPath, index);

  console.log(`  ✓ Sparade ${deals.length} erbjudanden för ${storeId} (flygblads-ID: ${flyerId})`);
  return true;
}

// --- Main ---

async function main() {
  const storeFilter = argValue("--store", "both");
  const method = argValue("--method", "auto");
  const weekOf = getCurrentWeekMonday();
  const shotDir = join(SCREENSHOT_ROOT, weekOf);

  console.log("🛒 Matkrig - Hämtar veckans erbjudanden");
  console.log(`   Vecka som börjar: ${weekOf}`);
  console.log(`   Butiker: ${storeFilter}, Metod: ${method}\n`);

  const browser = await launchBrowser();
  const missing = [];
  const wrongStore = [];

  // Ordinary fetch errors are logged and the next method is tried. A failed
  // store check is rethrown so it stops that store entirely.
  const soft = (label) => (e) => {
    if (e instanceof StoreCheckError) throw e;
    console.log(`  ${label} fel: ${e.message}`);
    return null;
  };

  async function fetchIca() {
    let result = null;
    let used = "none";

    if (method === "auto" || method === "page") {
      result = await fetchIcaPage(browser, shotDir).catch(soft("ICA sida"));
      if (result?.deals.length) used = "page";
    }
    if (!result?.deals.length && (method === "auto" || method === "api")) {
      result = await fetchIcaApi().catch(soft("ICA API"));
      if (result?.deals.length) used = "api";
    }

    const saved =
      method !== "screenshot" && (await saveDeals("ica-karrtorp", result, used, weekOf, shotDir));
    if (!saved) {
      await screenshotIca(browser, shotDir).catch((e) =>
        console.log(`  ICA skärmbilder fel: ${e.message}`)
      );
      missing.push("ica-karrtorp");
    }
  }

  async function fetchCoop() {
    let result = null;

    if (method === "auto" || method === "page") {
      result = await fetchCoopPage(browser, shotDir).catch(soft("Coop sida"));
    }

    const saved =
      method !== "screenshot" && (await saveDeals("coop-karrtorp", result, "page", weekOf, shotDir));
    if (!saved) {
      await screenshotCoopFlyer(browser, shotDir, weekOf).catch((e) =>
        console.log(`  Coop reklamblad fel: ${e.message}`)
      );
      await screenshotCoopPage(browser, shotDir).catch((e) =>
        console.log(`  Coop skärmbilder fel: ${e.message}`)
      );
      missing.push("coop-karrtorp");
    } else if (CLI_ARGS.includes("--screenshots")) {
      await screenshotCoopFlyer(browser, shotDir, weekOf).catch((e) =>
        console.log(`  Coop reklamblad fel: ${e.message}`)
      );
    }
  }

  /** Nothing is saved (and no screenshots taken) for a store that fails the check */
  const stopOnWrongStore = (storeId) => (e) => {
    if (!(e instanceof StoreCheckError)) throw e;
    console.log(`  ✗ FEL BUTIK: ${e.message}`);
    console.log(`  Inget sparat för ${storeId}. Veckans tidigare data är orörd.`);
    wrongStore.push(storeId);
  };

  try {
    if (storeFilter === "both" || storeFilter === "ica") {
      console.log("📍 ICA Nära Kärrtorp");
      await fetchIca().catch(stopOnWrongStore("ica-karrtorp"));
    }
    if (storeFilter === "both" || storeFilter === "coop") {
      console.log("\n📍 Coop Kärrtorp");
      await fetchCoop().catch(stopOnWrongStore("coop-karrtorp"));
    }
  } finally {
    await browser.close();
  }

  if (missing.length) {
    console.log(`\n⚠ Ingen strukturerad data för: ${missing.join(", ")}.`);
    console.log(`  Läs skärmbilderna i ${shotDir} och skriv flyer.json för hand.`);
  }
  if (wrongStore.length) {
    console.log(`\n✗ Butikskontrollen misslyckades för: ${wrongStore.join(", ")}. Inget sparat för dem.`);
    process.exitCode = 1;
    return;
  }
  console.log("\n✅ Klar!");
}

main().catch((e) => {
  console.error("Fel:", e);
  process.exit(1);
});
