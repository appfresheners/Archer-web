# Archer — GTD Goal & Project Creator

Type a goal. Get the next actions.

Archer takes your goal or project and uses AI to generate a complete, filled-in GTD (Getting Things Done) breakdown with real actionable steps — not empty templates.

## Getting Started

```bash
cd archer
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## AI Provider Setup

Archer supports three AI providers. Pick one, set the env var, and you're good to go.

### Configuration

Copy `.env.local.example` or create `.env.local` in the `archer/` directory:

```env
AI_PROVIDER=gemini
```

Then set the API key for your chosen provider below.

---

### Option 1: Google Gemini (recommended — free tier)

- **Cost**: Free — 15 requests/minute, 1,500 requests/day
- **Get your key**: https://aistudio.google.com/apikey

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
```

Optional: override the model (default is `gemini-3.6-flash`):

```env
GEMINI_MODEL=gemini-3.6-flash
```

---

### Option 2: Groq (free tier, very fast)

- **Cost**: Free — rate limited
- **Get your key**: https://console.groq.com

```env
AI_PROVIDER=groq
GROQ_API_KEY=your-key-here
```

Optional: override the model (default is `llama-3.1-8b-instant`):

```env
GROQ_MODEL=llama-3.1-8b-instant
```

---

### Option 3: OpenAI (paid, highest quality)

- **Cost**: ~$0.001 per request with gpt-4o-mini (requires $5 minimum prepay)
- **Get your key**: https://platform.openai.com/api-keys

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your-key-here
```

Optional: override the model (default is `gpt-4o-mini`):

```env
OPENAI_MODEL=gpt-4o-mini
```

---

## How It Works

1. Choose **Goal** mode (big ambition → projects → next actions) or **Project** mode (single project → next actions)
2. Type your goal or project
3. Hit Generate — the AI researches your topic and fills in a complete GTD breakdown
4. Copy the markdown to clipboard or download as a `.md` file

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- react-markdown + remark-gfm for rendered output

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run test     # Run all tests (vitest)
npm run lint     # ESLint
```

## Project Structure

```
archer/
├── app/
│   ├── api/generate/route.ts   # AI generation endpoint (multi-provider)
│   ├── page.tsx                 # Main page
│   └── globals.css              # Theme & typography
├── components/
│   ├── InputSection.tsx         # Goal/project text input
│   ├── ModeToggle.tsx           # Goal ↔ Project switcher
│   ├── OutputPanel.tsx          # Rendered markdown output
│   └── ActionBar.tsx            # Copy & download buttons
├── lib/
│   ├── templates/               # Fallback static templates
│   └── utils/                   # Clipboard, download, slugify
└── .env.local                   # Your provider config (gitignored)
```
