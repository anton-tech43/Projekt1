# Matkrig

Jämför veckans erbjudanden från ICA och Coop i Kärrtorp (Stockholm) och få receptförslag baserade på rabatterade varor.

## Hur det fungerar

1. **Ladda upp flygblad** - Ta en bild av veckans erbjudanden och ladda upp den
2. **AI analyserar** - Claude Vision extraherar produkter och priser automatiskt
3. **Jämför** - Se erbjudanden från båda butikerna sida vid sida
4. **Få recept** - AI föreslår recept baserade på de rabatterade varorna

## Kom igång

### Förutsättningar

- Node.js 18+
- En Anthropic API-nyckel (claude.ai)

### Installation

```bash
npm install
cp .env.example .env.local
```

Redigera `.env.local` och lägg till din API-nyckel:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Hämta erbjudanden automatiskt

```bash
# Installera Playwright (första gången)
npx playwright install chromium

# Hämta erbjudanden från båda butikerna
npm run fetch

# Eller en butik i taget
npm run fetch:ica
npm run fetch:coop
```

Scriptet testar tre metoder i ordning:
1. **ICA API** (kräver `ICA_USERNAME`/`ICA_PASSWORD` i `.env.local`)
2. **Playwright scraping** (läser strukturerad data från sajten)
3. **Claude Vision fallback** (tar screenshot och analyserar med AI)

### Starta utvecklingsservern

```bash
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000).

### Bygg för produktion

```bash
npm run build
npm start
```

## Tech stack

- **Next.js 16** - React framework med App Router
- **TypeScript** - Typsäkerhet
- **Tailwind CSS** - Styling
- **Claude API** - Vision för flygbladsanalys, text för receptgenerering
- **Zod** - Validering av AI-svar
- **sharp** - Bildbearbetning och säker omkodning

## Butiker (MVP)

- ICA Kärrtorp, Stockholm
- Coop Kärrtorp, Stockholm
