import { getNeighborhoodIndex, getNeighborhoodBySlug } from '../../../lib/data'
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

  return (
    <>
      <Link href="/" className="back-link">← All neighborhoods</Link>
      <h1 className="page-title">{n.name}</h1>

      {/* RCOs */}
      {n.rcos.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
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
                  <div className="org-schedule">
                    <span className="org-schedule-icon">📅</span> {rco.meeting_schedule}
                  </div>
                )}
                {rco.meeting_location && (
                  <div className="org-detail">
                    <span className="org-detail-icon">📍</span> {rco.meeting_location}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Non-RCO orgs */}
      {n.orgs.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
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
                {org.org_type && <div className="org-type">{org.org_type}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {n.rcos.length === 0 && n.orgs.length === 0 && (
        <div className="no-coverage">
          No organizations found for {n.name} yet.
          Coverage for this neighborhood is on our roadmap.
        </div>
      )}
    </>
  )
}
