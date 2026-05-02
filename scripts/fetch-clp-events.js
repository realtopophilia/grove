/**
 * fetch-clp-events.js
 *
 * Fetches Carnegie Library of Pittsburgh events via their iCal feed.
 * Events are tagged by branch (Hazelwood, Hill District, etc.) which
 * maps cleanly to Pittsburgh neighborhoods.
 *
 * FETCHING: curl works with browser User-Agent headers (no Puppeteer needed).
 * Node's built-in fetch() returns 403. Use the curl approach:
 *
 *   curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
 *     -H "Accept: text/calendar,*\/*" \
 *     -o data/clp-events.ical \
 *     "https://www.carnegielibrary.org/events/list/?ical=1&start-date=YYYY-MM-DD&end-date=YYYY-MM-DD"
 *
 * Then run this script to parse the local .ical file into clp-events.json.
 *
 * PAGINATION: Feed returns the next 30 upcoming events. Date params filter
 * the window but don't page past 30. Re-run periodically to refresh.
 *
 * Branch → Neighborhood mapping: 17 branches confirmed (Homewood added 2026-05-01).
 *
 * Run: node scripts/fetch-clp-events.js
 * Output: data/clp-events.json
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// CLP Branch → Pittsburgh neighborhood mapping (17 branches as of 2026-05-01)
export const CLP_BRANCH_NEIGHBORHOODS = {
  'CLP – Allegheny':         { neighborhood: 'Allegheny Center', lat: 40.4556, lng: -80.0064 },
  'CLP – Beechview':         { neighborhood: 'Beechview', lat: 40.4087, lng: -80.0298 },
  'CLP – Brookline':         { neighborhood: 'Brookline', lat: 40.4010, lng: -80.0157 },
  'CLP – Carrick':           { neighborhood: 'Carrick', lat: 40.3952, lng: -79.9961 },
  'CLP – Downtown':          { neighborhood: 'Downtown', lat: 40.4406, lng: -79.9959 },
  'CLP – East Liberty':      { neighborhood: 'East Liberty', lat: 40.4592, lng: -79.9270 },
  'CLP – Hazelwood':         { neighborhood: 'Hazelwood', lat: 40.4095, lng: -79.9423 },
  'CLP – Hill District':     { neighborhood: 'Hill District', lat: 40.4432, lng: -79.9813 },
  'CLP – Homewood':          { neighborhood: 'Homewood North', lat: 40.4441, lng: -79.8999 },
  'CLP – Knoxville':         { neighborhood: 'Knoxville', lat: 40.4046, lng: -79.9907 },
  'CLP – Lawrenceville':     { neighborhood: 'Central Lawrenceville', lat: 40.4654, lng: -79.9573 },
  'CLP – Main (Oakland)':    { neighborhood: 'Oakland', lat: 40.4408, lng: -79.9527 },
  'CLP – Mt. Washington':    { neighborhood: 'Mount Washington', lat: 40.4228, lng: -80.0017 },
  'CLP – South Side':        { neighborhood: 'South Side Flats', lat: 40.4271, lng: -79.9682 },
  'CLP – Squirrel Hill':     { neighborhood: 'Squirrel Hill North', lat: 40.4345, lng: -79.9219 },
  'CLP – West End':          { neighborhood: 'West End', lat: 40.4401, lng: -80.0517 },
  'CLP – Woods Run':         { neighborhood: 'Woods Run', lat: 40.4771, lng: -80.0270 },
};

function parseIcal(text) {
  const events = [];
  const vevents = text.split('BEGIN:VEVENT').slice(1);

  for (const block of vevents) {
    // Handle line folding (iCal spec allows continuation lines with leading space/tab)
    const unfolded = block.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');

    const get = (field) => {
      const match = unfolded.match(new RegExp(field + '[^:]*:([^\r\n]+)'));
      return match ? match[1]
        .replace(/\\n/g, ' ')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .trim() : null;
    };

    const rawStart = get('DTSTART');
    const rawEnd = get('DTEND');
    const rawLocation = get('LOCATION') || '';

    // Parse the branch name from location (first segment before comma)
    const branchRaw = rawLocation.split('\\,')[0].split(',')[0].trim();
    const branchKey = Object.keys(CLP_BRANCH_NEIGHBORHOODS).find(k =>
      branchRaw.startsWith(k) || k.startsWith(branchRaw)
    ) || null;

    const neighborhood = branchKey
      ? CLP_BRANCH_NEIGHBORHOODS[branchKey]
      : null;

    // Parse date: YYYYMMDDTHHMMSS or YYYYMMDD
    const parseDate = (raw) => {
      if (!raw) return null;
      const clean = raw.replace(/[TZ]/g, '').replace(/[^0-9]/g, '');
      if (clean.length >= 8) {
        const y = clean.slice(0, 4);
        const mo = clean.slice(4, 6);
        const d = clean.slice(6, 8);
        const h = clean.slice(8, 10) || '00';
        const mi = clean.slice(10, 12) || '00';
        return `${y}-${mo}-${d}T${h}:${mi}:00`;
      }
      return null;
    };

    events.push({
      title: get('SUMMARY'),
      start: parseDate(rawStart),
      end: parseDate(rawEnd),
      branch: branchKey || branchRaw,
      neighborhood: neighborhood?.neighborhood || null,
      neighborhood_lat: neighborhood?.lat || null,
      neighborhood_lng: neighborhood?.lng || null,
      location_full: rawLocation.replace(/\\\,/g, ','),
      url: get('URL'),
      description: get('DESCRIPTION'),
    });
  }

  return events.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
}

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

/**
 * Fetch fresh iCal data via curl (works where Node fetch returns 403).
 * Saves to data/clp-events.ical, then parses it.
 */
function fetchAndParseClpEvents(startDate, endDate) {
  const icalPath = join(__dirname, '../data/clp-events.ical');
  const url = `https://www.carnegielibrary.org/events/list/?ical=1&start-date=${startDate}&end-date=${endDate}`;

  console.log(`Fetching via curl: ${url}`);
  execSync(
    `curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" ` +
    `-H "Accept: text/calendar,*/*" -o "${icalPath}" "${url}"`
  );

  const text = readFileSync(icalPath, 'utf8');
  console.log(`Fetched ${text.length} bytes → ${icalPath}`);
  return parseIcal(text);
}

// Parse from already-downloaded .ical file (or fetch fresh)
const icalPath = join(__dirname, '../data/clp-events.ical');
let events = [];
try {
  const text = readFileSync(icalPath, 'utf8');
  console.log(`Parsing existing ${icalPath}`);
  events = parseIcal(text);
} catch {
  console.log('No local .ical file found — fetching fresh data via curl...');
  events = fetchAndParseClpEvents('2026-05-01', '2026-08-31');
}

if (events.length > 0) {
  const byNeighborhood = {};
  for (const ev of events) {
    const n = ev.neighborhood || 'Unknown';
    if (!byNeighborhood[n]) byNeighborhood[n] = [];
    byNeighborhood[n].push(ev);
  }

  console.log(`\nFetched ${events.length} CLP events across ${Object.keys(byNeighborhood).length} neighborhoods:\n`);
  for (const [n, evs] of Object.entries(byNeighborhood).sort()) {
    console.log(`  ${n}: ${evs.length} events`);
  }

  const outPath = join(__dirname, '../data/clp-events.json');
  writeFileSync(outPath, JSON.stringify(events, null, 2));
  console.log(`\nSaved to ${outPath}`);
}
