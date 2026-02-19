/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff1f5',
          100: '#ffe4ec',
          200: '#ffb8cf',
          300: '#ff8cb2',
          400: '#ff5c94',
          500: '#f43f75',
          600: '#d91a57',
          700: '#b50f44',
          800: '#930d38',
          900: '#7a0e31',
        },
        sawaari: {
          dark: '#0d0d14',
          card: '#13131f',
          border: '#1e1e2e',
          muted: '#6b7280',
          accent: '#f43f75',
          pink: '#ec4899',
          gold: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-pink': 'pulsePink 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulsePink: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(244, 63, 117, 0.4)' },
          '50%': { boxShadow: '0 0 0 10px rgba(244, 63, 117, 0)' },
        }
      }
    },
  },
  plugins: [],
}
