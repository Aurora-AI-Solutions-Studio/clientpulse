import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        accent: 'var(--color-accent)',
        'pulse-red': 'var(--color-pulse-red)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        surface: 'var(--color-surface)',
        'surface-light': 'var(--color-surface-light)',
        deep: 'var(--deep)',
        polar: 'var(--polar)',
        twilight: 'var(--twilight)',
        'surface-hover': 'var(--color-surface-hover)',
        teal: 'var(--teal)',
        'teal-glow': 'var(--teal-glow)',
        'teal-subtle': 'var(--teal-subtle)',
        'aurora-blue': 'var(--aurora-blue)',
        'aurora-purple': 'var(--aurora-purple)',
        'aurora-pink': 'var(--aurora-pink)',
        'reforge-gold': 'var(--reforge-gold)',
        'border-teal': 'var(--border-teal)',
        'border-subtle': 'var(--border-subtle)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-dim': 'var(--text-dim)',
      },
      fontFamily: {
        playfair: ['var(--font-playfair)', 'serif'],
        outfit: ['var(--font-outfit)', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-aurora': 'var(--gradient-aurora)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      transitionDuration: {
        fast: 'var(--transition-fast)',
        base: 'var(--transition-base)',
        slow: 'var(--transition-slow)',
      },
      spacing: {
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
        xl: 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
        '3xl': 'var(--spacing-3xl)',
      },
      boxShadow: {
        'pulse': '0 0 0 0 rgba(231, 76, 60, 0.7)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(231, 76, 60, 0.7)' },
          '70%': { boxShadow: '0 0 0 10px rgba(231, 76, 60, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(231, 76, 60, 0)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s infinite',
      },
    },
  },
  plugins: [],
};
export default config;
