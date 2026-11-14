/** @type {import('tailwindcss').Config} */
// Design tokens: warm paper + ink, Instrument Sans display, JetBrains Mono labels.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper:  { DEFAULT: '#f8f7f4', 2: '#f1efea', 3: '#e9e6df' },
        ink:    { DEFAULT: '#0b0a09', 2: '#2b2724', soft: '#6e655d', faint: '#a39b92' },
        line:   { DEFAULT: '#e3dfd8', strong: '#cfc9bf' },
        night:  { DEFAULT: '#0e0c0a', 2: '#171410', line: '#2a2520', text: '#ece8e1', soft: '#8a8178' },
        live:   '#22c55e',
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: { display: '-0.035em', tightish: '-0.02em' },
      maxWidth: { page: '1440px' },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
        'marquee-slow': 'marquee 60s linear infinite',
        'marquee-rev': 'marquee 50s linear infinite reverse',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
