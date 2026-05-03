import { getNeighborhoodIndex, getNeighborhoodBySlug, getNextMeeting, formatNextMeeting } from '../../../lib/data'
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

function OrgCard({ org, isRco }) {
  const href = org.website || org.facebook || null
  const nextMeeting = org.meeting_recurrence
    ? formatNextMeeting(getNextMeeting(org.meeting_recurrence))
    : null

  return (
    <li className="org-card">
      <div className="org-name">
        {href
          ? <a href={href} target="_blank" rel="noopener noreferrer">{org.name}</a>
          : org.name}
      </div>

      {!isRco && org.org_type && (
        <div className="org-type">{org.org_type}</div>
      )}

      {nextMeeting && (
        <div className="org-next-meeting">
          <span className="org-next-label">Next meeting</span>
          <span className="org-next-date">{nextMeeting}</span>
        </div>
      )}

      {org.meeting_schedule && (
        <div className="org-schedule">
          <span className="org-schedule-label">📅</span>
          <span>{org.meeting_schedule}</span>
        </div>
      )}

      {org.meeting_location && (
        <div className="org-detail">
          <span>📍</span>
          <span>{org.meeting_location}</span>
        </div>
      )}
    </li>
  )
}

export default async function NeighborhoodPage({ params }) {
  const { slug } = await params
  const n = getNeighborhoodBySlug(slug)
  if (!n) notFound()

  // Sort RCOs: ones with a computable next meeting first
  const sortedRcos = [...n.rcos].sort((a, b) => {
    const am = a.meeting_recurrence ? getNextMeeting(a.meeting_recurrence) : null
    const bm = b.meeting_recurrence ? getNextMeeting(b.meeting_recurrence) : null
    if (am && bm) return am.date - bm.date
    if (am) return -1
    if (bm) return 1
    return 0
  })

  return (
    <>
      <Link href="/" className="back-link">← All neighborhoods</Link>
      <h1 className="page-title">{n.name}</h1>

      {/* RCOs */}
      {sortedRcos.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <p className="section-heading">Registered community organizations</p>
          <ul className="org-list">
            {sortedRcos.map((rco, i) => <OrgCard key={i} org={rco} isRco={true} />)}
          </ul>
        </section>
      )}

      {/* Non-RCO orgs */}
      {n.orgs.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <p className="section-heading">Community organizations</p>
          <ul className="org-list">
            {n.orgs.map((org, i) => <OrgCard key={i} org={org} isRco={false} />)}
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
