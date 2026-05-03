import { getNeighborhoodIndex, getRcoEvents, getNextMeeting, formatNextMeeting } from '../lib/data'
import NeighborhoodGrid from './components/NeighborhoodGrid'

export default function Home() {
  const neighborhoods = getNeighborhoodIndex()
  const events        = getRcoEvents()

  // Unique counts
  const totalRcos = new Set(neighborhoods.flatMap(n => n.rcos.map(r => r.id))).size
  const totalOrgs = new Set(neighborhoods.flatMap(n => n.orgs.map(o => o.id))).size

  // Build event lookup: orgId → count
  const eventsByOrg = {}
  for (const e of events) {
    eventsByOrg[e.orgId] = (eventsByOrg[e.orgId] || 0) + 1
  }

  // Enrich each neighborhood for the grid (plain serializable objects)
  const enriched = neighborhoods.map(n => {
    // Soonest next meeting across all RCOs in this neighborhood
    const meetings = n.rcos
      .filter(r => r.meeting_recurrence)
      .map(r => getNextMeeting(r.meeting_recurrence))
      .filter(Boolean)
      .sort((a, b) => a.date - b.date)
    const nextMeeting = meetings[0] ? formatNextMeeting(meetings[0]) : null

    // Upcoming event count for orgs in this neighborhood
    const orgIds = [...n.rcos.map(r => r.id), ...n.orgs.map(o => o.id)]
    const eventCount = orgIds.reduce((sum, id) => sum + (eventsByOrg[id] || 0), 0)

    return {
      name:       n.name,
      slug:       n.slug,
      rcoCount:   n.rcos.length,
      orgCount:   n.orgs.length,
      nextMeeting,
      eventCount,
    }
  })

  return (
    <>
      <div className="hero">
        <h1>Know your neighborhood</h1>
        <p>
          Registered community organizations and civic groups across Pittsburgh&rsquo;s 90 neighborhoods.
        </p>
      </div>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-num">{totalRcos}</span>
          <span className="stat-label">RCOs</span>
        </div>
        <div className="stat">
          <span className="stat-num">{totalOrgs}</span>
          <span className="stat-label">community orgs</span>
        </div>
        <div className="stat">
          <span className="stat-num">{neighborhoods.length}</span>
          <span className="stat-label">neighborhoods with coverage</span>
        </div>
      </div>

      <p className="section-heading">Neighborhoods</p>
      <NeighborhoodGrid neighborhoods={enriched} />
    </>
  )
}
