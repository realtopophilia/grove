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

// ── Meeting recurrence ────────────────────────────────────────────────────────

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

/**
 * Given a meeting_recurrence object, return the next occurrence on or after `from`.
 * Returns null if the pattern can't be computed (quarterly, biannual, etc.).
 *
 * recurrence shape:
 *   { freq, week, day, time, except_months, only_months }
 */
export function getNextMeeting(recurrence, from = new Date()) {
  if (!recurrence) return null
  const { freq, week, day, time, except_months = [], only_months = null } = recurrence
  if (!week || !day) return null

  const dayIndex = DAYS.indexOf(day)
  if (dayIndex === -1) return null

  // Search up to 18 months out
  const limit = new Date(from)
  limit.setMonth(limit.getMonth() + 18)

  // Start from beginning of current month
  let cursor = new Date(from.getFullYear(), from.getMonth(), 1)

  while (cursor < limit) {
    const year  = cursor.getFullYear()
    const month = cursor.getMonth() + 1 // 1-based

    // Check inclusion/exclusion
    const included = only_months ? only_months.includes(month) : !except_months.includes(month)

    if (included) {
      const date = nthWeekdayOfMonth(year, cursor.getMonth(), week, dayIndex)
      if (date && date >= from) {
        return { date, time: time || null }
      }
    }

    // Advance one month
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return null
}

/**
 * Return the Date of the Nth weekday in a given month.
 * week: 1-4 (positive) or -1 (last)
 */
function nthWeekdayOfMonth(year, month0, week, dayIndex) {
  if (week === -1) {
    // Last occurrence: start from end of month
    const last = new Date(year, month0 + 1, 0) // last day of month
    while (last.getDay() !== dayIndex) last.setDate(last.getDate() - 1)
    return new Date(last)
  }
  // nth positive occurrence
  let count = 0
  const d = new Date(year, month0, 1)
  while (d.getMonth() === month0) {
    if (d.getDay() === dayIndex) {
      count++
      if (count === week) return new Date(d)
    }
    d.setDate(d.getDate() + 1)
  }
  return null
}

/**
 * Format a next-meeting result for display.
 * Returns a string like "Thu, May 15" or "Thu, May 15 at 7:00pm"
 */
export function formatNextMeeting(result) {
  if (!result) return null
  const { date, time } = result
  const dayStr  = date.toLocaleDateString('en-US', { weekday: 'short' })
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return time ? `${dayStr}, ${dateStr} at ${time}` : `${dayStr}, ${dateStr}`
}
