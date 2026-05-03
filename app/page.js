import { getNeighborhoodIndex } from '../lib/data'
import Link from 'next/link'

export default function Home() {
  const neighborhoods = getNeighborhoodIndex()

  const totalRcos = new Set(neighborhoods.flatMap(n => n.rcos.map(r => r.id))).size
  const totalOrgs = new Set(neighborhoods.flatMap(n => n.orgs.map(o => o.id))).size

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
      <div className="neighborhood-grid">
        {neighborhoods.map(n => {
          const rcoCount = n.rcos.length
          const orgCount = n.orgs.length
          return (
            <Link href={`/neighborhood/${n.slug}`} key={n.slug} className="neighborhood-card">
              <div className="name">{n.name}</div>
              <div className="count">
                {[
                  rcoCount > 0 && `${rcoCount} RCO${rcoCount !== 1 ? 's' : ''}`,
                  orgCount > 0 && `${orgCount} org${orgCount !== 1 ? 's' : ''}`,
                ].filter(Boolean).join(' · ')}
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
