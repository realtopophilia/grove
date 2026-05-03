// apply-url-fixes.js — patch URL and meeting data in both JSON files
// Run: node scripts/apply-url-fixes.js

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const dataDir = join(process.cwd(), 'data')

// ── RCO patches ──────────────────────────────────────────────────────────────
// Format: { id, fields }  — only listed fields are updated
const rcoPatch = [
  // Dead/wrong domains → correct URLs
  { id: 1,  website: 'https://www.alleghenycitycentral.org',
            meeting_schedule: 'Second Monday of each month (except August and December)',
            meeting_notes: '' },
  { id: 2,  website: 'https://alleghenywest.org',
            meeting_schedule: '2nd Tuesday of the month at 7:30pm',
            meeting_location: 'Calvary United Methodist Church, 971 Beech Ave, Pittsburgh, PA 15233',
            meeting_notes: '' },
  { id: 3,  website: 'https://www.allentowncdc.org',
            meeting_notes: 'Check allentowncdc.org for current meeting schedule' },
  { id: 4,  website: 'https://www.bcg15210.org' },          // redirect → canonical
  { id: 8,  website: 'https://www.brightonheights.org',
            meeting_schedule: 'Board: 1st Thursday monthly (except July/December). General: 2nd Thursday of January, March, May, September, and November at 7pm',
            meeting_location: 'Board: All Saints Church. General: Pittsburgh Morrow School, 1611 Davis Ave, Pittsburgh, PA 15212',
            meeting_notes: '' },
  { id: 9,  meeting_schedule: '2nd Monday of each month (January, March, May, July, September, November) at 7pm',
            meeting_location: 'Brookline Teen Outreach, 520 Brookline Blvd, Pittsburgh, PA 15226',
            meeting_notes: '' },
  { id: 10, website: 'https://www.carrickcommunitycouncil.com',
            meeting_location: 'Concord Elementary School Auditorium, 2350 Brownsville Rd, Pittsburgh, PA 15210',
            meeting_notes: 'Check carrickcommunitycouncil.com/events for schedule' },
  { id: 12, website: 'https://www.casged.org',
            meeting_schedule: 'Second Tuesday of each month',
            meeting_notes: '' },
  { id: 15, website: 'https://www.easthillsconsensusgroup.org',
            facebook: 'https://www.facebook.com/EastHillsConsensusGroup/',
            meeting_location: 'Petra International Ministries, 235 Eastgate Drive, Pittsburgh, PA 15235',
            meeting_notes: '' },
  { id: 16, meeting_schedule: '4th Tuesday of the month',
            meeting_location: 'The Pittsburgh Project, 2801 N. Charles St, Pittsburgh, PA 15214',
            meeting_notes: '' },
  { id: 17, website: 'https://www.friendship-pgh.org',
            meeting_notes: 'Check friendship-pgh.org for current schedule' },
  { id: 19, website: 'https://www.hazelwoodinitiative.org' }, // redirect → canonical
  { id: 20, website: 'https://hpccpgh.org',
            meeting_schedule: '3rd Thursday of each month at 7pm (not July or December)',
            meeting_location: 'St. Andrews Community Hall, 5801 Hampton St, Pittsburgh, PA 15206 or via Zoom',
            meeting_notes: '' },
  { id: 21, website: 'https://www.hilldistrict.org' },       // redirect → canonical
  { id: 23, website: 'https://www.hilldistrictconsensusgroup.org',
            meeting_notes: '' },
  { id: 26, website: 'https://www.larimerconsensusgroup.org' }, // redirect → canonical
  // Lincoln-Lemington: fix old /pg/ Facebook URL format
  { id: 27, facebook: 'https://www.facebook.com/LincolnLemingtonCollaborative/' },
  { id: 29, website: 'https://www.manchesterneighbors.com' },
  { id: 35, website: 'https://www.opdc.org' },               // redirect → canonical
  // Perry Hilltop: domain changed
  { id: 36, website: 'https://www.ourfuturehilltop.org',
            meeting_notes: '' },
  { id: 38, website: 'https://www.pointbreezenorth.com' },   // redirect → canonical
  { id: 39, website: 'https://www.pointbreezepgh.org' },     // redirect → canonical
  { id: 40, website: 'https://www.polishhillcivicassociation.org' }, // redirect → canonical
  // Schenley Heights: wrong FB slug (002 → 2002)
  { id: 41, facebook: 'https://www.facebook.com/schenleyHC2002/' },
  { id: 43, website: 'https://www.southsideslopes.org' },    // redirect → canonical
  // Swisshelm Forward: typo in domain (swissheim → swisshelm)
  { id: 46, website: 'https://www.swisshelmforward.org',
            meeting_notes: '' },
  { id: 47, website: 'https://www.uptownpartners.org' },     // redirect → canonical
  { id: 48, website: 'https://www.eastliberty.org/the-village-collaborative/' }, // redirect → canonical
]

// ── Non-RCO org patches ──────────────────────────────────────────────────────
const nrcoPatch = [
  // Beechview BRAG: just needs www prefix
  { id: 'nrco-07', website: 'https://www.beechviewing.org' },
]

// ── Apply ────────────────────────────────────────────────────────────────────
function applyPatches(records, patches, idField) {
  const patchMap = {}
  for (const p of patches) {
    patchMap[p[idField]] = p
  }
  let count = 0
  for (const rec of records) {
    const patch = patchMap[rec[idField]]
    if (!patch) continue
    for (const [k, v] of Object.entries(patch)) {
      if (k === idField) continue
      if (rec[k] !== v) {
        console.log(`  [${rec[idField]}] ${rec.name}: ${k}: ${JSON.stringify(rec[k])} → ${JSON.stringify(v)}`)
        rec[k] = v
        count++
      }
    }
  }
  return count
}

const rcos = JSON.parse(readFileSync(join(dataDir, 'rcos-enriched.json'), 'utf8'))
const nrcos = JSON.parse(readFileSync(join(dataDir, 'non-rco-orgs.json'), 'utf8'))

console.log('=== RCO patches ===')
const rcoCount = applyPatches(rcos, rcoPatch, 'id')
console.log(`\n=== Non-RCO patches ===`)
const nrcoCount = applyPatches(nrcos, nrcoPatch, 'id')

writeFileSync(join(dataDir, 'rcos-enriched.json'), JSON.stringify(rcos, null, 2))
writeFileSync(join(dataDir, 'non-rco-orgs.json'), JSON.stringify(nrcos, null, 2))
console.log(`\nDone. ${rcoCount} RCO fields updated, ${nrcoCount} non-RCO fields updated.`)
