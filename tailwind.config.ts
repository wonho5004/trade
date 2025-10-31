import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0b2545',
        'background-light': '#f6f8f6',
        'background-dark': '#181A20',
        'panel-light': '#FFFFFF',
        'panel-dark': '#1E222D',
        positive: '#16C784',
        negative: '#EA3943',
        'text-main-light': '#102216',
        'text-main-dark': '#EAECEF',
        'text-secondary-light': '#6b7280',
        'text-secondary-dark': '#848E9C',
        'border-light': '#e5e7eb',
        'border-dark': '#2B3139'
      }
    }
  },
  plugins: []
};

export default config;
