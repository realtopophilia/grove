// fetch-rco-events.js
// Pulls upcoming events from org websites that expose machine-readable feeds.
//
// Strategy per site type:
//   wordpress-tribe  → /wp-json/tribe/events/v1/events (primary, clean JSON)
//   ical             → ?ical=1 (fallback for sites without Tribe API)
//   squarespace      → /events?format=json-ld
//
// Usage: node scripts/fetch-rco-events.js
// Writes: data/rco-events.json

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const dataDir = join(process.cwd(), 'data')
const rcos    = JSON.parse(readFileSync(join(dataDir, 'rcos-enriched.json'), 'utf8'))
const nrcos   = JSON.parse(readFileSync(join(dataDir, 'non-rco-orgs.json'), 'utf8'))

// All orgs with websites where we confirmed an event plugin exists
const SOURCES = [
  // id, source-type, org-source, preferred method
  { id: 6,  src: 'rco',  method: 'tribe', base: 'https://bloomfieldpgh.org' },
  // bloomfield-garfield.org blocks API — skip for now
  { id: 11, src: 'rco',  method: 'tribe', base: 'https://csacpa.org' },
  { id: 14, src: 'rco',  method: 'ical',  icalUrl: 'https://deutschtown.org/events/?ical=1', base: 'https://deutschtown.org' },
  { id: 15, src: 'rco',  method: 'tribe', base: 'https://www.easthillsconsensusgroup.org' },
  { id: 21, src: 'rco',  method: 'ical',  icalUrl: 'https://www.hilldistrict.org/events/?ical=1', base: 'https://www.hilldistrict.org' },
  { id: 43, src: 'rco',  method: 'tribe', base: 'https://www.southsideslopes.org' },
  { id: 47, src: 'rco',  method: 'tribe', base: 'https://www.uptownpartners.org' },
  // Squarespace
  { id: 5,  src: 'rco',  method: 'squarespace', base: 'https://bloomfieldalliance.org' },
  { id: 35, src: 'rco',  method: 'squarespace', base: 'https://www.opdc.org' },
  { id: 38, src: 'rco',  method: 'squarespace', base: 'https://www.pointbreezenorth.com' },
  { id: 'nrco-03', src: 'nrco', method: 'squarespace', base: 'https://morningsidepgh.org' },
  { id: 'nrco-05', src: 'nrco', method: 'squarespace', base: 'https://www.stantonheights.org' },
]

const HORIZON_DAYS = 120
const DELAY_MS     = 700
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function curlGet(url, acceptJson = false) {
  try {
    const accept = acceptJson ? 'application/json' : 'text/calendar,text/html,*/*'
    return execSync(
      `curl -sL --max-time 12 -A "${UA}" -H "Accept: ${accept}" -H "Accept-Language: en-US,en;q=0.9" "${url}"`,
      { encoding: 'utf8', timeout: 18000 }
    )
  } catch { return null }
}

function isUpcoming(isoStr) {
  if (!isoStr) return false
  const d = new Date(isoStr)
  const now = new Date()
  return d >= now && d <= new Date(now.getTime() + HORIZON_DAYS * 86400000)
}

function stripHtml(str) {
  return (str || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#8211;/g,'–').replace(/&#8220;/g,'"').replace(/&#8221;/g,'"').trim()
}

// ── Tribe REST API ────────────────────────────────────────────────────────────

function fetchTribe(base, orgId, orgName, neighborhoods) {
  const url = `${base}/wp-json/tribe/events/v1/events?per_page=20&status=publish`
  const text = curlGet(url, true)
  if (!text || text.trim().startsWith('<')) return { events: [], status: 'blocked' }
  try {
    const data = JSON.parse(text)
    if (!data.events) return { events: [], status: 'no-events-key' }
    const events = data.events
      .filter(e => isUpcoming(e.start_date))
      .map(e => ({
        orgId, orgName, neighborhoods,
        name: stripHtml(e.title),
        start: e.start_date ? e.start_date.replace(' ', 'T') + '-04:00' : null,
        end:   e.end_date   ? e.end_date.replace(' ', 'T')   + '-04:00' : null,
        url:   e.url || null,
        location: e.venue?.address ? `${e.venue.address}${e.venue.city ? ', ' + e.venue.city : ''}` : null,
        description: e.description ? stripHtml(e.description).slice(0, 200) : null,
        source: 'rco-tribe',
      }))
    return { events, status: `ok:${data.total ?? events.length}` }
  } catch { return { events: [], status: 'parse-error' } }
}

// ── iCal ─────────────────────────────────────────────────────────────────────

function parseIcalDate(raw) {
  if (!raw) return null
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`
  if (/^\d{8}T\d{6}$/.test(raw)) {
    return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T${raw.slice(9,11)}:${raw.slice(11,13)}:${raw.slice(13,15)}-04:00`
  }
  if (/^\d{8}T\d{6}Z$/.test(raw)) {
    return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T${raw.slice(9,11)}:${raw.slice(11,13)}:${raw.slice(13,15)}Z`
  }
  return null
}

function fetchIcal(url, orgId, orgName, neighborhoods) {
  const text = curlGet(url)
  if (!text || !text.includes('BEGIN:VCALENDAR')) return { events: [], status: 'no-ical' }
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
  const blocks = unfolded.split(/BEGIN:VEVENT/)
  const events = []
  for (const block of blocks.slice(1)) {
    const get = k => { const m = block.match(new RegExp(`${k}(?:;[^:\\r\\n]+)?:([^\\r\\n]+)`, 'i')); return m ? m[1].trim() : null }
    const start = parseIcalDate(get('DTSTART'))
    const end   = parseIcalDate(get('DTEND'))
    if (!start || !isUpcoming(start)) continue
    const name = (get('SUMMARY') || '').replace(/\\[,;nN]/g, m => m[1] === 'n' || m[1] === 'N' ? ' ' : m[1]).trim()
    if (!name) continue
    const rawDesc = (get('DESCRIPTION') || '').replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\/g, '').trim()
    events.push({
      orgId, orgName, neighborhoods,
      name,
      start, end,
      url: get('URL') || null,
      location: (get('LOCATION') || '').replace(/\\,/g, ',').replace(/\\n/g, ', ') || null,
      description: rawDesc ? rawDesc.slice(0, 200) : null,
      source: 'rco-ical',
    })
  }
  return { events, status: `ok:${events.length}` }
}

// ── Squarespace ───────────────────────────────────────────────────────────────

function fetchSquarespace(base, orgId, orgName, neighborhoods) {
  // Squarespace native events API — format=json returns items[] with ms-timestamp dates
  const text = curlGet(`${base}/events?format=json`, true)
  if (!text) return { events: [], status: 'no-response' }
  try {
    const parsed = JSON.parse(text)
    // Items live at top-level parsed.items for events collections; collection.items as fallback
    const items = parsed.items || parsed.collection?.items || []
    const typeName = parsed.collection?.typeName || 'unknown'

    // Skip non-events collections (typeName: 'page' = static page, no event data)
    if (typeName === 'page') return { events: [], status: 'not-events-collection' }

    const now = Date.now()
    const horizon = now + HORIZON_DAYS * 86400000

    const events = items
      .filter(item => {
        if (!item.startDate) return false
        // startDate is Unix ms timestamp
        return item.startDate >= now && item.startDate <= horizon
      })
      .map(item => ({
        orgId, orgName, neighborhoods,
        name: stripHtml(item.title || ''),
        start: new Date(item.startDate).toISOString(),
        end:   item.endDate ? new Date(item.endDate).toISOString() : null,
        url:   item.fullUrl ? `${base}${item.fullUrl}` : null,
        location: item.location?.addressLine1 || item.location?.addressTitle || null,
        description: item.excerpt ? stripHtml(item.excerpt).slice(0, 200) : null,
        source: 'rco-squarespace',
      }))
      .filter(e => e.name)
    return { events, status: `ok:${items.length}` }
  } catch { return { events: [], status: 'parse-error' } }
}

// ── Org lookup ───────────────────────────────────────────────────────────────

function normalizeNeighborhoods(raw) {
  if (!raw) return []
  return raw.split(/\s*[\/,]\s*|\s+and\s+/i).map(s => s.trim()).filter(Boolean)
}

function getOrgInfo(id, srcType) {
  if (srcType === 'rco') {
    const r = rcos.find(r => r.id === id)
    return r ? { name: r.name, neighborhoods: normalizeNeighborhoods(r.neighborhood) } : null
  }
  const o = nrcos.find(o => o.id === id)
  return o ? { name: o.name, neighborhoods: o.neighborhoods || [] } : null
}

// ── Main ─────────────────────────────────────────────────────────────────────

const allEvents = []
let totalFetched = 0

console.log(`Fetching events from ${SOURCES.length} org websites...\n`)

for (const src of SOURCES) {
  const org = getOrgInfo(src.id, src.src)
  if (!org) { console.log(`  [${src.id}] ✗ org not found`); continue }

  process.stdout.write(`  ${org.name.slice(0, 48).padEnd(48)} `)

  let result
  if (src.method === 'tribe') {
    result = fetchTribe(src.base, src.id, org.name, org.neighborhoods)
    // If tribe is blocked, fall back to ical if url available
    if (result.status === 'blocked' && src.icalUrl) {
      result = fetchIcal(src.icalUrl, src.id, org.name, org.neighborhoods)
    }
  } else if (src.method === 'ical') {
    result = fetchIcal(src.icalUrl, src.id, org.name, org.neighborhoods)
    // Fall back to tribe REST if ical is empty
    if (result.events.length === 0 && src.base) {
      const tribeResult = fetchTribe(src.base, src.id, org.name, org.neighborhoods)
      if (tribeResult.events.length > 0) result = tribeResult
    }
  } else {
    result = fetchSquarespace(src.base, src.id, org.name, org.neighborhoods)
  }

  allEvents.push(...result.events)
  totalFetched += result.events.length
  const icon = result.events.length > 0 ? '✓' : result.status.startsWith('ok') ? '·' : '✗'
  console.log(`${icon} ${result.events.length} events  [${result.status}]`)

  await sleep(DELAY_MS)
}

allEvents.sort((a, b) => (a.start || '').localeCompare(b.start || ''))

writeFileSync(join(dataDir, 'rco-events.json'), JSON.stringify(allEvents, null, 2))

console.log(`\n── Total: ${totalFetched} upcoming events across ${[...new Set(allEvents.map(e => e.orgId))].length} orgs`)
console.log(`   Saved → data/rco-events.json`)
if (allEvents.length > 0) {
  console.log('\nUpcoming:')
  allEvents.slice(0, 8).forEach(e =>
    console.log(`  ${e.start?.slice(0,10)} [${e.orgName.slice(0,22).padEnd(22)}] ${e.name.slice(0,45)}`))
}
