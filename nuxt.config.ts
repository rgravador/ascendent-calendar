// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  ssr: true,

  modules: ['@nuxtjs/tailwindcss'],

  css: [
    '@fontsource/fraunces/400.css',
    '@fontsource/fraunces/500.css',
    '@fontsource/fraunces/600-italic.css',
    '@fontsource/inter-tight/400.css',
    '@fontsource/inter-tight/500.css',
    '@fontsource/inter-tight/600.css',
    '~/assets/css/main.css',
  ],

  app: {
    head: {
      title: 'Dashboard',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#f6f2ea' },
      ],
    },
  },

  runtimeConfig: {
    mockMode: '',
    mongoUri: '',
    googleClientId: '',
    googleClientSecret: '',
    googleRedirectUri: '',
    setupSecret: '',
    dashboardPassword: '',
    sessionSecret: '',
    public: {
      appName: 'Dashboard',
      mockMode: '',
    },
  },

  nitro: {
    // For Amplify Hosting SSR: Nitro's `aws-amplify` preset.
    // For local dev, the default `node-server` is used.
    preset: process.env.NITRO_PRESET || undefined,
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
