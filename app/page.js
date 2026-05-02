import { getNeighborhoodIndex, getClpEvents, getParksEvents, formatEventDate, slugify } from '../lib/data'
import Link from 'next/link'

export default function Home() {
  const neighborhoods = getNeighborhoodIndex()

  // Merge and sort all upcoming events, show the next 8
  const allEvents = [
    ...getClpEvents(),
    ...getParksEvents(),
  ].sort((a, b) => (a.start || '').localeCompare(b.start || '')).slice(0, 8)

  const withEvents = neighborhoods.filter(n =>
    n.clpEvents.length > 0 || n.parksEvents.length > 0 || n.rcos.length > 0 || n.orgs.length > 0
  )

  return (
    <>
      <div className="hero">
        <h1>What's happening in Pittsburgh</h1>
        <p>Events and community meetings, organized by neighborhood.</p>
      </div>

      <div className="gap-notice">
        <strong>Coverage note:</strong> Grove is in early development. Events come from Carnegie Library branches and registered community organizations. Many neighborhoods have partial or no coverage yet.
      </div>

      <p className="section-heading">Upcoming events</p>
      <div className="event-grid">
        {allEvents.map((ev, i) => {
          const { day, month, time } = formatEventDate(ev.start)
          return (
            <div className="event-card" key={i}>
              <div className="event-date">
                <span className="day">{day}</span>
                <span className="month">{month}</span>
              </div>
              <div>
                <div className="event-title">
                  {ev.url
                    ? <a href={ev.url} target="_blank" rel="noopener noreferrer">{ev.title}</a>
                    : ev.title}
                </div>
                <div className="event-meta">{time} · {ev.location_full?.split(',')[0]}</div>
              </div>
              {ev.neighborhood && (
                <Link href={`/neighborhood/${slugify(ev.neighborhood)}`} className="neighborhood-tag">
                  {ev.neighborhood}
                </Link>
              )}
            </div>
          )
        })}
      </div>

      <p className="section-heading">Neighborhoods ({withEvents.length} with coverage)</p>
      <div className="neighborhood-grid">
        {withEvents.map(n => {
          const totalEvents = n.clpEvents.length + n.parksEvents.length
          return (
            <Link href={`/neighborhood/${n.slug}`} key={n.slug} className="neighborhood-card">
              <div className="name">
                {n.name}
                {n.clpEvents.length > 0 && <span className="badge">CLP</span>}
                {n.parksEvents.length > 0 && <span className="badge badge-parks">Parks</span>}
              </div>
              <div className="count">
                {[
                  totalEvents > 0 && `${totalEvents} event${totalEvents !== 1 ? 's' : ''}`,
                  n.rcos.length > 0 && `${n.rcos.length} RCO`,
                  n.orgs.length > 0 && `${n.orgs.length} org`,
                ].filter(Boolean).join(' · ')}
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
