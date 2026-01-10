# Copilot Instructions for Oxypogon

## Project Overview

Oxypogon is a CrossFit Workout of the Day (WOD) viewer that uses **GitHub Flat Data** to automatically scrape workouts from CrossFit MINS, then enhances them with **OpenAI-generated explanations** for beginners.

## Architecture

```
index.html          → Static web viewer (Tailwind + DaisyUI)
postprocess/        → Deno scripts for Flat Data workflow
  process_workout.ts  → Main processing: scrape → parse → OpenAI → output
  constants.ts        → AI prompt templates (SYSTEM_PROMPT, USER_PROMPT, EXTRACT_PROMPT)
outputs/            → Generated JSON/MD files consumed by index.html
.github/workflows/  → Flat Data automation (runs Sun, Mon, Wed, Fri at 6 AM UTC)
```

## Tech Stack & Runtime

- **Runtime**: Deno (NOT Node.js) – use `deno run` commands
- **Frontend**: Vanilla HTML with Tailwind CSS CDN + DaisyUI components
- **AI**: OpenAI `gpt-4o-mini` for workout explanations
- **Automation**: GitHub Flat Data Action with postprocessing

## Key Commands

```bash
# Process a workout file locally (requires OPENAI_API_KEY env var)
deno task process

# Run with explicit permissions
deno run --allow-read --allow-write --allow-net --allow-env postprocess/process_workout.ts workout_page.html
```

## Data Flow

1. Flat Data fetches HTML from CrossFit MINS website
2. `process_workout.ts` extracts `pid` and `security` tokens from HTML
3. AJAX call fetches actual workout content
4. OpenAI generates beginner-friendly explanations via two-step prompting:
   - First: Extract workout structure (`EXTRACT_PROMPT`)
   - Second: Generate detailed guide (`USER_PROMPT`)
5. Outputs written to `outputs/` as JSON, TXT, and Markdown

## Code Patterns

### Deno Flat Data Helpers
Always use Flat Data's file helpers for I/O in postprocess scripts:
```typescript
import { readTXT, writeJSON, writeTXT } from 'https://deno.land/x/flat@0.0.15/mod.ts';
```

### OpenAI Integration
The `callOpenAI()` function in [process_workout.ts](../postprocess/process_workout.ts) uses a system prompt + user instruction pattern. Temperature is `0.2` for consistent outputs.

### HTML Parsing
Uses Deno DOM for parsing scraped HTML:
```typescript
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
```

### Font Pairing System
The frontend uses a custom font manager in [font-pairings.js](../font-pairings.js). Available pairings are defined as configuration objects.

## Environment Variables

- `OPENAI_API_KEY` – Required for AI explanations (set as GitHub secret for Actions)

## Output File Structure

The main output consumed by the frontend is `outputs/workout_with_explanation.json`:
```typescript
interface ProcessedWorkoutData {
  timestamp: string;
  success: boolean;
  original_data?: WorkoutData;
  ai_explanation?: { generated_at: string; model: string; explanation: string };
  combined_content?: { date: string; title: string; workout_text: string; ai_explanation: string };
}
```

## Workflow Schedule

The GitHub Action runs on a cron schedule: `0 6 * * 0,1,3,5` (Sun, Mon, Wed, Fri at 6 AM UTC). Trigger manually via `workflow_dispatch` for testing.
