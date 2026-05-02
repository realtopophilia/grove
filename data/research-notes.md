# Grove — RCO Data Research Notes
*Last updated: 2026-04-30*

## What we know

### The RCO list
- **48 RCOs** registered with the City of Pittsburgh as of January 5, 2026
- Source: `list-of-rcos-january-5th-2026-2.pdf` (DCP)
- Full structured dataset: `rcos.json`

### Website landscape
| Status | Count |
|--------|-------|
| Live website | 37 |
| Facebook only (no site) | 5 |
| Dead or unreachable | 6 |
| Total | 48 |

Facebook-only RCOs: East Hills Consensus Group, Lincoln-Lemington Collaborative, Manchester Chateau Partnership Alliance, Mt. Oliver City St. Clair Community Group, Schenley Heights Collaborative

Unreachable: Allegheny City Central, Allegheny West, Allentown CDC, Carrick Community Council, Highland Park Community Council, Swisshelm Forward (domain may be misspelled in PDF)

### CMS breakdown (among live sites)
| CMS | Count |
|-----|-------|
| WordPress | ~18 |
| Wix | ~7 |
| Squarespace | ~4 |
| Weebly | 1 |
| GoDaddy | 1 |
| Static/Custom | ~6 |

---

## Events data quality

### Tier 1 — Structured events data (iCal feeds)
WordPress sites using The Events Calendar plugin expose iCal feeds at `/events/?ical=1`.

| RCO | Events | Notes |
|-----|--------|-------|
| Hill Community Development Corporation | **30 events** | Small Business Hours series, May–Dec 2026. Excellent. |
| Bloomfield Development Corporation | **1 event** | May Board Meeting with City Controller |
| Bloomfield-Garfield Corporation | 0 | Feed exists, no events posted |
| Charles Street Area Corporation | 0 | Feed exists, no events posted |
| East Allegheny Community Council | 0 | Feed exists, no events posted |
| Uptown Partners of Pittsburgh | blocked | ModSecurity blocks scraping |

**Assessment:** iCal is the cleanest data source, but most WP sites aren't actively posting events.

### Tier 2 — HTML event pages (static, scrapeable)
Sites with event pages that render actual HTML content (not JS-dependent).

| RCO | Notes |
|-----|-------|
| Village Collaborative of East Liberty | Dates from Oct 2025–Apr 2026 in HTML. Active. |
| Oakcliffe Community Organization | Sept 2024 dates. Stale but organized. |
| Point Breeze Organization | Meeting dates listed as static HTML. Worth parsing. |
| Polish Hill Civic Association | `/meetings` page. Check manually. |
| Friendship Community Group | `/board-meetings` page. Board meeting schedule. |

### Tier 3 — Dynamic event pages (need Puppeteer)
Wix and Squarespace sites load calendar content via JavaScript. Static scraping gets nav and chrome but not the actual events.

| RCO | CMS | Events Page |
|-----|-----|-------------|
| Beltzhoover Consensus Group | Wix | /news |
| Brookline Together | Wix | /events |
| Hazelwood Initiative | Wix | /events |
| Larimer Consensus Group | Wix | /calendar |
| Bloomfield Alliance | Squarespace | /agendas-minutes |
| Point Breeze North | Squarespace | /events |
| Oakland BID | Custom | /events |

**Next step for these:** Use Puppeteer/Playwright with a 5-second wait for JS rendering. One-time cost to get the pattern working for Wix, then it works for all Wix sites.

### Tier 4 — Meeting minutes / newsletters (low event specificity)
These sites have content but it's meeting summaries, not upcoming events.

- Community Alliance of Spring Garden-East Deutschtown (/meeting-minutes)
- Oakland Planning and Development Corporation (/newsletters)
- Hill District Collaborative (stale 2022 events)

---

## Other data sources to explore

### High priority

#### Carnegie Library of Pittsburgh ✅ CONFIRMED + WORKING
- **17 branches**, each named and geolocated to a specific neighborhood
- **iCal feed confirmed working** at `https://www.carnegielibrary.org/events/list/?ical=1`
  - Returns 30 upcoming events per request (date params filter window but don't page past 30)
  - ~~Requires browser session~~ **curl works** with browser User-Agent header (Node.js still 403)
  - Location field includes full branch name + address (e.g. "CLP – Hazelwood, 5006 Second Avenue...")
- **Branch → neighborhood mapping** done in `scripts/fetch-clp-events.js`
- **17 branches confirmed:** Allegheny, Beechview, Brookline, Carrick, Downtown, East Liberty, Hazelwood, Hill District, **Homewood** (added 2026-05-01), Knoxville, Lawrenceville, Oakland (Main), Mt. Washington, South Side, Squirrel Hill, West End, Woods Run
- **Live data:** `data/clp-events.json` — 30 events across 12 neighborhoods (May–Aug 2026). `data/clp-events.ical` is the raw source.
- **This is probably the single best neighborhood event data source in Pittsburgh.** High volume, well-maintained, reliably updated, hyperlocal.
- **Refresh command:**
  ```
  curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
    -H "Accept: text/calendar,*/*" \
    -o data/clp-events.ical \
    "https://www.carnegielibrary.org/events/list/?ical=1&start-date=YYYY-MM-DD&end-date=YYYY-MM-DD"
  node scripts/fetch-clp-events.js
  ```

- **Pittsburgh Parks Conservancy** — parks events, often neighborhood-anchored
- **Eventbrite** — search by Pittsburgh zip codes. Many neighborhood orgs post here.
- **Facebook Events** — can't scrape without API, but worth checking which RCOs post there

### Medium priority
- **Coffee shops** — many host community nights, readings, meetings. No central source.
  - 61C, Adda, Commonplace, Commonplace Coffee
- **Faith communities** — churches often host community meetings, especially on North Side
- **Community gardens** — Pittsburgh Food Policy Council has a garden map
- **Nextdoor** — neighborhood posts but no public API
- **Pittsburgh City Paper** — events calendar but broad focus

### Data partnerships to consider
- **burgh.agency** — Allegheny County open data portal
- **Western Pennsylvania Regional Data Center** (WPRDC) — has neighborhood-level datasets
- **Pittsburgh Bureau of Building Inspection** — permit data shows where development is happening

---

## Key findings for Grove's design

1. **RCO events are sparse and inconsistently posted.** Hill CDC is exceptional. Most post nothing. The product needs to be honest about coverage gaps.

2. **Meeting times are the primary RCO product**, not events. Almost every RCO holds monthly public meetings. The time and place is in the PDF. This data exists and is stable — should be the core dataset.

3. **Wix is the biggest scraping challenge.** 7 RCOs use Wix. Puppeteer would unlock those.

4. **Carnegie Library is probably the most reliable neighborhood event source in Pittsburgh.** It's not RCO data, but it's hyperlocal, well-maintained, and public.

5. **The real value may be aggregation, not scraping.** Some neighborhoods have active event ecosystems on Facebook, Nextdoor, and Eventbrite that don't appear on organization websites. A tool that helps residents find AND submit events might be more durable than a pure scraper.

---

---

## Non-RCO neighborhood organizations

### The gap
47 of Pittsburgh's 90 official neighborhoods have no registered RCO. Many of these have active community organizations — they just aren't city-registered. Notable gaps include all three Lawrencevilles, Morningside, Shadyside, Stanton Heights, Strip District, Troy Hill, Regent Square, Crafton Heights, Central Northside, and Beechview.

### How to find them: methodology
Four approaches work in combination:

1. **ProPublica Nonprofit Explorer API** (`projects.propublica.org/nonprofits/api/v2/search.json?q=[neighborhood]+Pittsburgh&state[id]=PA`) — finds formally registered 501(c)(3)s. Use NTEE code S (community improvement) for best signal. Limitation: many neighborhood orgs are informal or use fiscal sponsors and don't appear here.

2. **Direct website guessing** — try `[neighborhood].org`, `[neighborhood]pgh.org`, `[neighborhood]citizens.org`, etc. Hit rate is ~25%. Doesn't find non-obvious domains (e.g., lunited.org for Lawrenceville United, chco.org for Crafton Heights).

3. **Google search** — most reliable for well-known orgs. `"[neighborhood] Pittsburgh" community organization site` returns actual URLs quickly. Found lunited.org this way.

4. **Facebook** — many smaller orgs (Troy Hill Citizens, East Hills Consensus Group, etc.) are primarily on Facebook with no standalone website. Searchable but not easily scrapeable without API access.

### Confirmed non-RCO orgs with live websites
| Organization | Neighborhoods | Website |
|---|---|---|
| Lawrenceville United | Central/Lower/Upper Lawrenceville | lunited.org |
| Lawrenceville Corporation | Central/Lower/Upper Lawrenceville | lvpgh.com |
| Morningside Area Community Council | Morningside | morningsidepgh.org |
| Shadyside Action Coalition | Shadyside | sca2022.com |
| Stanton Heights Neighborhood Association | Stanton Heights | stantonheights.org |
| Strip District Neighbors | Strip District | stripdistrictneighbors.org |
| Crafton Heights Community Organization | Crafton Heights | chco.org |
| Central Northside Neighborhood Council | Central Northside | cnnc.us |
| Regent Square Civic Association | Regent Square | regentsquare.net |
| Sheraden | Sheraden | sheradenpgh.org |

### Found via ProPublica, no working website yet
Troy Hill Citizens (S20J), Overbrook Community Council (S21), Northview Heights Citizens Council (P20)

### Updated 2026-04-30: web presence found for previously-unknown orgs
| Org | Finding |
|-----|---------|
| Knoxville Community Council | Facebook: facebook.com/knoxvillecommunitycouncil — active org, monthly meetings, featured by Hilltop Alliance |
| Arlington Civic Council | Facebook: facebook.com/Arlingtonciviccouncil — National Night Out, block parties |
| Beechview BRAG | **Website confirmed:** beechviewing.org — also claims RCO status but not on Jan 2026 city list |
| Overbrook West Neighbors | **New org added (nrco-18):** overbrookwestneighbors.com — CDC focused on Upper Lancaster Ave, also claims RCO |

### Still uncovered neighborhoods (no org found at all)
California-Kirkbride, Chartiers City, East Carnegie, Elliott, Esplen, Fairywood, Glen Hazel, Hays, Lincoln Place, New Homestead, North Shore, Oakwood, Ridgemont, South Shore, Summer Hill, Westwood, Windgap — these are generally small, lower-density neighborhoods that may truly have no active community organization.

Full dataset: `data/non-rco-orgs.json`

---

## Recommended next steps

### Immediate (data layer)
1. **Add meeting schedule data** from the PDF to `rcos.json` — every RCO lists when and where they meet. This is reliable, stable data that exists right now.
2. **Try Carnegie Library events API** — `https://clpgh.org` or check if they expose an iCal/RSS feed
3. **Try Eventbrite API** with Pittsburgh location filter
4. **Build Puppeteer script** for Wix sites (test on Hazelwood, then apply to others)

### Short-term (architecture)
5. Decide: scraper-first (cron job that re-scrapes) vs. aggregator-first (ingest from APIs)
6. Decide: where does user-submitted event data fit?

### Design phase (deferred)
7. Neighborhood → events mapping
8. "What's happening near me" interface
9. New resident onboarding flow
