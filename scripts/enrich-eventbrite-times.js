/**
 * enrich-eventbrite-times.js
 *
 * Second-pass fetch: reads data/eventbrite-events.json, fetches each event's
 * individual page, and extracts the precise start/end time from the
 * <meta property="event:start_time"> tag in the HTML <head>.
 *
 * The list-page fetch only gives date (YYYY-MM-DD). This fills in the time.
 *
 * Adds a 1-second delay between requests to be polite to Eventbrite.
 *
 * Run AFTER: node scripts/fetch-eventbrite-events.js
 * Run: node scripts/enrich-eventbrite-times.js
 * Updates: data/eventbrite-events.json in place
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../data/eventbrite-events.json');
const tmpPath = join(__dirname, '../data/.tmp_eb_event.html');

function fetchPage(url) {
  execSync(
    `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" ` +
    `-H "Accept: text/html,*/*" ` +
    `-H "Accept-Language: en-US,en;q=0.9" ` +
    `-o "${tmpPath}" "${url}"`
  );
  return readFileSync(tmpPath, 'utf8');
}

function extractTimes(html) {
  const startMatch = html.match(/<meta property="event:start_time" content="([^"]+)"/);
  const endMatch   = html.match(/<meta property="event:end_time" content="([^"]+)"/);
  return {
    start: startMatch?.[1] || null,
    end:   endMatch?.[1]   || null,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const events = JSON.parse(readFileSync(dataPath, 'utf8'));
console.log(`Enriching times for ${events.length} events...\n`);

let updated = 0;
let failed = 0;

for (let i = 0; i < events.length; i++) {
  const ev = events[i];
  process.stdout.write(`[${i + 1}/${events.length}] ${ev.title.slice(0, 50)}... `);

  try {
    const html = fetchPage(ev.url);
    const { start, end } = extractTimes(html);

    if (start) {
      ev.start = start;
      if (end) ev.end = end;
      console.log(`✓ ${start}`);
      updated++;
    } else {
      console.log('⚠ no time found');
      failed++;
    }
  } catch (e) {
    console.log(`✗ fetch error: ${e.message.slice(0, 40)}`);
    failed++;
  }

  // Polite delay between requests (skip after last one)
  if (i < events.length - 1) {
    await sleep(1000);
  }
}

// Save updated events
writeFileSync(dataPath, JSON.stringify(events, null, 2));
console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
console.log(`Saved to ${dataPath}`);
