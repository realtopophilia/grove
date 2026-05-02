# Grove — Pittsburgh Neighborhood Events

A data-first project to surface neighborhood-level events in Pittsburgh, starting with Registered Community Organizations (RCOs) as the primary data source.

## Data Sources

### Layer 1: RCOs (in progress)
Pittsburgh has 48 registered community organizations (RCOs) as of January 5, 2026. These are city-recognized neighborhood nonprofits that hold regular public meetings and often post local events.

- **Source**: City of Pittsburgh DCP, `list-of-rcos-january-5th-2026-2.pdf`
- **Data file**: `data/rcos.json`
- **Status**:
  - [x] Full list compiled (48 RCOs)
  - [ ] Website availability audit
  - [ ] Events page detection
  - [ ] Scraping pipeline for meeting dates / events
  - [ ] Social media presence check (Facebook, Instagram, Nextdoor)

### Web coverage breakdown (from PDF):
- Has a standalone website: ~40 RCOs
- Facebook only: 5 RCOs (East Hills, Lincoln-Lemington, Manchester Chateau, Mt. Oliver St. Clair, Schenley Heights)
- Likely lapsed (exp 2024): 2 RCOs (Schenley Heights, Spring Hill)

### Layer 2: Other neighborhood event sources (planned)
- Coffee shops (many host community events)
- Libraries (Carnegie Library branches)
- Churches and faith communities
- Community gardens
- Pittsburgh Parks Conservancy events
- City of Pittsburgh permit-based events (parks, streets)

## Project Philosophy
- Data first, design later
- Start with what's publicly available
- Prioritize sources that post event calendars
- Make it useful for newcomers who don't have the local knowledge network

## Tech (TBD)
To be decided once data layer is understood.
