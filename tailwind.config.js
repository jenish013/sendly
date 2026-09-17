/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Instrument Sans', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        hairline: '0 1px 0 rgba(20,20,20,0.06)',
        lift: '0 18px 50px rgba(20,20,20,0.10)'
      },
      letterSpacing: {
        wordmark: '0.18em'
      }
    }
  },
  plugins: []
}
