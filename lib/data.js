import { readFileSync } from 'fs'
import { join } from 'path'

const dataDir = join(process.cwd(), 'data')

function load(file) {
  return JSON.parse(readFileSync(join(dataDir, file), 'utf8'))
}

export function getClpEvents() {
  return load('clp-events.json')
}

export function getRcos() {
  return load('rcos-enriched.json')
}

export function getNonRcoOrgs() {
  return load('non-rco-orgs.json')
}

export function getParksEvents() {
  return load('parks-events.json')
}

// Canonical neighborhood name → slug
export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Build the full neighborhood index: all neighborhoods that have any data
export function getNeighborhoodIndex() {
  const clpEvents = getClpEvents()
  const parksEvents = getParksEvents()
  const rcos = getRcos()
  const nrcos = getNonRcoOrgs()

  const map = {}

  const ensure = (name) => {
    if (!map[name]) map[name] = { name, slug: slugify(name), clpEvents: [], parksEvents: [], rcos: [], orgs: [] }
  }

  for (const ev of clpEvents) {
    if (ev.neighborhood) {
      ensure(ev.neighborhood)
      map[ev.neighborhood].clpEvents.push(ev)
    }
  }

  for (const ev of parksEvents) {
    if (ev.neighborhood) {
      ensure(ev.neighborhood)
      map[ev.neighborhood].parksEvents.push(ev)
    }
  }

  for (const rco of rcos) {
    const neighborhoods = normalizeRcoNeighborhood(rco.neighborhood)
    for (const n of neighborhoods) {
      ensure(n)
      map[n].rcos.push(rco)
    }
  }

  for (const org of nrcos) {
    for (const n of (org.neighborhoods || [])) {
      ensure(n)
      map[n].orgs.push(org)
    }
  }

  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
}

// RCO neighborhood strings are sometimes multi-value; extract primary
function normalizeRcoNeighborhood(raw) {
  if (!raw) return []
  // Split on common separators like " / ", " and ", ","
  return raw
    .split(/\s*[\/,]\s*|\s+and\s+/i)
    .map(s => s.trim())
    .filter(Boolean)
}

export function getNeighborhoodBySlug(slug) {
  const all = getNeighborhoodIndex()
  return all.find(n => n.slug === slug) || null
}

// Format a date string for display
export function formatEventDate(iso) {
  if (!iso) return { day: '?', month: '???', time: '' }
  const d = new Date(iso)
  return {
    day: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  }
}
