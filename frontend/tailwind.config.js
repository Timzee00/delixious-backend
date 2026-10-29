/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#241512',
        'ink-soft': '#6B5B52',
        sand: '#F6EEE0',
        paper: '#FFFFFF',
        hairline: '#E8DCC8',
        pepper: { DEFAULT: '#E1461D', dark: '#B8330F' },
        gold: '#F2A93B',
        jade: { DEFAULT: '#2F8F5B', soft: '#E4F3EA' },
        danger: '#C0392B',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
