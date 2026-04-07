import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-fraunces)', 'var(--font-cormorant)', 'Georgia', 'serif'],
        sans: ['var(--font-jost)', 'system-ui', 'sans-serif'],
      },
      colors: {
        parchment: '#FAF8F4',
        vellum: '#F5F1EB',
        linen: '#EDE7DD',
        sepia: '#E8DDD0',
        wine: {
          DEFAULT: '#7C2D35',
          hover: '#6B2430',
          light: '#A33D47',
        },
      },
    },
  },
  plugins: [typography],
}
export default config
