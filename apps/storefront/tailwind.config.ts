import type { Config } from 'tailwindcss';

// Swiss Modernism 2.0: monochrome zinc surfaces + single warm accent. Strict
// 12-col grid, mathematical spacing, minimal decoration. All semantic surfaces
// flow through CSS vars in globals.css so dark mode is one variable swap.
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem', xl: '2.5rem' },
      screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1440px' },
    },
    extend: {
      colors: {
        // Semantic surfaces — light/dark resolved via CSS vars.
        bg: 'rgb(var(--bg) / <alpha-value>)',
        'bg-elevated': 'rgb(var(--bg-elevated) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-fg': 'rgb(var(--muted-fg) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',

        // Brand = monochrome zinc scale. Used for text, borders, neutral surfaces.
        // Default body text lives at 950 (light) / 50 (dark).
        brand: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },

        // Accent = single warm orange. Reserved for primary CTAs only (Add to
        // cart, Pay, Sign in). Never decorative.
        accent: {
          50: '#fff5f1',
          100: '#ffe5db',
          200: '#ffc8b3',
          300: '#ffa183',
          400: '#ff7a53',
          500: '#ff4d2d',
          600: '#e8341a',
          700: '#c12714',
          800: '#992414',
          900: '#7a2014',
        },

        // Status colors — used for badges, form feedback, status pills.
        success: { 100: '#d1fae5', 500: '#10b981', 600: '#059669' },
        warning: { 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706' },
        danger: { 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Editorial scale: 12 · 14 · 16 · 18 · 20 · 24 · 32 · 40 · 56 · 72
        '5xl': ['3rem', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        '6xl': ['3.5rem', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        '7xl': ['4.5rem', { lineHeight: '0.98', letterSpacing: '-0.035em' }],
      },
      borderRadius: {
        // Sharp by default. Pills only via rounded-full on tags.
        none: '0',
        sm: '0.25rem', // 4
        DEFAULT: '0.375rem', // 6
        md: '0.375rem',
        lg: '0.5rem', // 8
        xl: '0.75rem', // 12
        '2xl': '1rem', // 16
        '3xl': '1.25rem', // 20 (rare, for hero blocks)
      },
      boxShadow: {
        // Minimal layered shadows. No glow, no warm tint — true neutral.
        none: 'none',
        sm: '0 1px 2px rgb(0 0 0 / 0.04)',
        DEFAULT: '0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04)',
        md: '0 2px 8px rgb(0 0 0 / 0.06)',
        lg: '0 8px 24px -8px rgb(0 0 0 / 0.10)',
        xl: '0 16px 40px -12px rgb(0 0 0 / 0.12)',
        focus: '0 0 0 2px rgb(var(--ring) / 0.4)',
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.025em',
        tight: '-0.015em',
        wide: '0.02em',
        wider: '0.06em',
        widest: '0.16em',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        shimmer: 'shimmer 1.6s linear infinite',
      },
      transitionTimingFunction: {
        swiss: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
