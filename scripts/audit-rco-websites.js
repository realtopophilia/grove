/**
 * audit-rco-websites.js
 *
 * Checks each RCO's website for:
 * 1. Whether the site is live (HTTP 200)
 * 2. Whether there's an events or calendar page
 * 3. Common CMS indicators (WordPress, SquareSpace, Wix, etc.)
 *
 * Run: node scripts/audit-rco-websites.js
 * Output: data/rco-website-audit.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rcos = JSON.parse(readFileSync(join(__dirname, '../data/rcos.json'), 'utf8'));

const EVENT_KEYWORDS = [
  'events', 'calendar', 'meetings', 'agenda', 'upcoming',
  'schedule', 'news', 'announcements', 'community-meetings'
];

const CMS_SIGNATURES = {
  wordpress: ['wp-content', 'wp-json', 'wp-includes', 'xmlrpc.php'],
  squarespace: ['squarespace.com', 'static1.squarespace', 'sqsp'],
  wix: ['wix.com', 'wixstatic.com', '_wix_'],
  weebly: ['weebly.com', 'weeblysite.com'],
  godaddy: ['godaddy.com', 'godaddysites.com'],
  webflow: ['webflow.com', 'webflow.io'],
  google_sites: ['sites.google.com'],
};

async function checkSite(rco) {
  const result = {
    id: rco.id,
    name: rco.name,
    neighborhood: rco.neighborhood,
    url: rco.website || rco.facebook,
    web_type: rco.web_type,
    is_live: false,
    final_url: null,
    status_code: null,
    cms: null,
    has_events_page: false,
    events_page_url: null,
    events_page_candidates: [],
    error: null,
  };

  if (rco.web_type === 'facebook_only') {
    result.is_live = true; // assume FB is live
    result.notes = 'Facebook only — manual check needed';
    return result;
  }

  if (!rco.website) {
    result.error = 'No website';
    return result;
  }

  try {
    // Check main page
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(rco.website, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GroveBot/1.0; +https://github.com/realtopophilia/grove)'
      }
    });
    clearTimeout(timeout);

    result.status_code = res.status;
    result.final_url = res.url;
    result.is_live = res.status >= 200 && res.status < 400;

    if (result.is_live) {
      const html = await res.text();

      // Detect CMS
      for (const [cms, signatures] of Object.entries(CMS_SIGNATURES)) {
        if (signatures.some(sig => html.includes(sig) || res.url.includes(sig))) {
          result.cms = cms;
          break;
        }
      }

      // Look for events/calendar links in HTML
      const linkRegex = /href=["']([^"']*(?:event|calendar|meeting|agenda|news|upcoming)[^"']*)["']/gi;
      let match;
      const candidates = new Set();

      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1];
        if (!href.startsWith('http')) {
          const base = new URL(rco.website);
          href = `${base.origin}${href.startsWith('/') ? '' : '/'}${href}`;
        }
        candidates.add(href);
      }

      result.events_page_candidates = [...candidates].slice(0, 5);
      result.has_events_page = candidates.size > 0;
      result.events_page_url = result.events_page_candidates[0] || null;
    }
  } catch (err) {
    result.error = err.name === 'AbortError' ? 'Timeout' : err.message;
    result.is_live = false;
  }

  return result;
}

async function main() {
  console.log(`Auditing ${rcos.length} RCO websites...\n`);

  const results = [];

  for (const rco of rcos) {
    const site = rco.website || rco.facebook;
    process.stdout.write(`[${rco.id.toString().padStart(2, '0')}] ${rco.name.substring(0, 45).padEnd(45)} `);

    const result = await checkSite(rco);
    results.push(result);

    if (result.web_type === 'facebook_only') {
      console.log('FB  —');
    } else if (result.is_live) {
      const cms = result.cms ? ` (${result.cms})` : '';
      const events = result.has_events_page ? ' ✓ events' : '';
      console.log(`200${cms}${events}`);
    } else {
      console.log(`✗  ${result.status_code || result.error || 'dead'}`);
    }

    // Polite delay
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  const live = results.filter(r => r.is_live).length;
  const withEvents = results.filter(r => r.has_events_page).length;
  const dead = results.filter(r => !r.is_live && r.web_type !== 'facebook_only' && !r.error?.includes('No website')).length;
  const fbOnly = results.filter(r => r.web_type === 'facebook_only').length;

  console.log('\n--- Summary ---');
  console.log(`Total RCOs: ${rcos.length}`);
  console.log(`Live websites: ${live}`);
  console.log(`With events/calendar page: ${withEvents}`);
  console.log(`Dead or unreachable: ${dead}`);
  console.log(`Facebook only: ${fbOnly}`);

  const outPath = join(__dirname, '../data/rco-website-audit.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${outPath}`);
}

main().catch(console.error);
