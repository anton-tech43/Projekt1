---
name: veckans-matkrig
description: Veckorutinen för Matkrig. Hämtar veckans erbjudanden från ICA Nära Kärrtorp och Coop Kärrtorp, sparar dem i data/uploads, skriver 3–5 recept på de rabatterade varorna och verifierar appen på port 3001. Använd när Anton säger "kör veckans Matkrig", "veckans erbjudanden", "nya recept till Matkrig" eller liknande.
---

# Veckans Matkrig

Matkrig visar bara data från `data/`. Allt AI-arbete gör du själv i sessionen: läser sidor och bilder, rättar erbjudanden och skriver recept.

**Grundregel: ingen betald API-användning.** Anropa aldrig Anthropics API och lägg aldrig till `ANTHROPIC_API_KEY` eller `@anthropic-ai/sdk`. Gratis metoder som Playwright och ICA-kontot är okej.

Veckan identifieras av måndagens datum, `weekOf` (t.ex. `2026-09-28`), i lokal tid.

## 1. Hämta erbjudanden

```bash
npm run fetch
```

Skriptet (`scripts/fetch-offers.mjs`) läser strukturerad data och skriver `data/uploads/{id}/flyer.json` plus `data/uploads/index.json`. Det ersätter butikens tidigare flygblad för samma vecka, så det går att köra om.

- **ICA**: `window.__INITIAL_DATA__.offers.weeklyOffers` på `https://www.ica.se/erbjudanden/ica-nara-karrtorp-1004317/`. Ingen inloggning. Om det tar slut på data provas ICA:s handla-API (`ICA_USERNAME`/`ICA_PASSWORD`), som är overifierat.
- **Coop**: svaret från `external.api.coop.se/dke/offers/sorting-groups/015070` fångas när `https://www.coop.se/butiker-erbjudanden/coop/coop-karrtorp/` laddas i Edge. Ett direktanrop ger 401.

Skriptet kontrollerar att datan gäller rätt butik innan något sparas:

- ICA: sidans URL och aktiva butik (`1004317`, "ICA Nära Kärrtorp"), och att varje erbjudande listar ICA Nära Kärrtorp.
- Coop: sidans butiksuppslag (`015070`, "Coop Kärrtorp"), och att varje erbjudande har `storeLedgerAccountNumber` `015070`.

Står det `✗ FEL BUTIK` sparas ingenting för den butiken, veckans tidigare data lämnas orörd och skriptet avslutas med felkod. Kör inte vidare med den butiken. Ta reda på varför (t.ex. omdirigering eller ändrad sajt) och berätta för Anton.

Kontrollera utskriften:

- Antal erbjudanden per butik ska vara rimligt (vecka 40 2026: ICA 39, Coop 19).
- Finns `data/screenshots/{weekOf}/needs-review-{butik}.json`? Då fanns erbjudanden med en prismekanik som parsern inte känner igen, t.ex. procentrabatt eller "köp 3 betala för 2". Lägg till dem för hand i butikens `flyer.json` (se format nedan).
- Stämmer siffrorna? Kör `node scripts/fetch-offers.mjs --screenshots` och jämför några erbjudanden mot skärmbilderna i `data/screenshots/{weekOf}/` med Read-verktyget.

### Om strukturerad data saknas

Skriptet sparar då automatiskt skärmbilder (`ica-NN.png`, `coop-NN.png`) och Coops reklamblad (`coop-reklamblad-vNN.pdf` plus `coop-reklamblad-NN.png`, eftersom Read inte kan rendera PDF här). Läs bilderna och skriv `flyer.json` själv.

- Reklamblad: `https://dr.coop.se/Butik/Coop-K%C3%A4rrtorp?c=<år>-<ISO-vecka>` (t.ex. `c=2026-40`).
- Kräver en sajt inloggning: kör med `--headed` och be Anton logga in i Edge-fönstret. Skriv aldrig in lösenord själv.
- Ändrad sajt: undersök nätverkstrafiken (Playwright `page.on("response")`) och skriv om parsningen i skriptet efter verkligheten. Uppdatera sedan den här skillen.

### Format

`data/uploads/{id}/flyer.json` är en `WeeklyFlyer` (se `src/lib/types.ts`):

```json
{
  "id": "<unikt id>",
  "storeId": "ica-karrtorp",
  "weekOf": "2026-09-28",
  "uploadedAt": "2026-09-30T10:00:00.000Z",
  "fileName": "manual-screenshots-2026-09-30",
  "status": "extracted",
  "deals": [
    {
      "id": "<unikt id>",
      "storeId": "ica-karrtorp",
      "productName": "Blandfärs",
      "discountPrice": 49,
      "originalPrice": 58.51,
      "unit": "st",
      "weight": "500 g",
      "comparisonPrice": 98,
      "comparisonUnit": "kr/kg",
      "description": "49 kr/st · ICA. Ursprung Sverige · Max 2 köp/hushåll",
      "category": "meat",
      "compareKey": "blandfärs",
      "weekOf": "2026-09-28"
    }
  ]
}
```

- `storeId`: `ica-karrtorp` eller `coop-karrtorp`.
- `discountPrice` är priset per styck eller kg. "2 för 30 kr" blir `15` med `unit: "st"` och mekaniken i `description`.
- `comparisonPrice`/`comparisonUnit` (jämförpris, `kr/kg`, `kr/l` eller `kr/st`): ta med när det står eller kan räknas ut (pris ÷ förpackningsstorlek). Vid intervall, använd det lägsta jämförpriset.
- `category`: `meat`, `fish`, `dairy`, `produce`, `bread`, `pantry`, `frozen`, `drinks`, `snacks` eller `other` (icke-mat).
- `compareKey`: generisk vara, samma sträng i båda butikerna, så att *Bästa pris* hittar paret. Skriptet sätter den för vanliga varor (`COMPARE_KEYS` i skriptet). Gå igenom listorna och sätt den för hand där samma sorts vara finns i båda butikerna men saknar nyckel.
- Lägg till id:t under `weekOf` i `data/uploads/index.json` och ta bort butikens gamla id för samma vecka.

## 2. Skriv recept

Läs båda butikernas `flyer.json` och skriv 3–5 recept till `data/uploads/_recipes/{weekOf}.json` (en array av `Recipe`).

Krav:

- Minst två rabatterade varor per recept, och minst en av dem är huvudingrediensen.
- God vardagsmat först. Gärna nordiskt, men vilket kök som helst.
- Max 45 minuter. Skriv tiden i `description` ("Klar på 35 minuter.").
- Allt på svenska.
- Välj butiken med bäst jämförpris när samma vara finns i båda.
- Variera proteinet (fisk, kyckling, fläsk/nöt, vegetariskt) och undvik att upprepa förra veckans recept (läs föregående `_recipes`-fil).

Format per recept:

```json
{
  "id": "v40-kort-slug",
  "title": "…",
  "description": "…",
  "servings": 4,
  "ingredients": [
    { "name": "Blandfärs", "amount": "500 g", "isDiscounted": true, "fromStore": "ica-karrtorp", "estimatedPrice": 49 },
    { "name": "Tortillabröd", "amount": "8 st", "isDiscounted": false, "estimatedPrice": 25 }
  ],
  "instructions": ["Steg 1…", "Steg 2…"],
  "estimatedTotalPrice": 130,
  "discountedIngredientCount": 6,
  "weekOf": "2026-09-28",
  "generatedAt": "<ISO-tid>"
}
```

- `isDiscounted: true` och `fromStore` bara på varor som finns i veckans erbjudanden.
- `estimatedPrice`: andel av förpackningens rabatterade pris för den mängd som går åt (500 g av 139 kr/kg ≈ 70 kr). Skafferivaror kan sakna pris.
- `estimatedTotalPrice` = summan av `estimatedPrice`, avrundad.
- `discountedIngredientCount` = antal ingredienser med `isDiscounted: true`. Räkna efter.
- `id` måste vara unikt över alla veckor (prefixa med veckonumret).

## 3. Verifiera

```bash
npm run dev -- -p 3001
```

Port 3000 är upptagen av Remotion. Kontrollera i webbläsaren:

- `/`: rätt vecka, antal erbjudanden per butik och antal recept.
- `/deals`: båda butikerna syns och *Bästa pris* hamnar på den billigare varan per jämförpris. Snabbkoll i konsolen: plocka ut korten med texten "Bästa pris" per kolumn och jämför mot `flyer.json`.
- `/recipes` och några `/recipes/{id}`: ingredienser, butiker och priser ser rätt ut.

Stoppa servern när du är klar.

## 4. Git

`data/` är gitignorerad och stannar lokalt. Committa bara kodändringar (t.ex. skriptet eller den här skillen). Branchen är `claude/init-matkrig-repo-q7UNg` i `anton-tech43/Projekt1`.

Rapportera kort till Anton: antal erbjudanden per butik, vilka varor som fick *Bästa pris*, och receptens titlar.
