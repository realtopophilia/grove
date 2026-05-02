/**
 * fetch-meetup-events.js
 *
 * Fetches Pittsburgh Meetup events via Meetup's public GraphQL API (gql2).
 * No API key or authentication required.
 *
 * Uses cursor-based pagination via recommendedEvents query centered on
 * Pittsburgh (40.4406, -79.9959). Filters to Pittsburgh city ZIP codes
 * and maps venue coordinates to neighborhoods.
 *
 * Run: node scripts/fetch-meetup-events.js
 * Output: data/meetup-events.json
 */

import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Same Pittsburgh ZIP → neighborhood table used by Eventbrite
const ZIP_NEIGHBORHOODS = {
  '15201': 'Central Lawrenceville',
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
  '15216': 'Beechview',
  '15217': 'Squirrel Hill South',
  '15218': 'Swisshelm Park',
  '15219': 'Hill District',
  '15220': 'Westwood',
  '15222': 'Downtown',
  '15224': 'Bloomfield',
  '15226': 'Brookline',
  '15232': 'Shadyside',
  '15233': 'Manchester',
};

const ZIP_COORDS = {
  '15201': { lat: 40.4654, lng: -79.9573 },
  '15203': { lat: 40.4271, lng: -79.9682 },
  '15204': { lat: 40.4440, lng: -80.0378 },
  '15205': { lat: 40.4367, lng: -80.0610 },
  '15206': { lat: 40.4592, lng: -79.9270 },
  '15207': { lat: 40.4095, lng: -79.9423 },
  '15208': { lat: 40.4441, lng: -79.8999 },
  '15210': { lat: 40.3952, lng: -79.9961 },
  '15211': { lat: 40.4228, lng: -80.0017 },
  '15212': { lat: 40.4556, lng: -80.0064 },
  '15213': { lat: 40.4408, lng: -79.9527 },
  '15214': { lat: 40.4715, lng: -79.9990 },
  '15216': { lat: 40.4087, lng: -80.0298 },
  '15217': { lat: 40.4345, lng: -79.9219 },
  '15218': { lat: 40.4276, lng: -79.8912 },
  '15219': { lat: 40.4432, lng: -79.9813 },
  '15220': { lat: 40.4367, lng: -80.0610 },
  '15222': { lat: 40.4406, lng: -79.9959 },
  '15224': { lat: 40.4571, lng: -79.9499 },
  '15226': { lat: 40.4010, lng: -80.0157 },
  '15232': { lat: 40.4521, lng: -79.9324 },
  '15233': { lat: 40.4651, lng: -80.0089 },
};

// Sentinel lat/lon Meetup uses for online events
const ONLINE_LAT = -8.521147;

const QUERY = `
  query($lat: Float!, $lon: Float!, $after: String) {
    recommendedEvents(
      filter: { lat: $lat, lon: $lon, doConsolidateEvents: true }
      sort: { sortField: RELEVANCE }
      after: $after
    ) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          dateTime
          eventUrl
          venue {
            name
            city
            lat
            lon
            address
            postalCode
          }
          group {
            name
            urlname
          }
        }
      }
    }
  }
`;

const TMP_PAYLOAD = join(__dirname, '../data/.tmp_meetup_payload.json');
const TMP_RESPONSE = join(__dirname, '../data/.tmp_meetup_response.json');

function gqlFetch(variables) {
  writeFileSync(TMP_PAYLOAD, JSON.stringify({ query: QUERY, variables }));
  execSync(
    `curl -s -X POST "https://www.meetup.com/gql2" ` +
    `-H "Content-Type: application/json" ` +
    `-H "Accept: application/json" ` +
    `-A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" ` +
    `--data "@${TMP_PAYLOAD}" ` +
    `-o "${TMP_RESPONSE}"`
  );
  return JSON.parse(readFileSync(TMP_RESPONSE, 'utf8'));
}

function processEvent(node) {
  const venue = node.venue;

  // Skip online events
  if (!venue || Math.abs(venue.lat - ONLINE_LAT) < 0.01) return null;
  // Skip events outside Pittsburgh city limits
  if (venue.city && venue.city !== 'Pittsburgh') return null;

  const zip = venue.postalCode?.trim();
  if (!zip || !(zip in ZIP_NEIGHBORHOODS)) return null;
  const neighborhood = ZIP_NEIGHBORHOODS[zip];

  const coords = ZIP_COORDS[zip] || {};
  const lat = venue.lat || coords.lat;
  const lng = venue.lon || coords.lng;

  const locationParts = [venue.name, venue.address, venue.city].filter(Boolean);
  if (zip) locationParts.push(`PA ${zip}`);

  return {
    title: node.title,
    start: node.dateTime,
    neighborhood,
    neighborhood_lat: lat,
    neighborhood_lng: lng,
    location_full: locationParts.join(', '),
    url: node.eventUrl,
    group: node.group?.name || null,
    source: 'Meetup',
  };
}

// Paginate through all results
const allEvents = [];
let after = null;
let page = 1;

while (true) {
  console.log(`Fetching page ${page}${after ? ` (cursor: ${after})` : ''}...`);
  const resp = gqlFetch({ lat: 40.4406, lon: -79.9959, after });
  const conn = resp.data?.recommendedEvents;

  if (!conn) {
    console.error('Unexpected response:', JSON.stringify(resp).slice(0, 200));
    break;
  }

  const edges = conn.edges || [];
  console.log(`  ${edges.length} events (total: ${conn.totalCount})`);

  for (const { node } of edges) {
    const ev = processEvent(node);
    if (ev) allEvents.push(ev);
  }

  if (!conn.pageInfo.hasNextPage) break;
  after = conn.pageInfo.endCursor;
  page++;
  if (page > 20) break; // safety
}

// Deduplicate by URL
const seen = new Set();
const unique = allEvents.filter(ev => {
  if (seen.has(ev.url)) return false;
  seen.add(ev.url);
  return true;
});

unique.sort((a, b) => (a.start || '').localeCompare(b.start || ''));

const byNeighborhood = {};
for (const ev of unique) {
  if (!byNeighborhood[ev.neighborhood]) byNeighborhood[ev.neighborhood] = [];
  byNeighborhood[ev.neighborhood].push(ev);
}

console.log(`\nTotal Pittsburgh Meetup events: ${unique.length}`);
for (const [n, evs] of Object.entries(byNeighborhood).sort()) {
  console.log(`  ${n}: ${evs.length}`);
  for (const ev of evs) console.log(`    - ${ev.start?.slice(0, 10)} ${ev.title}`);
}

const outPath = join(__dirname, '../data/meetup-events.json');
writeFileSync(outPath, JSON.stringify(unique, null, 2));
console.log(`\nSaved to ${outPath}`);
