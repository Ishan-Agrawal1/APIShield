/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#050505',
          panel: '#0a0a0a',
          border: '#1a1a1a',
          text: '#e0e0e0',
          muted: '#666666',
          critical: '#ff003c',
          high: '#ff8800',
          medium: '#ffcc00',
          low: '#00ccff',
          info: '#33ff55',
          accent: '#00ffcc',
        }
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
