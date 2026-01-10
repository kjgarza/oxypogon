/**
 * CrossFit Data Scraper
 *
 * Scrapes hero WODs and movements from CrossFit.com
 * Generates heroes.json and movements.json
 *
 * Usage: node scrape_crossfit.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_DIR = __dirname;
const DELAY_MS = 300; // Delay between requests to be respectful

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
  if (!text) return null;
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// YOUTUBE URL EXTRACTION
// ============================================================================

function extractYouTubeUrl(html) {
  const patterns = [
    // Embedded iframe
    /src=["'](?:https?:)?\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i,
    // Direct YouTube links
    /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /https?:\/\/youtu\.be\/([a-zA-Z0-9_-]+)/,
    // JSON data
    /"videoUrl"\s*:\s*"(https?:\/\/[^"]*youtube[^"]+)"/,
    /"video"\s*:\s*{\s*"url"\s*:\s*"(https?:\/\/[^"]+)"/,
    // Vimeo as fallback
    /https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      if (match[1].startsWith('http')) {
        return match[1].replace(/\\u002F/g, '/');
      }
      if (pattern.source.includes('vimeo')) {
        return `https://vimeo.com/${match[1]}`;
      }
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  }
  return null;
}

// ============================================================================
// HEROES SCRAPING
// ============================================================================

function parseHeroBlock(block) {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  let name = '';
  let workoutLines = [];
  let workoutNotes = '';
  let rx = { male: null, female: null };
  let honoreeText = '';
  let survivors = [];
  let firstPosted = null;
  let inWorkout = false;
  let inHonoree = false;

  for (const line of lines) {
    // Extract name from heading
    if (line.startsWith('###') || (line.startsWith('**') && !name)) {
      name = line.replace(/[#*\[\]()]/g, '').replace(/https?:\/\/[^\s]+/g, '').trim();
      inWorkout = true;
      continue;
    }

    // Skip image lines
    if (line.startsWith('![') || line.startsWith('[![')) continue;

    // RX weights
    if (line.startsWith('♀')) {
      rx.female = line.substring(1).trim();
      continue;
    }
    if (line.startsWith('♂')) {
      rx.male = line.substring(1).trim();
      continue;
    }

    // First posted date
    if (line.startsWith('_First posted') || line.includes('First posted')) {
      const dateMatch = line.match(/([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})/);
      if (dateMatch) firstPosted = dateMatch[1];
      continue;
    }

    // Survivors
    if (line.match(/^(He|She) is survived by/i)) {
      const survivorMatch = line.match(/survived by (.+)/i);
      if (survivorMatch) {
        survivors = survivorMatch[1]
          .replace(/[.;]$/, '')
          .split(/,\s*(?:and\s+)?|;\s*(?:and\s+)?|\s+and\s+/)
          .map(s => s.trim())
          .filter(Boolean);
      }
      continue;
    }

    // Honoree section detection
    if (line.match(/^(In honor of|In memory of|U\.S\.|Canadian|Australian|Navy|Army|Marine|Air Force|Police|Fire|Officer|Sgt|Cpl|Capt|Lt)/i)) {
      inHonoree = true;
      inWorkout = false;
    }

    // Collect workout lines
    if (inWorkout && !inHonoree) {
      // Check for notes (usually start with "If you've got" or similar)
      if (line.match(/^(If you|Partition|Begin|Alternate|Do \d+|Rest|On the|Wear)/i)) {
        workoutNotes += (workoutNotes ? ' ' : '') + line;
      } else {
        workoutLines.push(line);
      }
    }

    // Collect honoree text
    if (inHonoree && !line.match(/^(He|She) is survived/i)) {
      honoreeText += (honoreeText ? ' ' : '') + line;
    }
  }

  if (!name || workoutLines.length === 0) return null;

  // Determine workout type
  const workoutText = workoutLines.join(' ').toLowerCase();
  let workoutType = 'unknown';
  if (workoutText.includes('for time')) workoutType = 'for_time';
  else if (workoutText.includes('as many rounds as possible') || workoutText.includes('amrap')) workoutType = 'amrap';
  else if (workoutText.includes('as many rounds and reps')) workoutType = 'amrap';
  else if (workoutText.includes('rounds for time') || workoutText.includes('rounds, each for time')) workoutType = 'rounds_for_time';

  // Parse honoree details
  const honoree = parseHonoree(honoreeText);

  return {
    name: name,
    workout: {
      type: workoutType,
      description: workoutLines.join('\n'),
      notes: workoutNotes || null
    },
    rx: rx,
    honoree: honoree,
    survivors: survivors.length > 0 ? survivors : null,
    first_posted: firstPosted,
    source_url: "https://www.crossfit.com/heroes"
  };
}

function parseHonoree(text) {
  if (!text) return null;

  const honoree = {
    name: null,
    rank: null,
    branch: null,
    age: null,
    location: null,
    unit: null,
    date_of_death: null,
    circumstances: null
  };

  // Extract branch
  const branchPatterns = [
    { pattern: /U\.?S\.?\s*(Navy|Army|Marine Corps?|Air Force|Coast Guard)/i, branch: m => m[1] },
    { pattern: /Canadian (Forces|Armed Forces|Army)/i, branch: () => 'Canadian Forces' },
    { pattern: /Australian (Army|Defence Force)/i, branch: m => `Australian ${m[1]}` },
    { pattern: /(Police|Sheriff|Fire)/i, branch: m => m[1] }
  ];

  for (const bp of branchPatterns) {
    const match = text.match(bp.pattern);
    if (match) {
      honoree.branch = bp.branch(match);
      break;
    }
  }

  // Extract rank and name
  const rankPatterns = [
    /(?:Navy |Army |Marine |Air Force )?((?:Senior )?(?:Chief )?(?:Petty Officer|Special Warfare Operator|Master Sgt|Staff Sgt|Sgt\.? (?:1st Class|Maj)?|Sgt|Cpl|Capt|Captain|1st Lt|Lt\.|Lieutenant|Specialist|Spc\.|Pvt\.|Private|Officer))\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+(?:[A-Z][a-z]+(?:-[A-Z][a-z]+)?)+)/i
  ];

  for (const pattern of rankPatterns) {
    const match = text.match(pattern);
    if (match) {
      honoree.rank = match[1].trim();
      honoree.name = match[2].trim();
      break;
    }
  }

  // If no structured name found, try to get the name differently
  if (!honoree.name) {
    const nameMatch = text.match(/(?:honor of|memory of)\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+(?:[A-Z][a-z]+)+)/i);
    if (nameMatch) honoree.name = nameMatch[1].trim();
  }

  // Extract age
  const ageMatch = text.match(/,\s*(\d{2}),\s*(?:of|from|was)/);
  if (ageMatch) honoree.age = parseInt(ageMatch[1]);

  // Extract location
  const locationMatch = text.match(/,\s*\d{2},\s*of\s+([^,]+(?:,\s*[A-Z]{2})?)/i);
  if (locationMatch) honoree.location = locationMatch[1].trim();

  // Extract date of death
  const datePatterns = [
    /(?:killed|died|was killed)\s+(?:on\s+)?([A-Z][a-z]+\.?\s+\d{1,2},?\s+\d{4})/i,
    /on\s+([A-Z][a-z]+\.?\s+\d{1,2},?\s+\d{4})/i
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      honoree.date_of_death = match[1];
      break;
    }
  }

  // Extract circumstances
  const circumstanceMatch = text.match(/(killed|died)[^.]*\./i);
  if (circumstanceMatch) {
    honoree.circumstances = cleanText(circumstanceMatch[0]);
  }

  return honoree;
}

async function scrapeHeroes() {
  console.log('Scraping heroes from CrossFit.com...');
  const heroes = [];

  try {
    // Fetch the heroes page
    const html = await fetch('https://www.crossfit.com/heroes');

    // The content is structured with *** separators between heroes
    // We need to extract the text content
    const blocks = html.split(/\*\s*\*\s*\*/);

    for (const block of blocks) {
      // Look for hero sections (they have ### headings)
      if (block.includes('###') || block.match(/<h3[^>]*>/i)) {
        const hero = parseHeroBlock(block);
        if (hero && hero.name && hero.workout.description) {
          heroes.push(hero);
        }
      }
    }

    console.log(`  Found ${heroes.length} heroes`);
  } catch (error) {
    console.error('Error scraping heroes:', error.message);
  }

  return heroes;
}

// ============================================================================
// MOVEMENTS SCRAPING
// ============================================================================

// Full list of movement URLs from the index
const MOVEMENT_URLS = [
  // Foundational - Squats
  { url: "https://www.crossfit.com/essentials/the-air-squat", category: "The Squats", foundational: true },
  { url: "https://www.crossfit.com/essentials/the-front-squat", category: "The Squats", foundational: true },
  { url: "https://www.crossfit.com/essentials/the-overhead-squat", category: "The Squats", foundational: true },
  // Foundational - Presses
  { url: "https://www.crossfit.com/essentials/the-shoulder-press", category: "The Presses", foundational: true },
  { url: "https://www.crossfit.com/essentials/the-push-press", category: "The Presses", foundational: true },
  { url: "https://www.crossfit.com/essentials/the-push-jerk", category: "The Presses", foundational: true },
  // Foundational - Deadlifts
  { url: "https://www.crossfit.com/essentials/the-deadlift", category: "The Deadlifts", foundational: true },
  { url: "https://www.crossfit.com/essentials/the-sumo-deadlift-high-pull", category: "The Deadlifts", foundational: true },
  { url: "https://www.crossfit.com/essentials/the-medicine-ball-clean", category: "The Deadlifts", foundational: true },

  // Additional movements - A
  { url: "https://www.crossfit.com/essentials/the-abmat-sit-up", category: "Core", foundational: false },

  // Additional movements - B
  { url: "https://www.crossfit.com/essentials/back-scales-progression", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-back-squat", category: "Squats", foundational: false },
  { url: "https://www.crossfit.com/essentials/barbell-front-rack-lunge", category: "Lower Body", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-bench-press", category: "Upper Body", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-box-jump", category: "Plyometrics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-box-step-up", category: "Lower Body", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-burpee-2", category: "Conditioning", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-burpee-box-jump-over", category: "Conditioning", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-butterfly-pull-up", category: "Gymnastics", foundational: false },

  // Additional movements - C
  { url: "https://www.crossfit.com/essentials/the-chest-to-wall-handstand-push-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-clean-2", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-clean-and-jerk", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-squat-clean-and-push-jerk", category: "Olympic Lifts", foundational: false },

  // Additional movements - D
  { url: "https://www.crossfit.com/essentials/the-dip", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-double-under", category: "Conditioning", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-clean", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-deadlift", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-farmer-carry", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-front-rack-lunge", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-front-squat", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-hang-clean", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-hang-power-clean", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-overhead-squat", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/dumbbell-overhead-walking-lunge", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-power-clean", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-power-snatch", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-push-jerk", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-push-press", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-snatch", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-thruster", category: "Dumbbell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-dumbbell-turkish-get-up", category: "Dumbbell", foundational: false },

  // Additional movements - F
  { url: "https://www.crossfit.com/essentials/forward-roll-from-support", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-freestanding-handstand-push-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/front-scales-progression", category: "Gymnastics", foundational: false },

  // Additional movements - G
  { url: "https://www.crossfit.com/essentials/the-ghd-back-extension", category: "Core", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-ghd-hip-and-back-extension", category: "Core", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-ghd-hip-extension", category: "Core", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-ghd-sit-up", category: "Core", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-glide-kip", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-good-morning", category: "Lower Body", foundational: false },

  // Additional movements - H
  { url: "https://www.crossfit.com/essentials/freestanding-handstand", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/pirouettes", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/handstand-push-up-variations", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-handstand-walk", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-hang-squat-clean", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-hang-clean-and-push-jerk", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-hanging-l-sit", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-hang-power-clean", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-hang-power-snatch", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-hang-snatch", category: "Olympic Lifts", foundational: false },

  // Additional movements - I
  { url: "https://www.crossfit.com/essentials/the-inverted-burpee", category: "Gymnastics", foundational: false },

  // Additional movements - K
  { url: "https://www.crossfit.com/essentials/the-kettlebell-snatch", category: "Kettlebell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-kettlebell-swing", category: "Kettlebell", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-kipping-bar-muscle-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-kipping-chest-to-bar-pull-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-kipping-deficit-handstand-push-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-kipping-handstand-push-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-kipping-muscle-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-kipping-pull-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-kipping-toes-to-bar", category: "Core", foundational: false },

  // Additional movements - L
  { url: "https://www.crossfit.com/essentials/the-legless-rope-climb", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-l-pull-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-l-sit", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-l-sit-on-rings", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-l-sit-rope-climb", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-l-sit-to-shoulder-stand", category: "Gymnastics", foundational: false },

  // Additional movements - M
  { url: "https://www.crossfit.com/essentials/the-modified-rope-climb", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-muscle-snatch", category: "Olympic Lifts", foundational: false },

  // Additional movements - P
  { url: "https://www.crossfit.com/essentials/the-power-clean", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-power-clean-split-jerk", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-power-snatch", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-pull-over", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-push-up", category: "Upper Body", foundational: false },

  // Additional movements - R
  { url: "https://www.crossfit.com/essentials/the-ring-dip", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-ring-push-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-ring-row", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-rope-climb-basket", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-rope-climb-wrapping", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/rowing", category: "Cardio", foundational: false },

  // Additional movements - S
  { url: "https://www.crossfit.com/essentials/the-shoot-through", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-single-leg-squat", category: "Lower Body", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-single-under", category: "Conditioning", foundational: false },
  { url: "https://www.crossfit.com/essentials/skin-the-cat", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-slam-ball", category: "Conditioning", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-snatch", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-snatch-balance", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-sots-press", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-split-clean", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-split-jerk", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-split-snatch", category: "Olympic Lifts", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-straddle-press", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-strict-bar-muscle-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-strict-chest-to-bar-pull-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-strict-handstand-push-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-strict-knees-to-elbow", category: "Core", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-strict-muscle-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-strict-pull-up", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-strict-toes-to-bar", category: "Core", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-strict-toes-to-rings", category: "Core", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-sumo-deadlift", category: "Lower Body", foundational: false },
  { url: "https://www.crossfit.com/essentials/backward-roll-to-support", category: "Gymnastics", foundational: false },

  // Additional movements - T
  { url: "https://www.crossfit.com/essentials/the-thruster", category: "Compound", foundational: false },

  // Additional movements - W
  { url: "https://www.crossfit.com/essentials/the-walking-lunge", category: "Lower Body", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-wall-ball", category: "Conditioning", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-wall-walk", category: "Gymnastics", foundational: false },
  { url: "https://www.crossfit.com/essentials/the-windshield-wiper", category: "Core", foundational: false },

  // Additional movements - Z
  { url: "https://www.crossfit.com/essentials/the-zercher-squat", category: "Squats", foundational: false }
];

function extractDescription(html) {
  // Try meta description first
  const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (metaMatch) return cleanText(metaMatch[1]);

  // Try first paragraph after content starts
  const pMatch = html.match(/<p[^>]*>([^<]{100,500})<\/p>/);
  if (pMatch) return cleanText(pMatch[1]);

  return null;
}

function extractMuscleGroups(html) {
  const groups = new Set();
  const text = html.toLowerCase();

  // Look for muscle groups section
  const muscleSection = text.match(/muscle groups worked[^]*?(?=##|<h2|common mistakes|$)/i);
  const searchText = muscleSection ? muscleSection[0] : text;

  const muscleKeywords = {
    'shoulders': ['shoulder', 'deltoid', 'delt'],
    'back': ['back', 'lat', 'rhomboid', 'trap', 'erector'],
    'arms': ['arm', 'tricep', 'bicep', 'forearm'],
    'core': ['core', 'abdominal', 'abs', 'oblique'],
    'legs': ['leg', 'quad', 'hamstring', 'calf', 'calves'],
    'glutes': ['glute', 'gluteal', 'hip'],
    'chest': ['chest', 'pectoral', 'pec']
  };

  for (const [group, keywords] of Object.entries(muscleKeywords)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        groups.add(group);
        break;
      }
    }
  }

  return Array.from(groups);
}

function extractHowTo(html) {
  const howTo = {
    setup: null,
    execution: null,
    finish: null
  };

  // Look for setup/starting position
  const setupPatterns = [
    /(?:Setup Position|Starting Position|Setup)[^<]*<\/h[23]>\s*(?:<[^>]+>)*([^<]+)/i,
    /setup[,:]?\s*([^.]+\.)/i
  ];

  for (const pattern of setupPatterns) {
    const match = html.match(pattern);
    if (match && match[1].length > 30) {
      howTo.setup = cleanText(match[1]);
      break;
    }
  }

  // Look for execution/movement
  const execPatterns = [
    /(?:Bar Path|Execution|Movement|How to (?:Do|Perform))[^<]*<\/h[23]>\s*(?:<[^>]+>)*([^<]+)/i,
    /(?:press|pull|push|lift|lower)\s+the\s+(?:bar|weight|dumbbell)[^.]+\./i
  ];

  for (const pattern of execPatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].length > 30) {
      howTo.execution = cleanText(match[1]);
      break;
    }
  }

  // Look for finish position
  const finishPatterns = [
    /(?:Overhead Position|Finish Position|Lockout)[^<]*<\/h[23]>\s*(?:<[^>]+>)*([^<]+)/i,
    /(?:finish|end|complete)\s+position[^.]+\./i
  ];

  for (const pattern of finishPatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].length > 30) {
      howTo.finish = cleanText(match[1]);
      break;
    }
  }

  return howTo;
}

function extractCommonMistakes(html) {
  const mistakes = [];

  // Look for common mistakes section
  const mistakesSection = html.match(/Common Mistakes[^]*?(?=##|<h2|Modifications|Variations|$)/i);
  if (mistakesSection) {
    // Extract h3 headings which are typically the mistake names
    const mistakeMatches = mistakesSection[0].matchAll(/<h3[^>]*>([^<]+)<\/h3>/gi);
    for (const match of mistakeMatches) {
      const mistake = cleanText(match[1]);
      if (mistake && !mistake.toLowerCase().includes('common mistakes')) {
        mistakes.push(mistake);
      }
    }
  }

  return mistakes.length > 0 ? mistakes : null;
}

function extractVariations(html) {
  const variations = [];

  // Look for variations section
  const variationsSection = html.match(/(?:Variations|Related Movements)[^]*?(?=##|<h2|Common Workouts|Get Started|$)/i);
  if (variationsSection) {
    // Extract h3 headings or list items
    const varMatches = variationsSection[0].matchAll(/<h3[^>]*>([^<]+)<\/h3>|<li[^>]*>([^<]+)<\/li>/gi);
    for (const match of varMatches) {
      const variation = cleanText(match[1] || match[2]);
      if (variation && variation.length > 3 && !variation.toLowerCase().includes('variation')) {
        variations.push(variation);
      }
    }
  }

  return variations.length > 0 ? variations : null;
}

function extractEquipment(html) {
  const equipment = new Set();
  const text = html.toLowerCase();

  const equipmentKeywords = {
    'barbell': ['barbell', 'bar '],
    'dumbbells': ['dumbbell'],
    'kettlebell': ['kettlebell'],
    'pull-up bar': ['pull-up bar', 'pullup bar', 'rig'],
    'rings': ['ring', 'rings'],
    'box': ['box'],
    'medicine ball': ['medicine ball', 'med ball', 'wall ball'],
    'GHD': ['ghd', 'glute ham'],
    'rope': ['rope climb', 'climbing rope'],
    'jump rope': ['jump rope', 'skip rope', 'double-under', 'single-under'],
    'rower': ['rower', 'rowing', 'erg'],
    'PVC pipe': ['pvc'],
    'abmat': ['abmat']
  };

  for (const [equip, keywords] of Object.entries(equipmentKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        equipment.add(equip);
        break;
      }
    }
  }

  return Array.from(equipment);
}

async function scrapeMovement(movementInfo) {
  try {
    const html = await fetch(movementInfo.url);

    // Extract name from URL slug
    const slug = movementInfo.url.split('/').pop();
    const name = slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/^The /, 'The ');

    return {
      name: name,
      slug: slug,
      category: movementInfo.category,
      is_foundational: movementInfo.foundational,
      description: extractDescription(html),
      muscle_groups: extractMuscleGroups(html),
      equipment: extractEquipment(html),
      how_to: extractHowTo(html),
      common_mistakes: extractCommonMistakes(html),
      variations: extractVariations(html),
      youtube_url: extractYouTubeUrl(html),
      source_url: movementInfo.url
    };
  } catch (error) {
    console.error(`  Error scraping ${movementInfo.url}:`, error.message);
    return null;
  }
}

async function scrapeMovements() {
  console.log('Scraping movements from CrossFit.com...');
  const movements = [];

  for (let i = 0; i < MOVEMENT_URLS.length; i++) {
    const movementInfo = MOVEMENT_URLS[i];
    console.log(`  [${i + 1}/${MOVEMENT_URLS.length}] ${movementInfo.url.split('/').pop()}`);

    const movement = await scrapeMovement(movementInfo);
    if (movement) {
      movements.push(movement);
    }

    // Respectful delay between requests
    await sleep(DELAY_MS);
  }

  console.log(`  Found ${movements.length} movements`);
  return movements;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('CrossFit Data Scraper');
  console.log('=====================\n');

  // Scrape heroes
  const heroes = await scrapeHeroes();
  const heroesPath = path.join(OUTPUT_DIR, 'heroes.json');
  fs.writeFileSync(heroesPath, JSON.stringify({ heroes }, null, 2));
  console.log(`\nSaved ${heroes.length} heroes to ${heroesPath}`);

  // Scrape movements
  const movements = await scrapeMovements();
  const movementsPath = path.join(OUTPUT_DIR, 'movements.json');
  fs.writeFileSync(movementsPath, JSON.stringify({ movements }, null, 2));
  console.log(`\nSaved ${movements.length} movements to ${movementsPath}`);

  console.log('\nDone!');
}

// Run the scraper
main().catch(console.error);
