// check-urls.js — HEAD-check every website/facebook in rcos-enriched.json and non-rco-orgs.json
// Reports: ok, redirect, dead, error
// Usage: node scripts/check-urls.js

import { readFileSync } from 'fs'
import { join } from 'path'

const dataDir = join(process.cwd(), 'data')
const rcos = JSON.parse(readFileSync(join(dataDir, 'rcos-enriched.json'), 'utf8'))
const orgs = JSON.parse(readFileSync(join(dataDir, 'non-rco-orgs.json'), 'utf8'))

const urls = []
for (const r of rcos) {
  if (r.website) urls.push({ source: 'rco', id: r.id, name: r.name, field: 'website', url: r.website })
  if (r.facebook) urls.push({ source: 'rco', id: r.id, name: r.name, field: 'facebook', url: r.facebook })
}
for (const o of orgs) {
  if (o.website) urls.push({ source: 'nrco', id: o.id, name: o.name, field: 'website', url: o.website })
  if (o.facebook) urls.push({ source: 'nrco', id: o.id, name: o.name, field: 'facebook', url: o.facebook })
}

const TIMEOUT = 10000
const DELAY = 400

async function checkUrl(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
      },
    })
    clearTimeout(timer)
    // Check for soft-404 / parked domain patterns
    const finalUrl = res.url
    const isParked = /sedo\.com|godaddy\.com|domain.*for.*sale|parking/i.test(finalUrl)
    const redirected = finalUrl !== url && !finalUrl.startsWith(url)
    if (res.status >= 400) return { status: 'dead', code: res.status, finalUrl }
    if (isParked) return { status: 'parked', code: res.status, finalUrl }
    if (redirected) return { status: 'redirect', code: res.status, finalUrl }
    return { status: 'ok', code: res.status, finalUrl }
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') return { status: 'timeout', code: null, finalUrl: url }
    return { status: 'error', code: null, error: e.message, finalUrl: url }
  }
}

const results = []
for (let i = 0; i < urls.length; i++) {
  const item = urls[i]
  process.stdout.write(`[${i+1}/${urls.length}] ${item.name.slice(0,40).padEnd(40)} `)
  const result = await checkUrl(item.url)
  results.push({ ...item, ...result })
  const icon = result.status === 'ok' ? '✓' : result.status === 'redirect' ? '↪' : result.status === 'timeout' ? '⏱' : '✗'
  console.log(`${icon} ${result.status} ${result.code || ''} ${result.finalUrl !== item.url ? '→ ' + result.finalUrl.slice(0,60) : ''}`)
  await new Promise(r => setTimeout(r, DELAY))
}

console.log('\n=== SUMMARY ===')
const byStatus = {}
for (const r of results) {
  byStatus[r.status] = (byStatus[r.status] || []).concat(r)
}
for (const [status, items] of Object.entries(byStatus).sort()) {
  console.log(`\n${status.toUpperCase()} (${items.length}):`)
  for (const item of items) {
    console.log(`  [${item.source}] ${item.name}: ${item.url}`)
    if (item.finalUrl && item.finalUrl !== item.url) console.log(`        → ${item.finalUrl}`)
    if (item.error) console.log(`        error: ${item.error}`)
  }
}
