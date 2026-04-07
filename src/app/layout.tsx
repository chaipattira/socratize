import type { Metadata } from 'next'
import { Cormorant_Garamond, Jost, Fraunces } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
})

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-jost',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-fraunces',
})

export const metadata: Metadata = {
  title: 'Socratize',
  description: 'Extract domain expertise into AI-ready knowledge files',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${jost.variable} ${fraunces.variable} font-sans bg-parchment text-stone-900`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
