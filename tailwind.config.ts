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
        vellum: '#EDE7DD',
        linen: '#D9CABC',
        sepia: '#C4AF96',
        ink: '#1C1208',
        wine: {
          DEFAULT: '#8B1A24',
          hover: '#7A1520',
          light: '#A33D47',
        },
      },
    },
  },
  plugins: [typography],
}
export default config
