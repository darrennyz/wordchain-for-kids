/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ServiceNow-inspired palette with kid-friendly warmth
        snow: {
          50: '#f8f9fb',
          100: '#eef1f5',
          200: '#dde3eb',
          300: '#c4ced9',
          400: '#8fa2b5',
          500: '#627d94',
          600: '#475f73',
          700: '#354a5c',
          800: '#243545',
          900: '#1a2735',
        },
        accent: {
          green: '#22c55e',
          blue: '#3b82f6',
          purple: '#8b5cf6',
          orange: '#f97316',
          pink: '#ec4899',
          yellow: '#eab308',
          red: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fredoka', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
        tile: '0 2px 8px rgba(0,0,0,0.08)',
        'tile-active': '0 4px 16px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
};
