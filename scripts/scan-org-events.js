// scan-org-events.js — probe each org website for machine-readable event data
//
// Checks in order:
//   1. <link rel="alternate" type="text/calendar"> → iCal feed
//   2. JSON-LD with @type Event or EventSeries
//   3. WordPress The Events Calendar REST API  (/wp-json/tribe/events/v1/events)
//   4. Generic /wp-json/wp/v2/posts?categories=... (fallback)
//
// Usage: node scripts/scan-org-events.js
// Output: summary table + writes data/org-event-sources.json

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const dataDir = join(process.cwd(), 'data')
const rcos    = JSON.parse(readFileSync(join(dataDir, 'rcos-enriched.json'), 'utf8'))
const nrcos   = JSON.parse(readFileSync(join(dataDir, 'non-rco-orgs.json'),  'utf8'))

const TIMEOUT = 8000
const DELAY   = 500
const UA      = 'Mozilla/5.0 (compatible; Grove/1.0; +https://github.com/realtopophilia/grove)'

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/json,*/*', ...(opts.headers||{}) } })
    clearTimeout(t)
    return res
  } catch (e) {
    clearTimeout(t)
    return null
  }
}

async function detectEventSources(name, url) {
  if (!url || url.includes('facebook.com')) return { type: 'none', reason: 'no website or facebook-only' }

  // --- 1. Fetch the homepage HTML ---
  const res = await fetchWithTimeout(url)
  if (!res || !res.ok) return { type: 'none', reason: `homepage ${res?.status || 'unreachable'}` }

  const html = await res.text()
  const finalUrl = res.url  // after redirects

  // --- 2. iCal feed link ---
  const icalMatch = html.match(/<link[^>]+type=["']text\/calendar["'][^>]+href=["']([^"']+)["']/i)
                 || html.match(/href=["']([^"']+\.ics[^"']*)["']/i)
                 || html.match(/href=["']([^"']*webcal:\/\/[^"']*)["']/i)
  if (icalMatch) return { type: 'ical', url: icalMatch[1].replace(/^webcal:/, 'https:') }

  // --- 3. JSON-LD Event ---
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const s of scripts) {
    try {
      const data = JSON.parse(s[1])
      const items = Array.isArray(data) ? data : [data]
      if (items.some(d => ['Event','EventSeries','MusicEvent','SocialEvent'].includes(d['@type']))) {
        return { type: 'jsonld', note: 'Event JSON-LD on homepage' }
      }
    } catch {}
  }

  // --- 4. WordPress The Events Calendar REST API ---
  const base = new URL(finalUrl).origin
  const tribeRes = await fetchWithTimeout(`${base}/wp-json/tribe/events/v1/events?per_page=5&status=publish`, {
    headers: { Accept: 'application/json' }
  })
  if (tribeRes?.ok) {
    try {
      const j = await tribeRes.json()
      if (j.events && j.events.length > 0) return { type: 'wordpress-tribe', url: `${base}/wp-json/tribe/events/v1/events` }
      if (j.events) return { type: 'wordpress-tribe-empty', url: `${base}/wp-json/tribe/events/v1/events`, note: 'API exists but no events' }
    } catch {}
  }

  // --- 5. Squarespace events page hint ---
  if (html.includes('squarespace.com') || html.includes('static1.squarespace.com')) {
    const eventsMatch = html.match(/href=["'](\/events[^"']*)["']/i)
    if (eventsMatch) return { type: 'squarespace', eventsPath: eventsMatch[1], note: 'Squarespace site with /events path' }
  }

  // --- 6. Wix ---
  if (html.includes('wix.com') || html.includes('wixstatic.com')) {
    return { type: 'wix', note: 'Wix site — dynamic content not scrapable' }
  }

  return { type: 'none', reason: 'no machine-readable events found' }
}

// Build combined list: only orgs with websites
const orgs = [
  ...rcos.map(r  => ({ id: r.id, name: r.name, website: r.website, source: 'rco' })),
  ...nrcos.map(o => ({ id: o.id, name: o.name, website: o.website, source: 'nrco' })),
].filter(o => o.website && !o.website.includes('facebook.com'))

console.log(`Scanning ${orgs.length} org websites...\n`)

const results = []
for (let i = 0; i < orgs.length; i++) {
  const org = orgs[i]
  process.stdout.write(`[${String(i+1).padStart(2)}/${orgs.length}] ${org.name.slice(0,45).padEnd(45)} `)
  const found = await detectEventSources(org.name, org.website)
  results.push({ ...org, ...found })
  const icon = found.type === 'none' ? '·' : found.type === 'wix' ? '~' : '✓'
  console.log(`${icon} ${found.type}${found.note ? ' — '+found.note : ''}${found.url ? ' → '+found.url : ''}`)
  await new Promise(r => setTimeout(r, DELAY))
}

// Summary
console.log('\n=== ACTIONABLE SOURCES ===')
const actionable = results.filter(r => !['none','wix'].includes(r.type))
for (const r of actionable) {
  console.log(`  [${r.source}] ${r.name}`)
  console.log(`    type: ${r.type}`)
  if (r.url) console.log(`    url:  ${r.url}`)
  if (r.note) console.log(`    note: ${r.note}`)
}

console.log(`\n${actionable.length} actionable sources out of ${orgs.length} scanned`)

writeFileSync(join(dataDir, 'org-event-sources.json'), JSON.stringify(results, null, 2))
console.log('Results saved to data/org-event-sources.json')
