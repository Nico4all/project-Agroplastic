/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16213a',
        paper: '#f6f7fb',
        mint: '#2aa876',
        coral: '#e86a58',
        amber: '#f4a938'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.08)'
      }
    },
  },
  plugins: [],
};
