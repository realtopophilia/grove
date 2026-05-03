import { readFileSync } from 'fs'
import { join } from 'path'

const dataDir = join(process.cwd(), 'data')

function load(file) {
  return JSON.parse(readFileSync(join(dataDir, file), 'utf8'))
}

export function getRcos() {
  return load('rcos-enriched.json')
}

export function getNonRcoOrgs() {
  return load('non-rco-orgs.json')
}

// Canonical neighborhood name → slug
export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Build the full neighborhood index: all neighborhoods that have RCO or org data
export function getNeighborhoodIndex() {
  const rcos = getRcos()
  const nrcos = getNonRcoOrgs()

  const map = {}

  const ensure = (name) => {
    if (!map[name]) map[name] = { name, slug: slugify(name), rcos: [], orgs: [] }
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
  return raw
    .split(/\s*[\/,]\s*|\s+and\s+/i)
    .map(s => s.trim())
    .filter(Boolean)
}

export function getNeighborhoodBySlug(slug) {
  const all = getNeighborhoodIndex()
  return all.find(n => n.slug === slug) || null
}
