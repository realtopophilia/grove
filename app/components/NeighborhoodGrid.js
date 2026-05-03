'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function NeighborhoodGrid({ neighborhoods }) {
  const [query, setQuery]       = useState('')
  const [savedSlug, setSavedSlug] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('grove-neighborhood')
    if (saved) setSavedSlug(saved)
  }, [])

  function saveNeighborhood(slug) {
    localStorage.setItem('grove-neighborhood', slug)
    setSavedSlug(slug)
  }

  function clearNeighborhood(e) {
    e.preventDefault()
    localStorage.removeItem('grove-neighborhood')
    setSavedSlug(null)
  }

  const savedNeighborhood = neighborhoods.find(n => n.slug === savedSlug)

  const filtered = query.trim()
    ? neighborhoods.filter(n => n.name.toLowerCase().includes(query.toLowerCase()))
    : neighborhoods

  return (
    <>
      {/* My neighborhood banner */}
      {savedNeighborhood && !query && (
        <div className="my-neighborhood">
          <span className="my-neighborhood-label">Your neighborhood</span>
          <Link
            href={`/neighborhood/${savedNeighborhood.slug}`}
            className="my-neighborhood-link"
          >
            {savedNeighborhood.name}
          </Link>
          <button className="my-neighborhood-clear" onClick={clearNeighborhood}>
            change
          </button>
        </div>
      )}

      {/* Search */}
      <div className="search-wrap">
        <input
          type="search"
          placeholder="Search neighborhoods…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="search-input"
          aria-label="Search neighborhoods"
        />
      </div>

      {/* Grid */}
      <div className="neighborhood-grid">
        {filtered.map(n => (
          <Link
            href={`/neighborhood/${n.slug}`}
            key={n.slug}
            className={`neighborhood-card${n.slug === savedSlug ? ' neighborhood-card--saved' : ''}`}
            onClick={() => saveNeighborhood(n.slug)}
          >
            <div className="name">{n.name}</div>
            <div className="count">
              {[
                n.rcoCount > 0 && `${n.rcoCount} RCO${n.rcoCount !== 1 ? 's' : ''}`,
                n.orgCount > 0 && `${n.orgCount} org${n.orgCount !== 1 ? 's' : ''}`,
              ].filter(Boolean).join(' · ') || 'No orgs yet'}
            </div>
            {n.nextMeeting && (
              <div className="card-next-meeting">📅 {n.nextMeeting}</div>
            )}
            {n.eventCount > 0 && (
              <div className="card-events">
                🗓 {n.eventCount} upcoming event{n.eventCount !== 1 ? 's' : ''}
              </div>
            )}
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="search-empty">No neighborhoods match &ldquo;{query}&rdquo;</p>
        )}
      </div>
    </>
  )
}
