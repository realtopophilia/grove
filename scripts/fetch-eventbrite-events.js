/**
 * fetch-eventbrite-events.js
 *
 * Fetches Pittsburgh community events from Eventbrite by parsing the
 * structured JSON that Eventbrite embeds in every page as window.__SERVER_DATA__.
 * No API key required.
 *
 * Fetches all pages of:
 *   https://www.eventbrite.com/d/pa--pittsburgh/community--events/
 *
 * Events are filtered to Pittsburgh city zip codes and mapped to neighborhoods
 * using a ZIP → neighborhood lookup table.
 *
 * Run: node scripts/fetch-eventbrite-events.js
 * Output: data/eventbrite-events.json
 */

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Pittsburgh city ZIP codes → primary neighborhood
// Non-Pittsburgh ZIPs are not listed here and will be filtered out
const ZIP_NEIGHBORHOODS = {
  '15201': 'Central Lawrenceville',
  '15202': null,  // Emsworth - not Pittsburgh
  '15203': 'South Side Flats',
  '15204': 'Elliott',
  '15205': 'Westwood',
  '15206': 'East Liberty',
  '15207': 'Hazelwood',
  '15208': 'Point Breeze',
  '15210': 'Carrick',
  '15211': 'Mount Washington',
  '15212': 'Allegheny Center',
  '15213': 'Oakland',
  '15214': 'Perry South',
  '15215': null,  // Sharpsburg/Fox Chapel - not Pittsburgh
  '15216': 'Beechview',
  '15217': 'Squirrel Hill South',
  '15218': 'Swisshelm Park',
  '15219': 'Hill District',
  '15220': 'Westwood',
  '15221': null,  // Wilkinsburg - not Pittsburgh
  '15222': 'Downtown',
  '15223': null,  // Aspinwall - not Pittsburgh
  '15224': 'Bloomfield',
  '15225': null,  // Emsworth - not Pittsburgh
  '15226': 'Brookline',
  '15227': null,  // Baldwin - not Pittsburgh
  '15228': null,  // Mount Lebanon - not Pittsburgh
  '15229': null,  // West View - not Pittsburgh
  '15232': 'Shadyside',
  '15233': 'Manchester',
  '15234': null,  // Castle Shannon - not Pittsburgh
  '15237': null,  // Ross Township
  '15238': null,  // O'Hara Township
  '15243': null,  // Scott Township
};

// ZIP → approximate lat/lng for neighborhood pages
const ZIP_COORDS = {
  '15201': { lat: 40.4654, lng: -79.9573 },  // Lawrenceville
  '15203': { lat: 40.4271, lng: -79.9682 },  // South Side
  '15204': { lat: 40.4440, lng: -80.0378 },  // Elliott
  '15205': { lat: 40.4367, lng: -80.0610 },  // Westwood
  '15206': { lat: 40.4592, lng: -79.9270 },  // East Liberty
  '15207': { lat: 40.4095, lng: -79.9423 },  // Hazelwood
  '15208': { lat: 40.4441, lng: -79.8999 },  // Point Breeze / Homewood
  '15210': { lat: 40.3952, lng: -79.9961 },  // Carrick
  '15211': { lat: 40.4228, lng: -80.0017 },  // Mount Washington
  '15212': { lat: 40.4556, lng: -80.0064 },  // North Side
  '15213': { lat: 40.4408, lng: -79.9527 },  // Oakland
  '15214': { lat: 40.4715, lng: -79.9990 },  // Perry South
  '15216': { lat: 40.4087, lng: -80.0298 },  // Beechview
  '15217': { lat: 40.4345, lng: -79.9219 },  // Squirrel Hill
  '15218': { lat: 40.4276, lng: -79.8912 },  // Swisshelm Park
  '15219': { lat: 40.4432, lng: -79.9813 },  // Hill District
  '15220': { lat: 40.4367, lng: -80.0610 },  // Westwood
  '15222': { lat: 40.4406, lng: -79.9959 },  // Downtown
  '15224': { lat: 40.4571, lng: -79.9499 },  // Bloomfield
  '15226': { lat: 40.4010, lng: -80.0157 },  // Brookline
  '15232': { lat: 40.4521, lng: -79.9324 },  // Shadyside
  '15233': { lat: 40.4651, lng: -80.0089 },  // Manchester
};

function fetchPage(url, tmpPath) {
  execSync(
    `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" ` +
    `-H "Accept: text/html,application/xhtml+xml,*/*" ` +
    `-H "Accept-Language: en-US,en;q=0.9" ` +
    `-o "${tmpPath}" "${url}"`
  );
  return readFileSync(tmpPath, 'utf8');
}

function parseEventsFromHtml(html) {
  const idx = html.indexOf('__SERVER_DATA__ = ');
  if (idx === -1) return { events: [], next: null };
  const start = idx + '__SERVER_DATA__ = '.length;

  // Brace-match to extract the JSON object cleanly
  let depth = 0, i = start, inStr = false, esc = false;
  for (; i < html.length; i++) {
    const c = html[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }

  let data;
  try {
    data = JSON.parse(html.slice(start, i));
  } catch (e) {
    console.error('JSON parse error:', e.message);
    return { events: [], next: null };
  }

  const items = data.jsonld?.[0]?.itemListElement || [];
  return {
    events: items.map(it => it.item).filter(Boolean),
    next: data.rel_next_cat_browse || null,
  };
}

function processEvent(raw) {
  const zip = raw.location?.address?.postalCode;
  const city = raw.location?.address?.addressLocality || '';
  const state = raw.location?.address?.addressRegion || '';

  // Filter: must be in a Pittsburgh ZIP we recognize
  if (!zip || !(zip in ZIP_NEIGHBORHOODS)) return null;
  const neighborhood = ZIP_NEIGHBORHOODS[zip];
  if (!neighborhood) return null;  // ZIP is outside Pittsburgh

  const coords = ZIP_COORDS[zip] || {};

  // Use event's own lat/lng if available, otherwise use ZIP centroid
  const lat = raw.location?.geo?.latitude
    ? parseFloat(raw.location.geo.latitude)
    : coords.lat;
  const lng = raw.location?.geo?.longitude
    ? parseFloat(raw.location.geo.longitude)
    : coords.lng;

  // Parse startDate (format: "2026-05-15") — Eventbrite date-only, no time in jsonld
  // We'll use midnight as placeholder; the event URL has full time info
  const startIso = raw.startDate ? `${raw.startDate}T00:00:00` : null;

  const venueName = raw.location?.name || '';
  const street = raw.location?.address?.streetAddress || '';
  const locationFull = [venueName, street, city, state, zip].filter(Boolean).join(', ');

  return {
    title: raw.name,
    start: startIso,
    neighborhood,
    neighborhood_lat: lat,
    neighborhood_lng: lng,
    location_full: locationFull,
    url: raw.url,
    description: raw.description,
    image: raw.image,
    source: 'Eventbrite',
  };
}

// Main: paginate through all pages
const BASE = 'https://www.eventbrite.com';
const CATEGORIES = [
  '/d/pa--pittsburgh/community--events/',
];

const tmpPath = join(__dirname, '../data/.tmp_eb_fetch.html');
const allEvents = [];

for (const startPath of CATEGORIES) {
  let nextPath = startPath;
  let pageNum = 1;

  while (nextPath) {
    const url = nextPath.startsWith('http') ? nextPath : BASE + nextPath;
    console.log(`Fetching page ${pageNum}: ${url}`);

    const html = fetchPage(url, tmpPath);
    console.log(`  ${html.length} bytes`);

    const { events: rawEvents, next } = parseEventsFromHtml(html);
    console.log(`  Raw events: ${rawEvents.length}`);

    const processed = rawEvents.map(processEvent).filter(Boolean);
    console.log(`  Pittsburgh events: ${processed.length}`);

    allEvents.push(...processed);
    nextPath = next;
    pageNum++;

    // Safety: max 10 pages
    if (pageNum > 10) break;
  }
}

// Deduplicate by URL
const seen = new Set();
const unique = allEvents.filter(ev => {
  if (seen.has(ev.url)) return false;
  seen.add(ev.url);
  return true;
});

// Sort by date
unique.sort((a, b) => (a.start || '').localeCompare(b.start || ''));

// Summary
const byNeighborhood = {};
for (const ev of unique) {
  const n = ev.neighborhood;
  if (!byNeighborhood[n]) byNeighborhood[n] = [];
  byNeighborhood[n].push(ev);
}
console.log(`\nTotal Pittsburgh Eventbrite events: ${unique.length}`);
for (const [n, evs] of Object.entries(byNeighborhood).sort()) {
  console.log(`  ${n}: ${evs.length}`);
  for (const ev of evs) console.log(`    - ${ev.start?.slice(0, 10)} ${ev.title}`);
}

// Clean up temp file
try { unlinkSync(tmpPath); } catch {}

const outPath = join(__dirname, '../data/eventbrite-events.json');
writeFileSync(outPath, JSON.stringify(unique, null, 2));
console.log(`\nSaved to ${outPath}`);
