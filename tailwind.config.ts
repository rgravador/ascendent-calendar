import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
    './plugins/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        'surface-soft': 'var(--surface-soft)',
        'surface-raised': 'var(--surface-raised)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        mute: 'var(--mute)',
        rule: 'var(--rule)',
        'rule-strong': 'var(--rule-strong)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        bull: 'var(--success)',
        bear: 'var(--danger)',
        warn: 'var(--warn)',
        info: 'var(--info)',
        success: 'var(--success)',
        danger: 'var(--danger)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
