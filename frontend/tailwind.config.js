/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F4F6F3',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#16251E',
          soft: '#1E3128',
        },
        mute: '#5C6B62',
        line: '#E4E9E4',
        brand: {
          DEFAULT: '#0F9B62',
          dark: '#0B7A4D',
          soft: '#E7F5EE',
        },
        expense: {
          DEFAULT: '#DD4A48',
          soft: '#FBEAEA',
        },
        transfer: {
          DEFAULT: '#5667CE',
          soft: '#EDEFFB',
        },
        gold: '#C8A24B',
        mint: '#0F9B62',
        coral: '#DD4A48',
        amber: '#C8A24B'
      },
      fontFamily: {
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['"Spline Sans Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(22, 37, 30, 0.05), 0 4px 16px rgba(22, 37, 30, 0.06)',
        soft: '0 1px 2px rgba(22, 37, 30, 0.05), 0 4px 16px rgba(22, 37, 30, 0.06)'
      }
    },
  },
  plugins: [],
};
