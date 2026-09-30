# Matkrig

Jämför veckans erbjudanden från ICA Nära Kärrtorp och Coop Kärrtorp (Stockholm) och visa receptförslag baserade på rabatterade varor.

## Hur det fungerar

Appen gör inga AI-anrop och behöver ingen API-nyckel. Den visar bara det som ligger i `data/uploads/`.

1. **Hämta erbjudanden**: `npm run fetch` läser veckans erbjudanden direkt från butikernas sajter.
2. **Recept**: Claude (i en Claude Code-session) skriver 3–5 recept på veckans rabatterade varor och sparar dem i `data/uploads/_recipes/{måndag}.json`.
3. **Jämför**: `/deals` visar butikerna sida vid sida och markerar *Bästa pris* per jämförpris.

Hela veckorutinen finns som projektskill i `.claude/skills/veckans-matkrig/SKILL.md`. I Claude Code räcker det att säga "kör veckans Matkrig".

## Kom igång

### Förutsättningar

- Node.js 18+
- Microsoft Edge (Windows) för Playwright. Annars: `npx playwright install chromium`

### Installation

```bash
npm install
```

### Hämta erbjudanden

```bash
npm run fetch          # båda butikerna
npm run fetch:ica      # bara ICA
npm run fetch:coop     # bara Coop
```

Flaggor (`node scripts/fetch-offers.mjs ...`):

| Flagga | Vad den gör |
| --- | --- |
| `--method page` | Bara butikernas siddata |
| `--method api` | Bara ICA:s handla-API (kräver `ICA_USERNAME`/`ICA_PASSWORD` i miljön, overifierat) |
| `--method screenshot` | Bara skärmbilder, ingen parsning |
| `--screenshots` | Spara skärmbilder även när parsningen lyckas |
| `--headed` | Visa webbläsaren, t.ex. för att logga in |

Källor:

- **ICA**: sidan `ica.se/erbjudanden/ica-nara-karrtorp-1004317/` har erbjudandena i `window.__INITIAL_DATA__.offers.weeklyOffers`. Ingen inloggning behövs.
- **Coop**: sidan `coop.se/butiker-erbjudanden/coop/coop-karrtorp/` hämtar `external.api.coop.se/dke/offers/sorting-groups/015070`. API:t kräver en nyckel som sidan själv skickar med, så svaret fångas i Edge. Coop anger inget ordinarie pris, och jämförpriset räknas ut från förpackningsstorleken.

Om ingen strukturerad data hittas sparas skärmbilder (och Coops reklamblad som PDF) i `data/screenshots/{måndag}/`. Erbjudanden som inte gick att prissätta hamnar i `needs-review-{butik}.json` i samma mapp.

### Starta utvecklingsservern

```bash
npm run dev -- -p 3001
```

Öppna [http://localhost:3001](http://localhost:3001). Port 3000 används av Remotion på den här datorn.

## Data

`data/` är gitignorerad och stannar lokalt.

- `data/uploads/index.json`: vecka → flygblads-ID:n
- `data/uploads/{id}/flyer.json`: `WeeklyFlyer` med `Deal`-lista (se `src/lib/types.ts`)
- `data/uploads/_recipes/{måndag}.json`: `Recipe[]`
- `data/screenshots/{måndag}/`: skärmbilder och reklamblad

`Deal.compareKey` (t.ex. `"potatis"`) används för att matcha samma sorts vara mellan butikerna. Skriptet sätter den för vanliga varor, resten kan fyllas i för hand.

## Tech stack

- **Next.js 16** med App Router
- **TypeScript**
- **Tailwind CSS**
- **Playwright** (Edge) för att läsa butikernas sidor
