import { getNeighborhoodIndex, slugify } from '../../lib/data'
import Link from 'next/link'

export const metadata = { title: 'Coverage — Grove' }

// All 90 official Pittsburgh neighborhoods
const ALL_NEIGHBORHOODS = [
  'Allegheny Center', 'Allegheny West', 'Allentown', 'Arlington',
  'Arlington Heights', 'Banksville', 'Bedford Dwellings', 'Beechview',
  'Beltzhoover', 'Bloomfield', 'Bon Air', 'Brighton Heights', 'Brookline',
  'California-Kirkbride', 'Carrick', 'Central Business District',
  'Central Lawrenceville', 'Central Northside', 'Central Oakland', 'Chateau',
  'Chartiers City', 'Crafton Heights', 'Crawford-Roberts', 'Deutschtown',
  'Duquesne Heights', 'East Allegheny', 'East Carnegie', 'East Hills',
  'East Liberty', 'Elliott', 'Esplen', 'Fairywood', 'Fineview', 'Friendship',
  'Garfield', 'Glen Hazel', 'Greenfield', 'Hazelwood', 'Hays',
  'Highland Park', 'Hill District', 'Homewood North', 'Homewood South',
  'Homewood West', 'Knoxville', 'Larimer', 'Lincoln Place',
  'Lincoln-Lemington-Belmar', 'Lower Lawrenceville', 'Manchester',
  'Marshall-Shadeland', 'Middle Hill', 'Morningside', 'Mount Oliver',
  'Mount Washington', 'New Homestead', 'North Oakland', 'Northview Heights',
  'Oakwood', 'Overbrook', 'Perry Hilltop', 'Perry South', 'Point Breeze',
  'Point Breeze North', 'Polish Hill', 'Regent Square', 'Ridgemont',
  'Shadyside', 'Sheraden', 'South Oakland', 'South Shore', 'South Side Flats',
  'South Side Slopes', 'Spring Garden', 'Spring Hill-City View',
  'Squirrel Hill North', 'Squirrel Hill South', 'St. Clair', 'Stanton Heights',
  'Strip District', 'Summer Hill', 'Swisshelm Park', 'Terrace Village',
  'Troy Hill', 'Upper Hill', 'Upper Lawrenceville', 'Uptown',
  'West End', 'West Oakland', 'Westwood', 'Windgap', 'Woods Run',
]

export default function CoveragePage() {
  const index = getNeighborhoodIndex()

  // Build a lookup by slug for fuzzy matching
  const bySlug = {}
  for (const n of index) {
    bySlug[n.slug] = n
  }

  // For each official neighborhood, find matching data if any
  const rows = ALL_NEIGHBORHOODS.map(name => {
    const slug = slugify(name)
    const data = bySlug[slug] || null
    const eventCount = data
      ? (data.clpEvents?.length || 0) + (data.parksEvents?.length || 0) +
        (data.ebEvents?.length || 0) + (data.meetupEvents?.length || 0)
      : 0
    const orgCount = data ? (data.rcos?.length || 0) + (data.orgs?.length || 0) : 0
    const hasCoverage = eventCount > 0 || orgCount > 0

    return { name, slug, hasCoverage, eventCount, orgCount, data }
  })

  const covered = rows.filter(r => r.hasCoverage).length
  const total = rows.length

  return (
    <>
      <Link href="/" className="back-link">← Home</Link>
      <h1 className="page-title">Coverage</h1>

      <p style={{ color: 'var(--muted)', marginBottom: '0.5rem' }}>
        Grove currently has data for{' '}
        <strong>{covered} of {total}</strong> Pittsburgh neighborhoods.
        The remaining {total - covered} are on the roadmap.
      </p>

      <p style={{ color: 'var(--muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Sources: Carnegie Library events, Pittsburgh Parks Conservancy, Eventbrite community events,
        Meetup, registered community organizations (RCOs), and other community orgs.
      </p>

      <div className="coverage-grid">
        {rows.map(({ name, slug, hasCoverage, eventCount, orgCount }) => (
          hasCoverage
            ? (
              <Link href={`/neighborhood/${slug}`} key={name} className="coverage-card coverage-card--has">
                <div className="coverage-name">{name}</div>
                <div className="coverage-counts">
                  {[
                    eventCount > 0 && `${eventCount} event${eventCount !== 1 ? 's' : ''}`,
                    orgCount > 0 && `${orgCount} org${orgCount !== 1 ? 's' : ''}`,
                  ].filter(Boolean).join(' · ')}
                </div>
              </Link>
            )
            : (
              <div key={name} className="coverage-card coverage-card--empty">
                <div className="coverage-name">{name}</div>
                <div className="coverage-counts">no coverage yet</div>
              </div>
            )
        ))}
      </div>
    </>
  )
}
