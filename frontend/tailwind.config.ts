import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: colors.slate[50],
          100: colors.slate[100],
          200: colors.slate[200],
          300: colors.slate[300],
          400: colors.slate[400],
          500: colors.slate[500],
          600: colors.slate[600],
          700: colors.slate[700],
          800: colors.slate[800],
          900: colors.slate[900],
          950: colors.slate[950],
        },
        accent: {
          50: colors.sky[50],
          100: colors.sky[100],
          200: colors.sky[200],
          300: colors.sky[300],
          400: colors.sky[400],
          500: colors.sky[500],
          600: colors.sky[600],
          700: colors.sky[700],
          800: colors.sky[800],
          900: colors.sky[900],
          950: colors.sky[950],
        },
      },
      boxShadow: {
        panel: '0 12px 32px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
