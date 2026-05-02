import './globals.css'

export const metadata = {
  title: 'Grove — Pittsburgh Neighborhood Events',
  description: 'Find what\'s happening in your Pittsburgh neighborhood.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header>
          <a href="/" className="logo">Grove</a>
          <span className="tagline">Pittsburgh neighborhood events</span>
        </header>
        <main>{children}</main>
        <footer>
          <p>Data sourced from Carnegie Library of Pittsburgh, registered community organizations, and neighborhood groups. Coverage varies by neighborhood.</p>
        </footer>
      </body>
    </html>
  )
}
