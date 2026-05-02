/**
 * add-meeting-schedules.js
 *
 * Merges the meeting time/place data from the PDF into rcos.json.
 * This data is stable and reliable — every RCO is legally required
 * to hold public meetings at the listed time/place.
 *
 * Run: node scripts/add-meeting-schedules.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rcos = JSON.parse(readFileSync(join(__dirname, '../data/rcos.json'), 'utf8'));

// Meeting schedule data extracted from the PDF
// Format: id -> { schedule: string, location: string }
const MEETING_SCHEDULES = {
  1:  { schedule: null, location: null, notes: "Not captured from PDF — check alleghenycentral.org" },
  2:  { schedule: null, location: null, notes: "Not captured from PDF — check alleghenywcot.org" },
  3:  { schedule: null, location: null, notes: "Not captured from PDF — check allentowndc.com" },
  4:  { schedule: null, location: null, notes: "Not captured — site unreachable" },
  5:  { schedule: "Monthly", location: "Check bloomfieldalliance.org/agendas-minutes", notes: "Quarterly community meetings open to public" },
  6:  { schedule: null, location: null, notes: "May Board Meeting with City Controller Rachael Heisler — found via iCal" },
  7:  { schedule: null, location: null, notes: "Not captured from PDF" },
  8:  { schedule: null, location: null, notes: "Not captured from PDF" },
  9:  { schedule: null, location: null, notes: "Not captured from PDF" },
  10: { schedule: null, location: null, notes: "Site unreachable" },
  11: { schedule: null, location: null, notes: "iCal feed exists but no upcoming events posted" },
  12: { schedule: null, location: null, notes: "Not captured from PDF" },
  13: { schedule: null, location: null, notes: "Returns 401 — possible members-only site" },
  14: { schedule: null, location: null, notes: "iCal feed exists but no upcoming events posted" },
  15: { schedule: null, location: null, notes: "Facebook only" },
  16: { schedule: null, location: null, notes: "Not captured from PDF" },
  17: { schedule: null, location: null, notes: "Not captured from PDF" },
  18: { schedule: null, location: null, notes: "Site timed out during audit" },
  19: { schedule: null, location: null, notes: "Wix dynamic content — check hazelwoodinitiative.org/events" },
  20: { schedule: "All meetings being conducted via Zoom, 7pm - 3rd Thursday of each month except July and December", location: "Zoom", notes: "" },
  21: { schedule: "Jeron X. Grayson Community Center, 1852 Enoch St — check website for details", location: "1852 Enoch St, Pittsburgh, PA 15219", notes: "Very active iCal feed (30 events). Small Business Hours series." },
  22: { schedule: "Monthly — in-person or virtually; see website events page", location: null, notes: "" },
  23: { schedule: "Hill House Association, Conference Room 2; Also virtual on Tuesdays or Thursdays from 5:30-8pm", location: "1835 Centre Avenue, RM 130, Pittsburgh, PA 15219", notes: "" },
  24: { schedule: "Rotating facilities of Collaborative Partners — check website calendar, 4th Thursday of the month at 6pm", location: null, notes: "" },
  25: { schedule: "Bi-annually and as needed — see website calendar of events", location: "3011 Landis Street, Pittsburgh, PA 15204", notes: "" },
  26: { schedule: "6435 Frankstown Ave, Pittsburgh, PA 15206", location: "6435 Frankstown Ave, Pittsburgh, PA 15206", notes: "Wix site — dynamic calendar, hard to scrape" },
  27: { schedule: "We have Zoom meetings the second Wednesday each month from 6:00 PM - 7:30 PM. Resuming in-person at 1551 Lincoln Ave in Fall 2023.", location: "Zoom / 1551 Lincoln Ave, Pittsburgh, PA 15206", notes: "Facebook only for web presence" },
  28: { schedule: "Meetings take place once per quarter, at 1319 Allegheny Avenue", location: "1319 Allegheny Ave, Pittsburgh, PA 15233", notes: "Facebook only for web presence" },
  29: { schedule: "A meeting of the Board of Directors shall be held at the registered office or such place as designated by the Board. Regular meetings held quarterly between January and December.", location: null, notes: "Site returns 404" },
  30: { schedule: "Pressley Ridge Administrative Building, 2611 Stayton Street", location: "2611 Stayton Street, Pittsburgh, PA 15212", notes: "" },
  31: { schedule: null, location: null, notes: "All meetings via Zoom (as of PDF). Check mwcdc.org for current schedule." },
  32: { schedule: "Ormsby Avenue Café 402 Ormsby Ave., Pittsburgh, Pennsylvania 15210", location: "402 Ormsby Ave, Pittsburgh, PA 15210", notes: "Facebook only for web presence" },
  33: { schedule: "Second Wednesday of the month at 7pm. In person meetings: Craft Professional Building at 3240 Caroll Place; otherwise meetings are held virtually via Zoom.", location: "3240 Caroll Place, Pittsburgh, PA / Zoom", notes: "" },
  34: { schedule: "Via online 5 times/yr. Check website events.", location: "Online", notes: "" },
  35: { schedule: "294 Semple Street, Pittsburgh, PA 15213", location: "294 Semple St, Pittsburgh, PA 15213", notes: "" },
  36: { schedule: "4th Tuesday of the Month - The Pittsburgh Project 2801 N. Charles Street 15214. During the pandemic, meetings are held virtually on zoom", location: "2801 N. Charles Street, Pittsburgh, PA 15214 / Zoom", notes: "" },
  37: { schedule: "Pierce Studio-Trust Arts Education Center, 805 Liberty Avenue; Community Forums at downtownpittsburgh.com/get-involved/community-forums/", location: "805 Liberty Ave, Pittsburgh, PA 15222", notes: "" },
  38: { schedule: "Meetings are held via Zoom", location: "Zoom", notes: "Squarespace site with events page" },
  39: { schedule: "Sterrett Classical Academy, 7100 Reynolds St, Pittsburgh, PA 15208 OR Community Room at The Frick, 7227 Reynolds St, Pittsburgh, PA 15208", location: "7100 Reynolds St / 7227 Reynolds St, Pittsburgh, PA 15208", notes: "" },
  40: { schedule: "1st Tuesday of each month at 6:30pm. West Penn Rec Center (450 30th St, Pittsburgh, PA 15219) and Zoom", location: "450 30th St, Pittsburgh, PA 15219 / Zoom", notes: "" },
  41: { schedule: "Grace Memorial Presbyterian Church — 1000 Bryn Mawr Rd, Pittsburgh PA 15219", location: "1000 Bryn Mawr Rd, Pittsburgh, PA 15219", notes: "Facebook only; expiration 2024" },
  42: { schedule: "Board meetings held second Monday of each month and general meetings held last Monday in March and September; all meetings via Zoom.", location: "Zoom", notes: "" },
  43: { schedule: "St. Paul of the Cross Retreat Center + Various", location: "Various", notes: "Site timed out during audit" },
  44: { schedule: "1351 Damas Street, Pittsburgh, PA 15212", location: "1351 Damas St, Pittsburgh, PA 15212", notes: "Expiration 2024 — may be inactive" },
  45: { schedule: "Jewish Community Center, 5738 Forbes Avenue, Pittsburgh PA 15217 — 6:30pm monthly", location: "5738 Forbes Ave, Pittsburgh, PA 15217", notes: "Active WordPress site with events plugin" },
  46: { schedule: "Time and place of regular public meetings shall be announced in accordance with the Swisshelm Forward Communication Strategy", location: null, notes: "Website URL may be incorrect — verify 'swissheimforward.org' spelling" },
  47: { schedule: "All meetings are being conducted via Zoom", location: "Zoom", notes: "ModSecurity blocks scraping; check uptownpartners.org directly" },
  48: { schedule: "Virtual Meeting via Zoom", location: "Zoom", notes: "Recent dates found in HTML (Oct 2025–Apr 2026)" },
};

// Merge into rcos
const enriched = rcos.map(rco => ({
  ...rco,
  meeting_schedule: MEETING_SCHEDULES[rco.id]?.schedule || null,
  meeting_location: MEETING_SCHEDULES[rco.id]?.location || null,
  meeting_notes: MEETING_SCHEDULES[rco.id]?.notes || null,
}));

const outPath = join(__dirname, '../data/rcos-enriched.json');
writeFileSync(outPath, JSON.stringify(enriched, null, 2));
console.log(`Enriched ${enriched.length} RCOs with meeting schedule data.`);
console.log(`Saved to ${outPath}`);

// Stats
const withSchedule = enriched.filter(r => r.meeting_schedule).length;
const withLocation = enriched.filter(r => r.meeting_location).length;
console.log(`\nWith meeting schedule: ${withSchedule}/${enriched.length}`);
console.log(`With meeting location: ${withLocation}/${enriched.length}`);
