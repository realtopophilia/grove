import { getNeighborhoodIndex, getNeighborhoodBySlug, formatEventDate } from '../../../lib/data'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  const neighborhoods = getNeighborhoodIndex()
  return neighborhoods.map(n => ({ slug: n.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const n = getNeighborhoodBySlug(slug)
  if (!n) return {}
  return { title: `${n.name} — Grove` }
}

export default async function NeighborhoodPage({ params }) {
  const { slug } = await params
  const n = getNeighborhoodBySlug(slug)
  if (!n) notFound()

  const hasAnything = n.clpEvents.length > 0 || n.parksEvents?.length > 0 || n.ebEvents?.length > 0 || n.meetupEvents?.length > 0 || n.rcos.length > 0 || n.orgs.length > 0

  return (
    <>
      <Link href="/" className="back-link">← All neighborhoods</Link>
      <h1 className="page-title">{n.name}</h1>

      {/* CLP Events */}
      {n.clpEvents.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <p className="section-heading">Carnegie Library events</p>
          <div className="event-grid">
            {n.clpEvents.map((ev, i) => {
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
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Parks Conservancy Events */}
      {n.parksEvents?.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <p className="section-heading">Pittsburgh Parks Conservancy events</p>
          <div className="event-grid">
            {n.parksEvents.map((ev, i) => {
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
                    <div className="event-meta">{time} · {ev.location_full?.split(',')[0] || 'Pittsburgh Parks'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Eventbrite Events */}
      {n.ebEvents?.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <p className="section-heading">Community events on Eventbrite</p>
          <div className="event-grid">
            {n.ebEvents.map((ev, i) => {
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
                    <div className="event-meta">{ev.location_full?.split(',')[0]}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Meetup Events */}
      {n.meetupEvents?.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <p className="section-heading">Meetup events</p>
          <div className="event-grid">
            {n.meetupEvents.map((ev, i) => {
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
                    <div className="event-meta">{time}{ev.group ? ` · ${ev.group}` : ''}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* RCOs */}
      {n.rcos.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <p className="section-heading">Registered community organizations</p>
          <ul className="org-list">
            {n.rcos.map((rco, i) => (
              <li key={i} className="org-card">
                <div className="org-name">
                  {rco.website
                    ? <a href={rco.website} target="_blank" rel="noopener noreferrer">{rco.name}</a>
                    : rco.name}
                </div>
                {rco.meeting_schedule && (
                  <div className="org-schedule">📅 {rco.meeting_schedule}</div>
                )}
                {rco.meeting_location && (
                  <div className="org-meta">📍 {rco.meeting_location}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Non-RCO orgs */}
      {n.orgs.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <p className="section-heading">Community organizations</p>
          <ul className="org-list">
            {n.orgs.map((org, i) => (
              <li key={i} className="org-card">
                <div className="org-name">
                  {org.website
                    ? <a href={org.website} target="_blank" rel="noopener noreferrer">{org.name}</a>
                    : org.facebook
                    ? <a href={org.facebook} target="_blank" rel="noopener noreferrer">{org.name}</a>
                    : org.name}
                </div>
                <div className="org-meta">{org.org_type}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!hasAnything && (
        <div className="no-events">
          No events or organizations found for {n.name} yet.
          Coverage for this neighborhood is on our roadmap.
        </div>
      )}
    </>
  )
}
