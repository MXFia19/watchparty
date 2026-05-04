/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './node_modules/@vidstack/react/dist/**/*.{js,cjs}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          400: '#7b9fff',
          500: '#5b7fff',
          600: '#4060e0',
          700: '#2d47b8',
          900: '#1a2a6e',
        },
        dark: {
          900: '#0d0f1a',
          800: '#13162a',
          700: '#1c2040',
          600: '#252a50',
        },
      },
    },
  },
  plugins: [],
};
