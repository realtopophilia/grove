// add-meeting-recurrence.js
// Adds structured meeting_recurrence objects to RCOs and non-RCO orgs
// where the schedule is regular enough to compute next dates from.
//
// Schema:
//   freq:           "monthly" | "bimonthly" | "quarterly"
//   week:           1-4 (nth week of month), or -1 (last)
//   day:            full weekday name ("Monday" … "Sunday")
//   time:           display string ("7:00pm") or null
//   except_months:  array of month numbers to skip (1=Jan), or []
//   only_months:    array of month numbers to INCLUDE; overrides except_months
//
// Usage: node scripts/add-meeting-recurrence.js

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const dataDir = join(process.cwd(), 'data')

// ── RCO recurrence patches ───────────────────────────────────────────────────
const rcoPatch = [
  { id: 1,  meeting_recurrence: { freq:'monthly', week:2, day:'Monday', time:null, except_months:[8,12], only_months:null } },
  { id: 2,  meeting_recurrence: { freq:'monthly', week:2, day:'Tuesday', time:'7:30pm', except_months:[], only_months:null } },
  // id 5 Bloomfield Alliance: "Monthly" but no day/time — leave null
  // id 8 Brighton Heights has both board (1st Thu) and general (bimonthly). Track general public meetings.
  { id: 8,  meeting_recurrence: { freq:'bimonthly', week:2, day:'Thursday', time:'7:00pm', except_months:[], only_months:[1,3,5,9,11] } },
  { id: 9,  meeting_recurrence: { freq:'bimonthly', week:2, day:'Monday', time:'7:00pm', except_months:[], only_months:[1,3,5,7,9,11] } },
  { id: 12, meeting_recurrence: { freq:'monthly', week:2, day:'Tuesday', time:null, except_months:[], only_months:null } },
  { id: 16, meeting_recurrence: { freq:'monthly', week:4, day:'Tuesday', time:null, except_months:[], only_months:null } },
  { id: 20, meeting_recurrence: { freq:'monthly', week:3, day:'Thursday', time:'7:00pm', except_months:[7,12], only_months:null } },
  { id: 24, meeting_recurrence: { freq:'monthly', week:4, day:'Thursday', time:'6:00pm', except_months:[], only_months:null } },
  { id: 27, meeting_recurrence: { freq:'monthly', week:2, day:'Wednesday', time:'6:00pm', except_months:[], only_months:null } },
  { id: 33, meeting_recurrence: { freq:'monthly', week:2, day:'Wednesday', time:'7:00pm', except_months:[], only_months:null } },
  { id: 36, meeting_recurrence: { freq:'monthly', week:4, day:'Tuesday', time:null, except_months:[], only_months:null } },
  { id: 40, meeting_recurrence: { freq:'monthly', week:1, day:'Tuesday', time:'6:30pm', except_months:[], only_months:null } },
  // id 42 South Side Community Council: board = 2nd Monday, general = last Monday in March + September
  { id: 42, meeting_recurrence: { freq:'monthly', week:2, day:'Monday', time:null, except_months:[], only_months:null } },
  // SHUC: 3rd Tuesday except July + December
  { id: 45, meeting_recurrence: { freq:'monthly', week:3, day:'Tuesday', time:'6:30pm', except_months:[7,12], only_months:null } },
  // Polish Hill: 1st Tuesday
  { id: 40, meeting_recurrence: { freq:'monthly', week:1, day:'Tuesday', time:'6:30pm', except_months:[], only_months:null } },
]

// ── Non-RCO recurrence patches ───────────────────────────────────────────────
const nrcoPatch = [
  { id: 'nrco-19', meeting_recurrence: { freq:'monthly', week:2, day:'Tuesday', time:'7:00pm', except_months:[], only_months:null } },
  { id: 'nrco-20', meeting_recurrence: { freq:'monthly', week:2, day:'Tuesday', time:'6:00pm', except_months:[], only_months:null } },
]

function applyPatches(records, patches, idField) {
  const map = {}
  for (const p of patches) map[p[idField]] = p
  for (const rec of records) {
    const patch = map[rec[idField]]
    if (!patch) continue
    for (const [k, v] of Object.entries(patch)) {
      if (k === idField) continue
      rec[k] = v
      console.log(`  [${rec[idField]}] ${rec.name}: added ${k}`)
    }
  }
}

const rcos  = JSON.parse(readFileSync(join(dataDir, 'rcos-enriched.json'), 'utf8'))
const nrcos = JSON.parse(readFileSync(join(dataDir, 'non-rco-orgs.json'),  'utf8'))

console.log('=== RCOs ===')
applyPatches(rcos,  rcoPatch,  'id')
console.log('\n=== Non-RCO orgs ===')
applyPatches(nrcos, nrcoPatch, 'id')

writeFileSync(join(dataDir, 'rcos-enriched.json'), JSON.stringify(rcos,  null, 2))
writeFileSync(join(dataDir, 'non-rco-orgs.json'),  JSON.stringify(nrcos, null, 2))
console.log('\nDone.')
