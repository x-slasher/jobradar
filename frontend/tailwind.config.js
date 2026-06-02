/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: {
          950: '#0a0a0f',
          900: '#0f0f1a',
          800: '#16161f',
          700: '#1e1e2e',
          600: '#2a2a3d',
          500: '#3d3d5c',
        },
        signal: {
          DEFAULT: '#00e5b0',
          dim: '#00b88a',
          muted: 'rgba(0,229,176,0.12)',
          glow: 'rgba(0,229,176,0.25)',
        },
        slate: {
          400: '#94a3b8',
          300: '#cbd5e1',
          200: '#e2e8f0',
        },
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(0,229,176,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,229,176,0.04) 1px, transparent 1px)`,
      },
      backgroundSize: {
        'grid': '32px 32px',
      },
      boxShadow: {
        'signal': '0 0 24px rgba(0,229,176,0.15)',
        'signal-lg': '0 0 48px rgba(0,229,176,0.2)',
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        'pulse-signal': 'pulseSignal 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        pulseSignal: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.4 },
        },
      },
    },
  },
  plugins: [],
}
