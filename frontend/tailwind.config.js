/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        atlas: {
          black:    '#000000',
          900:      '#0A0A0A',
          800:      '#111111',
          700:      '#1A1A1A',
          600:      '#242424',
          500:      '#333333',
          white:    '#FFFFFF',
          primary:  '#FFFFFF',
          secondary:'#A0A0A0',
          muted:    '#555555',
        }
      },
      fontFamily: {
        sora:  ['Sora', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'atlas-card':   '8px',
        'atlas-btn':    '6px',
        'atlas-pill':   '4px',
      },
      fontSize: {
        'atlas-xs':   ['11px', '16px'],
        'atlas-sm':   ['13px', '20px'],
        'atlas-base': ['14px', '22px'],
        'atlas-lg':   ['16px', '24px'],
        'atlas-xl':   ['20px', '28px'],
        'atlas-2xl':  ['24px', '32px'],
        'atlas-3xl':  ['30px', '38px'],
      }
    }
  },
  plugins: [],
}
