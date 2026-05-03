import './globals.css'
import { Playfair_Display } from 'next/font/google'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata = {
  title: 'Grove — Pittsburgh Neighborhood Organizations',
  description: 'Registered community organizations and civic groups across Pittsburgh\'s 90 neighborhoods.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={playfair.variable}>
      <body>
        <header>
          <a href="/" className="logo">Grove</a>
          <span className="tagline">Pittsburgh community organizations</span>
        </header>
        <main>{children}</main>
        <footer>
          <p>
            Data from the City of Pittsburgh&rsquo;s RCO dataset and community research.{' '}
            <a href="/coverage">See coverage by neighborhood →</a>
          </p>
        </footer>
      </body>
    </html>
  )
}
