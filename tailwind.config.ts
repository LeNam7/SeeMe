import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  corePlugins: {
    // Keep public editorial sheets in system.css untouched by Preflight
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        earth: {
          50: '#faf7f1',
          100: '#f6f1e7',
          200: '#ebe3d5',
          300: '#dcd0bc',
          400: '#bda88c',
          500: '#9c7f5f',
          600: '#8d3f28',
          700: '#6e2f1d',
          800: '#3c342e',
          900: '#221f1c',
        },
        slate: {
          950: '#191d24',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', '"Nunito"', 'system-ui', 'sans-serif'],
        sans: ['var(--font-text)', '"Nunito"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
