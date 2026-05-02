/**
 * fetch-parks-events.js
 *
 * Fetches Pittsburgh Parks Conservancy events via their iCal feed.
 * The feed is publicly accessible without browser spoofing.
 *
 * Feed URL: https://pittsburghparks.org/events/?ical=1
 *
 * Events are tagged by park/venue location, which we map to Pittsburgh
 * neighborhoods using the PARK_NEIGHBORHOODS lookup below.
 *
 * Events at Hays Woods (Baldwin, PA) are outside Pittsburgh city limits
 * and are excluded unless you want to include them.
 *
 * Run: node scripts/fetch-parks-events.js
 * Output: data/parks-events.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Park/venue name patterns → neighborhood mapping
// Matched against the start of the LOCATION field (case-insensitive)
const PARK_NEIGHBORHOODS = [
  { pattern: /allegheny commons/i,          neighborhood: 'Allegheny Center',       lat: 40.4568, lng: -80.0092 },
  { pattern: /highland park/i,              neighborhood: 'Highland Park',           lat: 40.4677, lng: -79.9212 },
  { pattern: /frick (environmental|park)/i, neighborhood: 'Point Breeze',            lat: 40.4285, lng: -79.9157 },
  { pattern: /beechwood blvd/i,             neighborhood: 'Point Breeze',            lat: 40.4285, lng: -79.9157 },
  { pattern: /schenley (plaza|park)/i,      neighborhood: 'Oakland',                 lat: 40.4408, lng: -79.9527 },
  { pattern: /panther hollow/i,             neighborhood: 'Oakland',                 lat: 40.4387, lng: -79.9489 },
  { pattern: /forbes ave.*15260/i,          neighborhood: 'Oakland',                 lat: 40.4408, lng: -79.9527 },
  { pattern: /riverview park/i,             neighborhood: 'Brighton Heights',        lat: 40.4862, lng: -80.0237 },
  { pattern: /emerald view/i,               neighborhood: 'Mount Washington',        lat: 40.4228, lng: -80.0017 },
  { pattern: /west penn park/i,             neighborhood: 'Bloomfield',              lat: 40.4571, lng: -79.9499 },
  { pattern: /mellon park/i,               neighborhood: 'Point Breeze North',      lat: 40.4543, lng: -79.9142 },
  { pattern: /ormsby park/i,               neighborhood: 'South Side Flats',        lat: 40.4271, lng: -79.9682 },
  { pattern: /herrs island/i,              neighborhood: 'East Allegheny',           lat: 40.4651, lng: -79.9884 },
  // Hays Woods is in Baldwin (outside Pittsburgh) — excluded by default
];

// Title-based fallback for events with no LOCATION field
const TITLE_NEIGHBORHOODS = [
  { pattern: /allegheny commons|lake elizabeth/i,  neighborhood: 'Allegheny Center',  lat: 40.4568, lng: -80.0092 },
  { pattern: /frick park|frick environmental/i,    neighborhood: 'Point Breeze',      lat: 40.4285, lng: -79.9157 },
  { pattern: /highland park/i,                     neighborhood: 'Highland Park',      lat: 40.4677, lng: -79.9212 },
  { pattern: /riverview park/i,                    neighborhood: 'Brighton Heights',   lat: 40.4862, lng: -80.0237 },
  { pattern: /schenley (park|plaza)/i,             neighborhood: 'Oakland',            lat: 40.4408, lng: -79.9527 },
  { pattern: /mellon park/i,                       neighborhood: 'Point Breeze North', lat: 40.4543, lng: -79.9142 },
  { pattern: /west penn park/i,                    neighborhood: 'Bloomfield',         lat: 40.4571, lng: -79.9499 },
];

function titleToNeighborhood(title) {
  if (!title) return null;
  for (const { pattern, neighborhood, lat, lng } of TITLE_NEIGHBORHOODS) {
    if (pattern.test(title)) return { neighborhood, lat, lng };
  }
  return null;
}

function locationToNeighborhood(locationStr) {
  if (!locationStr) return null;
  const loc = locationStr.replace(/\\,/g, ',').replace(/\\\\/g, '');

  // Check for Baldwin / Hays Woods → outside Pittsburgh, skip
  if (/hays woods|baldwin.*PA.*15236/i.test(loc)) return null;

  for (const { pattern, neighborhood, lat, lng } of PARK_NEIGHBORHOODS) {
    if (pattern.test(loc)) return { neighborhood, lat, lng };
  }

  // Fallback: try to match zip codes
  const zipMatch = loc.match(/PA[,\s]+(\d{5})/);
  if (zipMatch) {
    const zip = zipMatch[1];
    const ZIP_MAP = {
      '15212': { neighborhood: 'Allegheny Center', lat: 40.4556, lng: -80.0064 },
      '15206': { neighborhood: 'Highland Park',    lat: 40.4677, lng: -79.9212 },
      '15217': { neighborhood: 'Point Breeze',     lat: 40.4285, lng: -79.9157 },
      '15260': { neighborhood: 'Oakland',          lat: 40.4408, lng: -79.9527 },
      '15213': { neighborhood: 'Oakland',          lat: 40.4408, lng: -79.9527 },
      '15219': { neighborhood: 'Downtown',         lat: 40.4406, lng: -79.9959 },
      '15224': { neighborhood: 'Bloomfield',       lat: 40.4571, lng: -79.9499 },
      '15232': { neighborhood: 'Shadyside',        lat: 40.4521, lng: -79.9324 },
    };
    return ZIP_MAP[zip] || null;
  }

  return null;
}

function parseIcal(text) {
  const events = [];
  const vevents = text.split('BEGIN:VEVENT').slice(1);

  for (const block of vevents) {
    // Unfold continuation lines
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
    const rawLocation = get('LOCATION') || '';
    const title = get('SUMMARY');
    const desc = get('DESCRIPTION') || '';
    // Use location string, then title, then description for neighborhood lookup
    const neighborhoodInfo = locationToNeighborhood(rawLocation)
      || titleToNeighborhood(title)
      || titleToNeighborhood(desc);

    // Skip events outside Pittsburgh (Hays Woods, Baldwin, etc.)
    const isOutsidePittsburgh = /hays woods|baldwin.*PA.*15236/i.test(rawLocation);
    if (isOutsidePittsburgh) continue;

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
      end: parseDate(get('DTEND')),
      neighborhood: neighborhoodInfo?.neighborhood || null,
      neighborhood_lat: neighborhoodInfo?.lat || null,
      neighborhood_lng: neighborhoodInfo?.lng || null,
      location_full: rawLocation.replace(/\\,/g, ','),
      url: get('URL'),
      description: get('DESCRIPTION'),
      source: 'Pittsburgh Parks Conservancy',
    });
  }

  return events.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
}

// Fetch fresh iCal via curl and save locally
const icalPath = join(__dirname, '../data/parks-events.ical');
const outPath = join(__dirname, '../data/parks-events.json');
const url = 'https://pittsburghparks.org/events/?ical=1';

console.log(`Fetching via curl: ${url}`);
try {
  execSync(
    `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" ` +
    `-o "${icalPath}" "${url}"`
  );
} catch (e) {
  console.error('curl failed:', e.message);
  process.exit(1);
}

const text = readFileSync(icalPath, 'utf8');
console.log(`Fetched ${text.length} bytes`);

const events = parseIcal(text);

const byNeighborhood = {};
for (const ev of events) {
  const n = ev.neighborhood || 'Unmatched';
  if (!byNeighborhood[n]) byNeighborhood[n] = [];
  byNeighborhood[n].push(ev);
}

console.log(`\nParsed ${events.length} Parks Conservancy events:\n`);
for (const [n, evs] of Object.entries(byNeighborhood).sort()) {
  console.log(`  ${n}: ${evs.length} events`);
  for (const ev of evs) console.log(`    - ${ev.start?.slice(0, 10)} ${ev.title}`);
}

writeFileSync(outPath, JSON.stringify(events, null, 2));
console.log(`\nSaved to ${outPath}`);
