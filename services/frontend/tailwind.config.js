/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './ui/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        soc: {
          bg: '#0B0F14',
          card: '#111827',
          border: '#1F2937',
          text: '#E5E7EB',
          muted: '#9CA3AF',
          critical: '#EF4444',
          warning: '#F59E0B',
          info: '#3B82F6',
          success: '#10B981',
        },
      },
      spacing: {
        card: '1rem',
        'card-lg': '1.5rem',
        'row': '0.75rem',
      },
      fontSize: {
        'ui-xs': ['11px', { lineHeight: '16px' }],
        'ui-sm': ['13px', { lineHeight: '18px' }],
        'ui-base': ['14px', { lineHeight: '20px' }],
      },
      boxShadow: {
        card: '0 10px 30px rgba(0,0,0,0.35)',
        focus: '0 0 0 4px rgba(59,130,246,0.25)',
      },
      borderRadius: {
        card: '14px',
        control: '12px',
      },
    },
  },
  plugins: [],
};
