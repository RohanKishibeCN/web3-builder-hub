/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        claude: {
          bg: '#f5f4ed',           // Parchment
          surface: '#faf9f5',      // Ivory
          'surface-dark': '#30302e', // Dark Surface
          'near-black': '#141413', // Primary Text
          brand: '#c96442',        // Terracotta Brand
          accent: '#d97757',       // Coral Accent
          error: '#b53333',        // Error Crimson
          focus: '#3898ec',        // Focus Blue
          'text-secondary': '#5e5d59', // Olive Gray
          'text-tertiary': '#87867f', // Stone Gray
          'text-warm': '#4d4c48',  // Charcoal Warm
          'text-dark-link': '#3d3d3a', // Dark Warm
          'text-silver': '#b0aea5', // Warm Silver
          border: '#f0eee6',       // Border Cream
          'border-strong': '#e8e6dc', // Border Warm
          sand: '#e8e6dc',         // Warm Sand
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Arial', 'sans-serif'],
        serif: ['var(--font-newsreader)', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      boxShadow: {
        'claude-ring': '0px 0px 0px 1px #d1cfc5',
        'claude-ring-subtle': '0px 0px 0px 1px #dedc01',
        'claude-ring-deep': '0px 0px 0px 1px #c2c0b6',
        'claude-whisper': '0px 4px 24px rgba(0, 0, 0, 0.05)',
        'claude-inset': 'inset 0px 0px 0px 1px rgba(0, 0, 0, 0.15)',
      },
      borderRadius: {
        'claude-sharp': '4px',
        'claude-sm': '6px',
        'claude-md': '8px',
        'claude-lg': '12px',
        'claude-xl': '16px',
        'claude-2xl': '24px',
        'claude-3xl': '32px',
      }
    },
  },
  plugins: [],
}
