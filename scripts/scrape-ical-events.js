/**
 * scrape-ical-events.js
 *
 * Fetches iCal feeds and HTML event pages from RCO websites.
 * Extracts structured event data: title, date, description, URL.
 *
 * Prioritizes:
 * 1. iCal feeds (?ical=1 from WordPress The Events Calendar)
 * 2. HTML event/calendar pages
 *
 * Run: node scripts/scrape-ical-events.js
 * Output: data/rco-events.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ICAL from 'ical.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const audit = JSON.parse(readFileSync(join(__dirname, '../data/rco-website-audit.json'), 'utf8'));
const rcos = JSON.parse(readFileSync(join(__dirname, '../data/rcos.json'), 'utf8'));

const rcoMap = Object.fromEntries(rcos.map(r => [r.id, r]));

// Sites with known iCal feeds (WordPress The Events Calendar)
const ICAL_SITES = audit
  .filter(r => r.events_page_url?.includes('ical=1') || r.events_page_candidates?.some(c => c.includes('ical=1')))
  .map(r => ({
    ...r,
    ical_url: r.events_page_candidates?.find(c => c.includes('ical=1')) || r.events_page_url
  }));

// Sites with HTML event pages worth scraping
const HTML_EVENT_SITES = [
  { id: 4,  url: 'https://www.bcg15210.org/news' },
  { id: 5,  url: 'https://bloomfieldalliance.org/agendas-minutes' },
  { id: 9,  url: 'https://www.brooklinetogether.org/events' },
  { id: 19, url: 'https://www.hazelwoodinitiative.org/events' },
  { id: 22, url: 'https://hillvoices.org/events' },
  { id: 26, url: 'https://www.larimerconsensusgroup.org/calendar' },
  { id: 33, url: 'https://oakcliffe.org/oco-calendar/' },
  { id: 34, url: 'https://oaklandpittsburgh.com/events' },
  { id: 38, url: 'https://pointbreezenorth.com/events' },
  { id: 48, url: 'https://www.eastliberty.org/news-events/' },
];

async function fetchIcal(rcoAudit) {
  const rco = rcoMap[rcoAudit.id];
  const result = {
    rco_id: rco.id,
    rco_name: rco.name,
    neighborhood: rco.neighborhood,
    source: 'ical',
    ical_url: rcoAudit.ical_url,
    events: [],
    error: null,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(rcoAudit.ical_url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GroveBot/1.0)' }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      result.error = `HTTP ${res.status}`;
      return result;
    }

    const text = await res.text();
    const jcal = ICAL.parse(text);
    const comp = new ICAL.Component(jcal);
    const vevents = comp.getAllSubcomponents('vevent');

    const now = new Date();
    const sixMonthsOut = new Date(now);
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);

    for (const vevent of vevents) {
      const ev = new ICAL.Event(vevent);
      const startDate = ev.startDate?.toJSDate?.();
      const endDate = ev.endDate?.toJSDate?.();

      // Only include events from today forward (or last 30 days for context)
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (startDate && startDate >= thirtyDaysAgo) {
        result.events.push({
          title: ev.summary || '(untitled)',
          start: startDate?.toISOString() || null,
          end: endDate?.toISOString() || null,
          description: ev.description || null,
          location: ev.location || null,
          url: ev.url || rco.website,
        });
      }
    }

    // Sort by start date
    result.events.sort((a, b) => new Date(a.start) - new Date(b.start));
    console.log(`  ✓ ${result.events.length} events`);
  } catch (err) {
    result.error = err.name === 'AbortError' ? 'Timeout' : err.message;
    console.log(`  ✗ ${result.error}`);
  }

  return result;
}

async function fetchHtmlEvents(item) {
  const rco = rcoMap[item.id];
  const result = {
    rco_id: rco.id,
    rco_name: rco.name,
    neighborhood: rco.neighborhood,
    source: 'html',
    page_url: item.url,
    events: [],
    raw_text: null,
    error: null,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(item.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GroveBot/1.0)' }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      result.error = `HTTP ${res.status}`;
      return result;
    }

    const html = await res.text();

    // Extract visible text (crude but effective for research)
    const textContent = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s{3,}/g, '\n\n')
      .trim();

    // Store first 3000 chars for manual review
    result.raw_text = textContent.substring(0, 3000);

    // Try to find date patterns: Month DD, YYYY or MM/DD/YYYY
    const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi;
    const dateMatches = [...new Set(textContent.match(datePattern) || [])];
    result.dates_found = dateMatches;

    console.log(`  ✓ fetched (${textContent.length} chars, ${dateMatches.length} date mentions)`);
  } catch (err) {
    result.error = err.name === 'AbortError' ? 'Timeout' : err.message;
    console.log(`  ✗ ${result.error}`);
  }

  return result;
}

async function main() {
  const allResults = [];

  // Phase 1: iCal feeds
  console.log(`\n=== Phase 1: iCal feeds (${ICAL_SITES.length} sites) ===\n`);
  for (const site of ICAL_SITES) {
    console.log(`[${site.id}] ${site.name}`);
    const result = await fetchIcal(site);
    allResults.push(result);
    await new Promise(r => setTimeout(r, 400));
  }

  // Phase 2: HTML event pages
  console.log(`\n=== Phase 2: HTML event pages (${HTML_EVENT_SITES.length} sites) ===\n`);
  for (const item of HTML_EVENT_SITES) {
    const rco = rcoMap[item.id];
    console.log(`[${item.id}] ${rco.name}`);
    const result = await fetchHtmlEvents(item);
    allResults.push(result);
    await new Promise(r => setTimeout(r, 400));
  }

  // Summary
  const totalEvents = allResults.reduce((sum, r) => sum + (r.events?.length || 0), 0);
  const withEvents = allResults.filter(r => (r.events?.length || 0) > 0).length;

  console.log('\n=== Results ===');
  console.log(`Sources checked: ${allResults.length}`);
  console.log(`Sources with parsed events: ${withEvents}`);
  console.log(`Total structured events extracted: ${totalEvents}`);

  const outPath = join(__dirname, '../data/rco-events.json');
  writeFileSync(outPath, JSON.stringify(allResults, null, 2));
  console.log(`\nSaved to ${outPath}`);

  // Print events summary
  console.log('\n=== Events by RCO ===');
  allResults
    .filter(r => (r.events?.length || 0) > 0)
    .forEach(r => {
      console.log(`\n${r.rco_name} (${r.events.length} events):`);
      r.events.slice(0, 3).forEach(ev => {
        const d = ev.start ? new Date(ev.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
        console.log(`  ${d}: ${ev.title}`);
      });
      if (r.events.length > 3) console.log(`  ... and ${r.events.length - 3} more`);
    });
}

main().catch(console.error);
